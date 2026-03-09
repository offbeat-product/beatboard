import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getMonthLabel } from "@/lib/fiscalYear";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export interface QualityMonthlyInput {
  onTimeDeliveries: number;
  revisionCount: number;
}

export function useQualityData() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const previousMonth = prevMonth(currentMonth);
  const fiscalMonthsToDate = fiscalMonths.filter((m) => m <= currentMonth);

  // Get project counts from project_pl (same as customers page)
  const projectPlQuery = useQuery({
    queryKey: ["project_pl", "quality_deliveries", fiscalMonths],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("year_month, revenue, project_id")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths)
        .gt("revenue", 0);
      if (error) throw error;
      return data;
    },
  });

  // Get quality manual data
  const qualityQuery = useQuery({
    queryKey: ["quality_monthly", fiscalMonths],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_monthly")
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = projectPlQuery.isLoading || qualityQuery.isLoading;
  const isError = projectPlQuery.isError || qualityQuery.isError;
  const projectPl = projectPlQuery.data ?? [];
  const qualityRows = qualityQuery.data ?? [];

  // Project counts per month (from project_pl)
  const projectCountForMonth = (ym: string) => projectPl.filter((r) => r.year_month === ym).length;

  const prevDeliveries = projectCountForMonth(previousMonth);
  const currDeliveries = projectCountForMonth(currentMonth);
  const ytdDeliveries = projectPl.filter((r) => fiscalMonthsToDate.includes(r.year_month)).length;
  const deliveriesGrowth = prevDeliveries > 0 ? ((currDeliveries - prevDeliveries) / prevDeliveries) * 100 : 0;

  // Quality data per month (from quality_monthly, aggregated)
  const qualityForMonth = (ym: string) => {
    // Use only __total__ row (aggregated summary) to avoid double-counting with per-client rows
    const totalRow = qualityRows.find((r) => r.year_month === ym && r.client_id === "__total__");
    if (totalRow) {
      return {
        onTime: totalRow.on_time_deliveries ?? 0,
        revisions: totalRow.revision_count ?? 0,
      };
    }
    return { onTime: 0, revisions: 0 };
  };

  // Default editable values from DB
  const defaultInputMap: Record<string, QualityMonthlyInput> = {};
  fiscalMonths.forEach((ym) => {
    const q = qualityForMonth(ym);
    defaultInputMap[ym] = {
      onTimeDeliveries: q.onTime,
      revisionCount: q.revisions,
    };
  });

  // Compute monthly row from inputs
  const computeMonthlyRow = (ym: string, input: QualityMonthlyInput) => {
    const deliveries = projectCountForMonth(ym);
    const onTimeRate = deliveries > 0 ? (input.onTimeDeliveries / deliveries) * 100 : 0;
    const revisionRate = deliveries > 0 ? (input.revisionCount / deliveries) * 100 : 0;
    return {
      ym,
      month: getMonthLabel(ym),
      deliveries,
      onTimeDeliveries: input.onTimeDeliveries,
      revisionCount: input.revisionCount,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      revisionRate: Math.round(revisionRate * 10) / 10,
    };
  };

  // KPIs using default values
  const prev = qualityForMonth(previousMonth);
  const curr = qualityForMonth(currentMonth);

  const prevOnTimeRate = prevDeliveries > 0 ? (prev.onTime / prevDeliveries) * 100 : 0;
  const currOnTimeRate = currDeliveries > 0 ? (curr.onTime / currDeliveries) * 100 : 0;
  const onTimeRateDiff = currOnTimeRate - prevOnTimeRate;

  const prevRevisionRate = prevDeliveries > 0 ? (prev.revisions / prevDeliveries) * 100 : 0;
  const currRevisionRate = currDeliveries > 0 ? (curr.revisions / currDeliveries) * 100 : 0;
  const revisionRateDiff = currRevisionRate - prevRevisionRate;

  // YTD averages
  const monthlyRates = fiscalMonthsToDate.map((ym) => {
    const del = projectCountForMonth(ym);
    const q = qualityForMonth(ym);
    return {
      onTimeRate: del > 0 ? (q.onTime / del) * 100 : null,
      revisionRate: del > 0 ? (q.revisions / del) * 100 : null,
    };
  });
  const validOnTime = monthlyRates.filter((r) => r.onTimeRate !== null);
  const validRevision = monthlyRates.filter((r) => r.revisionRate !== null);
  const ytdAvgOnTimeRate = validOnTime.length > 0
    ? validOnTime.reduce((s, r) => s + r.onTimeRate!, 0) / validOnTime.length : 0;
  const ytdAvgRevisionRate = validRevision.length > 0
    ? validRevision.reduce((s, r) => s + r.revisionRate!, 0) / validRevision.length : 0;

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
    prevOnTime: prev.onTime,
    currOnTime: curr.onTime,
    prevOnTimeRate,
    currOnTimeRate,
    onTimeRateDiff,
    prevRevisions: prev.revisions,
    currRevisions: curr.revisions,
    prevRevisionRate,
    currRevisionRate,
    revisionRateDiff,
    ytdAvgOnTimeRate,
    ytdAvgRevisionRate,
    // For editable table
    defaultInputMap,
    computeMonthlyRow,
    projectCountForMonth,
    // Refetch
    refetch: () => {
      projectPlQuery.refetch();
      qualityQuery.refetch();
    },
  };
}
