import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getFiscalYearLabel, getFiscalMonthNumber } from "@/lib/fiscalYear";

export function useDashboardData() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const previousMonth = "2026-02";

  const monthlySalesQuery = useQuery({
    queryKey: ["monthly_sales", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost, gross_profit, client_id")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("year_month, metric_name, target_value")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const worklogsQuery = useQuery({
    queryKey: ["daily_worklogs", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_worklogs")
        .select("date, hours")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const kpiSnapshotsQuery = useQuery({
    queryKey: ["kpi_snapshots", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_snapshots")
        .select("snapshot_date, metric_name, actual_value")
        .eq("org_id", ORG_ID)
        .eq("metric_name", "gross_profit_per_hour");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = monthlySalesQuery.isLoading || targetsQuery.isLoading || worklogsQuery.isLoading || kpiSnapshotsQuery.isLoading;
  const isError = monthlySalesQuery.isError || targetsQuery.isError || worklogsQuery.isError || kpiSnapshotsQuery.isError;
  const sales = monthlySalesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const worklogs = worklogsQuery.data ?? [];
  const kpiSnapshots = kpiSnapshotsQuery.data ?? [];

  // Aggregate monthly totals
  const monthlyTotals = fiscalMonths.map((ym) => {
    const rows = sales.filter((s) => s.year_month === ym);
    const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
    const cost = rows.reduce((sum, r) => sum + r.cost, 0);
    const grossProfit = rows.reduce((sum, r) => sum + r.gross_profit, 0);
    const target = targets.find((t) => t.year_month === ym && t.metric_name === "monthly_revenue");
    return { ym, revenue, cost, grossProfit, target: target?.target_value ?? 0 };
  });

  const currentData = monthlyTotals.find((m) => m.ym === currentMonth);
  const previousData = monthlyTotals.find((m) => m.ym === previousMonth);

  // Revenue metrics
  const currentRevenue = currentData?.revenue ?? 0;
  const prevRevenue = previousData?.revenue ?? 0;
  const currentTarget = currentData?.target ?? 0;
  const revenueMomChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // Gross profit metrics
  const currentGrossProfit = currentData?.grossProfit ?? 0;
  const prevGrossProfit = previousData?.grossProfit ?? 0;
  const grossProfitMomChange = prevGrossProfit > 0 ? ((currentGrossProfit - prevGrossProfit) / prevGrossProfit) * 100 : 0;

  // Cumulative (fiscal year up to current month)
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const cumulativeRevenue = monthlyTotals.slice(0, currentIdx + 1).reduce((s, m) => s + m.revenue, 0);
  const cumulativeGrossProfit = monthlyTotals.slice(0, currentIdx + 1).reduce((s, m) => s + m.grossProfit, 0);
  const annualTarget = fiscalMonths.reduce((s, ym) => {
    const t = targets.find((t) => t.year_month === ym && t.metric_name === "monthly_revenue");
    return s + (t?.target_value ?? 0);
  }, 0);

  // Gross profit target (revenue target * target gross margin)
  const rawTargetGrossMargin = targets.find((t) => t.metric_name === "gross_margin_rate")?.target_value ?? 0.63;
  const currentGrossProfitTarget = currentTarget * rawTargetGrossMargin;
  const annualGrossProfitTarget = annualTarget * rawTargetGrossMargin;

  // Gross margin
  const grossMarginRate = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const prevGrossMargin = prevRevenue > 0 ? (prevGrossProfit / prevRevenue) * 100 : 0;
  const marginChange = grossMarginRate - prevGrossMargin;

  // GPH helper: get GPH for a given month from kpi_snapshots, fallback to grossProfit / hours (or 160h)
  const getGPH = (ym: string): number => {
    const snapshot = kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym));
    if (snapshot) return snapshot.actual_value;
    const mData = monthlyTotals.find((m) => m.ym === ym);
    if (!mData || mData.grossProfit === 0) return 0;
    const monthWorklogs = worklogs.filter((w) => w.date.startsWith(ym));
    const totalHours = monthWorklogs.reduce((s, w) => s + w.hours, 0);
    return mData.grossProfit / (totalHours > 0 ? totalHours : 160);
  };

  const currentGPH = getGPH(currentMonth);
  const prevGPH = getGPH(previousMonth);
  const gphMomChange = prevGPH > 0 ? ((currentGPH - prevGPH) / prevGPH) * 100 : 0;

  // Monthly GPH array for chart
  const monthlyGPH = fiscalMonths.map((ym) => ({
    ym,
    gph: getGPH(ym),
  }));

  // Average GPH for fiscal year up to current month
  const gphValues = monthlyGPH.slice(0, currentIdx + 1).filter((m) => m.gph > 0);
  const avgGPH = gphValues.length > 0 ? gphValues.reduce((s, m) => s + m.gph, 0) / gphValues.length : 0;

  // Customer concentration
  const currentClientSales = sales
    .filter((s) => s.year_month === currentMonth && s.client_id)
    .reduce((acc, s) => {
      acc[s.client_id!] = (acc[s.client_id!] ?? 0) + s.revenue;
      return acc;
    }, {} as Record<string, number>);
  const sortedClients = Object.values(currentClientSales).sort((a, b) => b - a);
  const top1Concentration = currentRevenue > 0 ? (sortedClients[0] ?? 0) / currentRevenue : 0;
  const top3Concentration = currentRevenue > 0
    ? sortedClients.slice(0, 3).reduce((s, v) => s + v, 0) / currentRevenue
    : 0;

  // Targets
  const targetGrossMargin = targets.find((t) => t.metric_name === "gross_margin_rate")?.target_value ?? 0.63;
  const targetGPH = targets.find((t) => t.metric_name === "gross_profit_per_hour")?.target_value ?? 25000;
  const targetTop1 = targets.find((t) => t.metric_name === "top1_concentration")?.target_value ?? 0.25;
  const targetTop3 = targets.find((t) => t.metric_name === "top3_concentration")?.target_value ?? 0.60;

  // Alerts
  const alerts: { type: "danger" | "warning"; text: string; href: string }[] = [];
  if (top1Concentration > targetTop1) {
    alerts.push({
      type: "danger",
      text: `顧客集中度（上位1社）${(top1Concentration * 100).toFixed(1)}% - 目標${(targetTop1 * 100).toFixed(0)}%を超過`,
      href: "/customers",
    });
  }
  if (top3Concentration > targetTop3) {
    alerts.push({
      type: "danger",
      text: `顧客集中度（上位3社）${(top3Concentration * 100).toFixed(1)}% - 目標${(targetTop3 * 100).toFixed(0)}%を超過`,
      href: "/customers",
    });
  }
  if (currentGPH < targetGPH && currentGPH > 0) {
    alerts.push({
      type: "warning",
      text: `粗利工数単価 ¥${Math.round(currentGPH).toLocaleString()} - 目標¥${targetGPH.toLocaleString()}を下回り`,
      href: "/pl",
    });
  }

  const fyLabel = getFiscalYearLabel(currentMonth);
  const monthsElapsed = getFiscalMonthNumber(currentMonth);

  return {
    isLoading,
    isError,
    // Revenue
    currentRevenue,
    prevRevenue,
    currentTarget,
    revenueMomChange,
    cumulativeRevenue,
    annualTarget,
    // Gross profit
    currentGrossProfit,
    prevGrossProfit,
    grossProfitMomChange,
    cumulativeGrossProfit,
    // Margin
    grossMarginRate,
    targetGrossMargin: targetGrossMargin * 100,
    marginChange,
    // GPH
    currentGPH,
    prevGPH,
    gphMomChange,
    avgGPH,
    targetGPH,
    monthlyGPH,
    // General
    monthsElapsed,
    fyLabel,
    monthlyTotals,
    alerts,
    fiscalMonths,
  };
}
