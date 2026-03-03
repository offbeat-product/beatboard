import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// Fiscal year: May to April. Current month = 2026-03
function getFiscalYearMonths() {
  // FY2025: 2025-05 to 2026-04
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 8 ? 2025 : 2026;
    const m = ((i + 4) % 12) + 1; // 5,6,7,8,9,10,11,12,1,2,3,4
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export function useDashboardData() {
  const fiscalMonths = getFiscalYearMonths();
  const currentMonth = "2026-03"; // hardcoded as per spec
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

  const isLoading = monthlySalesQuery.isLoading || targetsQuery.isLoading || worklogsQuery.isLoading;
  const sales = monthlySalesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const worklogs = worklogsQuery.data ?? [];

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

  // Current month revenue
  const currentRevenue = currentData?.revenue ?? 0;
  const currentTarget = currentData?.target ?? 0;
  const prevRevenue = previousData?.revenue ?? 0;
  const momChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // Cumulative (fiscal year up to current month)
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const cumulativeRevenue = monthlyTotals.slice(0, currentIdx + 1).reduce((s, m) => s + m.revenue, 0);
  const annualTarget = targets
    .filter((t) => t.metric_name === "monthly_revenue")
    .reduce((s, t) => s + t.target_value, 0);

  // Gross margin
  const currentGrossProfit = currentData?.grossProfit ?? 0;
  const grossMarginRate = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const prevGrossProfit = previousData?.grossProfit ?? 0;
  const prevGrossMargin = prevRevenue > 0 ? (prevGrossProfit / prevRevenue) * 100 : 0;
  const marginChange = grossMarginRate - prevGrossMargin;

  // Gross profit per hour (current month worklogs)
  const currentMonthWorklogs = worklogs.filter((w) => w.date.startsWith(currentMonth));
  const totalHours = currentMonthWorklogs.reduce((s, w) => s + w.hours, 0);
  const grossProfitPerHour = totalHours > 0 ? currentGrossProfit / totalHours : 0;
  const prevMonthWorklogs = worklogs.filter((w) => w.date.startsWith(previousMonth));
  const prevTotalHours = prevMonthWorklogs.reduce((s, w) => s + w.hours, 0);
  const prevGrossProfitPerHour = prevTotalHours > 0 ? prevGrossProfit / prevTotalHours : 0;
  const gphChange = grossProfitPerHour - prevGrossProfitPerHour;

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

  // Target values for concentration & gph
  const targetGrossMargin = targets.find((t) => t.metric_name === "gross_margin_rate")?.target_value ?? 0.63;
  const targetGPH = targets.find((t) => t.metric_name === "gross_profit_per_hour")?.target_value ?? 22000;
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
  if (grossProfitPerHour < targetGPH) {
    alerts.push({
      type: "warning",
      text: `粗利工数単価 ¥${Math.round(grossProfitPerHour).toLocaleString()} - 目標¥${targetGPH.toLocaleString()}を下回り`,
      href: "/pl",
    });
  }

  return {
    isLoading,
    currentRevenue,
    currentTarget,
    momChange,
    cumulativeRevenue,
    annualTarget,
    monthsElapsed: currentIdx + 1,
    grossMarginRate,
    targetGrossMargin: targetGrossMargin * 100,
    marginChange,
    grossProfitPerHour,
    targetGPH,
    gphChange,
    monthlyTotals,
    alerts,
    fiscalMonths,
  };
}
