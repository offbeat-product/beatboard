import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getMonthLabel } from "@/lib/fiscalYear";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export interface QualityRow {
  id: string;
  org_id: string;
  year_month: string;
  client_id: string | null;
  client_name: string | null;
  total_deliveries: number;
  on_time_deliveries: number;
  revision_count: number;
}

export function useQualityData() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const previousMonth = prevMonth(currentMonth);
  const fiscalMonthsToDate = fiscalMonths.filter((m) => m <= currentMonth);

  const query = useQuery({
    queryKey: ["quality_monthly", fiscalMonths],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_monthly")
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data as QualityRow[];
    },
  });

  const isLoading = query.isLoading;
  const isError = query.isError;
  const rows = query.data ?? [];

  const rowsForMonth = (ym: string) => rows.filter((r) => r.year_month === ym);
  const sumField = (rs: QualityRow[], field: "total_deliveries" | "on_time_deliveries" | "revision_count") =>
    rs.reduce((s, r) => s + (r[field] ?? 0), 0);

  // --- Monthly aggregates ---
  const prev = rowsForMonth(previousMonth);
  const curr = rowsForMonth(currentMonth);
  const ytdRows = rows.filter((r) => fiscalMonthsToDate.includes(r.year_month));

  // Deliveries (案件数)
  const prevDeliveries = sumField(prev, "total_deliveries");
  const currDeliveries = sumField(curr, "total_deliveries");
  const ytdDeliveries = sumField(ytdRows, "total_deliveries");
  const deliveriesGrowth = prevDeliveries > 0 ? ((currDeliveries - prevDeliveries) / prevDeliveries) * 100 : 0;

  // On-time rate (納期遵守率)
  const prevOnTime = sumField(prev, "on_time_deliveries");
  const currOnTime = sumField(curr, "on_time_deliveries");
  const prevOnTimeRate = prevDeliveries > 0 ? (prevOnTime / prevDeliveries) * 100 : 0;
  const currOnTimeRate = currDeliveries > 0 ? (currOnTime / currDeliveries) * 100 : 0;
  const onTimeRateDiff = currOnTimeRate - prevOnTimeRate;

  // Revision rate (修正発生率)
  const prevRevisions = sumField(prev, "revision_count");
  const currRevisions = sumField(curr, "revision_count");
  const prevRevisionRate = prevDeliveries > 0 ? (prevRevisions / prevDeliveries) * 100 : 0;
  const currRevisionRate = currDeliveries > 0 ? (currRevisions / currDeliveries) * 100 : 0;
  const revisionRateDiff = currRevisionRate - prevRevisionRate;

  // YTD averages (月平均)
  const monthlyRates = fiscalMonthsToDate.map((ym) => {
    const mr = rowsForMonth(ym);
    const td = sumField(mr, "total_deliveries");
    const ot = sumField(mr, "on_time_deliveries");
    const rv = sumField(mr, "revision_count");
    return {
      onTimeRate: td > 0 ? (ot / td) * 100 : null,
      revisionRate: td > 0 ? (rv / td) * 100 : null,
    };
  });
  const validOnTimeRates = monthlyRates.filter((r) => r.onTimeRate !== null);
  const validRevisionRates = monthlyRates.filter((r) => r.revisionRate !== null);
  const ytdAvgOnTimeRate = validOnTimeRates.length > 0
    ? validOnTimeRates.reduce((s, r) => s + r.onTimeRate!, 0) / validOnTimeRates.length : 0;
  const ytdAvgRevisionRate = validRevisionRates.length > 0
    ? validRevisionRates.reduce((s, r) => s + r.revisionRate!, 0) / validRevisionRates.length : 0;

  // --- Monthly chart data ---
  const monthlyData = fiscalMonths.map((ym) => {
    const mr = rowsForMonth(ym);
    const td = sumField(mr, "total_deliveries");
    const ot = sumField(mr, "on_time_deliveries");
    const rv = sumField(mr, "revision_count");
    return {
      month: getMonthLabel(ym),
      yearMonth: ym,
      deliveries: td,
      onTimeRate: td > 0 ? Math.round((ot / td) * 1000) / 10 : 0,
      revisionRate: td > 0 ? Math.round((rv / td) * 1000) / 10 : 0,
    };
  });

  // --- Client-level aggregation ---
  const clientAgg: Record<string, {
    name: string;
    monthly: Record<string, { total: number; onTime: number; revisions: number }>;
    totalDeliveries: number;
    totalOnTime: number;
    totalRevisions: number;
  }> = {};

  rows.forEach((r) => {
    const cid = r.client_id ?? "unknown";
    if (!clientAgg[cid]) {
      clientAgg[cid] = {
        name: r.client_name ?? "不明",
        monthly: {},
        totalDeliveries: 0,
        totalOnTime: 0,
        totalRevisions: 0,
      };
    }
    const c = clientAgg[cid];
    c.totalDeliveries += r.total_deliveries;
    c.totalOnTime += r.on_time_deliveries;
    c.totalRevisions += r.revision_count;
    if (!c.monthly[r.year_month]) {
      c.monthly[r.year_month] = { total: 0, onTime: 0, revisions: 0 };
    }
    c.monthly[r.year_month].total += r.total_deliveries;
    c.monthly[r.year_month].onTime += r.on_time_deliveries;
    c.monthly[r.year_month].revisions += r.revision_count;
  });

  const clientOnTimeData = Object.entries(clientAgg)
    .map(([id, d]) => ({
      id,
      name: d.name,
      monthly: d.monthly,
      totalDeliveries: d.totalDeliveries,
      avgOnTimeRate: d.totalDeliveries > 0 ? (d.totalOnTime / d.totalDeliveries) * 100 : 0,
      avgRevisionRate: d.totalDeliveries > 0 ? (d.totalRevisions / d.totalDeliveries) * 100 : 0,
    }))
    .sort((a, b) => b.avgOnTimeRate - a.avgOnTimeRate);

  const clientRevisionData = [...clientOnTimeData].sort((a, b) => a.avgRevisionRate - b.avgRevisionRate);

  return {
    isLoading,
    isError,
    currentMonth,
    previousMonth,
    fiscalMonths,
    fiscalMonthsToDate,
    // KPIs
    prevDeliveries,
    currDeliveries,
    deliveriesGrowth,
    ytdDeliveries,
    prevOnTime,
    currOnTime,
    prevOnTimeRate,
    currOnTimeRate,
    onTimeRateDiff,
    prevRevisions,
    currRevisions,
    prevRevisionRate,
    currRevisionRate,
    revisionRateDiff,
    ytdAvgOnTimeRate,
    ytdAvgRevisionRate,
    // Charts
    monthlyData,
    // Tables
    clientOnTimeData,
    clientRevisionData,
    // Raw refetch
    refetch: query.refetch,
  };
}
