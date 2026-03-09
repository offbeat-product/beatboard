import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { SGA_CATEGORIES, SGA_CATEGORY_NAMES } from "@/hooks/useManagementData";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

function classifySgaDetails(sgaDetails: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  SGA_CATEGORY_NAMES.forEach((cat) => (result[cat] = 0));
  if (!Array.isArray(sgaDetails)) return result;
  const accountToCategory: Record<string, string> = {};
  for (const [cat, accounts] of Object.entries(SGA_CATEGORIES)) {
    for (const acc of accounts) accountToCategory[acc] = cat;
  }
  for (const item of sgaDetails as Array<Record<string, unknown>>) {
    const name = (item.name ?? item.account_item_name ?? "") as string;
    const amount = Number(item.amount ?? item.closing_balance ?? item.total_line ?? 0);
    if (amount === 0 || !name) continue;
    const cat = accountToCategory[name] ?? "その他";
    result[cat] = (result[cat] ?? 0) + amount;
  }
  return result;
}

/** Budget allocation ratios for SGA (after 人件費 = 50% of gross profit target) */
const SGA_BUDGET_RATIOS: Record<string, number> = {
  "採用費": 0.15,
  "オフィス費": 0.35,
  "広告宣伝・営業活動費": 0.20,
  "IT・システム費": 0.15,
  "専門家・税務費": 0.10,
  "その他": 0.05,
};

export function useReportData(selectedYm: string) {
  const prev = prevMonth(selectedYm);

  const salesQuery = useQuery({
    queryKey: ["report_sales", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", [selectedYm, prev]);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["report_targets", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("year_month, metric_name, target_value")
        .eq("org_id", ORG_ID)
        .eq("year_month", selectedYm);
      if (error) throw error;
      return data;
    },
  });

  const freeeQuery = useQuery({
    queryKey: ["report_freee", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freee_monthly_pl")
        .select("year_month, sga_total, sga_details, operating_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", [selectedYm, prev]);
      if (error) throw error;
      return data;
    },
  });

  const kpiQuery = useQuery({
    queryKey: ["report_kpi", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_snapshots")
        .select("snapshot_date, metric_name, actual_value")
        .eq("org_id", ORG_ID)
        .in("metric_name", [
          "total_labor_hours", "project_hours",
          "gross_profit_per_hour", "gross_profit_per_project_hour",
        ]);
      if (error) throw error;
      return data;
    },
  });

  const projectPlQuery = useQuery({
    queryKey: ["report_project_pl", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("year_month, revenue, gross_profit, client_id, client_name, project_id")
        .eq("org_id", ORG_ID)
        .in("year_month", [selectedYm, prev])
        .not("client_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const qualityQuery = useQuery({
    queryKey: ["report_quality", selectedYm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_monthly")
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", [selectedYm, prev]);
      if (error) throw error;
      return data;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["report_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, name_disp")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = salesQuery.isLoading || targetsQuery.isLoading || freeeQuery.isLoading || kpiQuery.isLoading || projectPlQuery.isLoading || qualityQuery.isLoading || clientsQuery.isLoading;
  const isError = salesQuery.isError || targetsQuery.isError || freeeQuery.isError || kpiQuery.isError || projectPlQuery.isError || qualityQuery.isError || clientsQuery.isError;

  const sales = salesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const freeeData = freeeQuery.data ?? [];
  const kpiSnapshots = kpiQuery.data ?? [];
  const projectPl = projectPlQuery.data ?? [];
  const qualityRows = qualityQuery.data ?? [];
  const clients = clientsQuery.data ?? [];

  // === Tab 1: Management ===
  const sumSales = (ym: string) => {
    const rows = sales.filter((s) => s.year_month === ym);
    return {
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      cost: rows.reduce((s, r) => s + r.cost, 0),
      grossProfit: rows.reduce((s, r) => s + r.gross_profit, 0),
    };
  };

  const curr = sumSales(selectedYm);
  const prevSales = sumSales(prev);
  const revenueTarget = targets.find((t) => t.metric_name === "monthly_revenue")?.target_value ?? 0;
  const grossProfitTarget = revenueTarget * 0.7;
  const opTarget = revenueTarget * 0.2;
  const currGrossMarginRate = curr.revenue > 0 ? (curr.grossProfit / curr.revenue) * 100 : 0;

  const freeeRow = freeeData.find((f) => f.year_month === selectedYm);
  const sgaTotal = freeeRow?.sga_total ? Number(freeeRow.sga_total) : 0;
  const operatingProfit = curr.grossProfit - sgaTotal;
  const opRate = curr.revenue > 0 ? (operatingProfit / curr.revenue) * 100 : 0;

  const prevGrossMarginRate = prevSales.revenue > 0 ? (prevSales.grossProfit / prevSales.revenue) * 100 : 0;
  const prevFreee = freeeData.find((f) => f.year_month === prev);
  const prevSgaTotal = prevFreee?.sga_total ? Number(prevFreee.sga_total) : 0;
  const prevOp = prevSales.grossProfit - prevSgaTotal;
  const prevOpRate = prevSales.revenue > 0 ? (prevOp / prevSales.revenue) * 100 : 0;

  // SGA breakdown
  const sgaCategoryBreakdown = classifySgaDetails(freeeRow?.sga_details);
  // Budget for SGA
  const personnelBudget = grossProfitTarget * 0.5;
  const remainingBudget = grossProfitTarget - personnelBudget;
  const sgaBudget: Record<string, number> = { "人件費": personnelBudget };
  for (const [cat, ratio] of Object.entries(SGA_BUDGET_RATIOS)) {
    sgaBudget[cat] = remainingBudget * ratio;
  }

  const managementData = {
    revenue: curr.revenue,
    revenueTarget,
    revenueAchievementRate: revenueTarget > 0 ? Math.round((curr.revenue / revenueTarget) * 100 * 10) / 10 : 0,
    revenueMom: prevSales.revenue > 0 ? ((curr.revenue - prevSales.revenue) / prevSales.revenue) * 100 : 0,
    grossProfit: curr.grossProfit,
    grossProfitTarget,
    grossProfitAchievementRate: grossProfitTarget > 0 ? Math.round((curr.grossProfit / grossProfitTarget) * 100 * 10) / 10 : 0,
    grossProfitMom: prevSales.grossProfit > 0 ? ((curr.grossProfit - prevSales.grossProfit) / prevSales.grossProfit) * 100 : 0,
    grossProfitRate: currGrossMarginRate,
    grossProfitRateMom: currGrossMarginRate - prevGrossMarginRate,
    operatingProfit,
    opTarget,
    opAchievementRate: opTarget > 0 ? Math.round((operatingProfit / opTarget) * 100 * 10) / 10 : 0,
    opMom: prevOp !== 0 ? ((operatingProfit - prevOp) / Math.abs(prevOp)) * 100 : 0,
    opRate,
    opRateMom: opRate - prevOpRate,
    sgaTotal,
    sgaCategoryBreakdown,
    sgaBudget,
  };

  // === Tab 2: Productivity ===
  const findKpi = (ym: string, metric: string) =>
    kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym) && k.metric_name === metric)?.actual_value ?? 0;

  const currTotalHours = findKpi(selectedYm, "total_labor_hours");
  const currProjectHours = findKpi(selectedYm, "project_hours");
  const currGph = findKpi(selectedYm, "gross_profit_per_hour");
  const currProjectGph = findKpi(selectedYm, "gross_profit_per_project_hour");
  const prevTotalHours = findKpi(prev, "total_labor_hours");
  const prevProjectHours = findKpi(prev, "project_hours");
  const prevGph = findKpi(prev, "gross_profit_per_hour");
  const prevProjectGph = findKpi(prev, "gross_profit_per_project_hour");

  const utilizationRate = currTotalHours > 0 ? (currProjectHours / currTotalHours) * 100 : 0;
  const prevUtilization = prevTotalHours > 0 ? (prevProjectHours / prevTotalHours) * 100 : 0;

  const productivityData = {
    totalLaborHours: currTotalHours,
    totalLaborHoursMom: prevTotalHours > 0 ? ((currTotalHours - prevTotalHours) / prevTotalHours) * 100 : 0,
    projectHours: currProjectHours,
    projectHoursMom: prevProjectHours > 0 ? ((currProjectHours - prevProjectHours) / prevProjectHours) * 100 : 0,
    utilizationRate,
    utilizationRateMom: utilizationRate - prevUtilization,
    gph: currGph,
    gphTarget: 21552,
    gphAchievementRate: 21552 > 0 ? Math.round((currGph / 21552) * 100 * 10) / 10 : 0,
    gphMom: prevGph > 0 ? ((currGph - prevGph) / prevGph) * 100 : 0,
    projectGph: currProjectGph,
    projectGphTarget: 25000,
    projectGphAchievementRate: 25000 > 0 ? Math.round((currProjectGph / 25000) * 100 * 10) / 10 : 0,
    projectGphMom: prevProjectGph > 0 ? ((currProjectGph - prevProjectGph) / prevProjectGph) * 100 : 0,
  };

  // === Tab 3: Customers ===
  const plForMonth = (ym: string) => projectPl.filter((r) => r.year_month === ym && Number(r.revenue ?? 0) > 0);
  const currPl = plForMonth(selectedYm);
  const prevPl = plForMonth(prev);
  const currClientIds = new Set(currPl.map((r) => r.client_id));
  const prevClientIds = new Set(prevPl.map((r) => r.client_id));
  const currClientCount = currClientIds.size;
  const prevClientCount = prevClientIds.size;
  const currTotalRevenue = currPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const prevTotalRevenue = prevPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const currProjectCount = currPl.length;
  const prevProjectCount = prevPl.length;

  // Client-level aggregation
  const clientAgg: Record<string, { name: string; revenue: number; grossProfit: number }> = {};
  currPl.forEach((r) => {
    const cid = String(r.client_id);
    if (!clientAgg[cid]) {
      const clientMaster = clients.find((c) => String(c.id) === cid);
      clientAgg[cid] = { name: clientMaster?.name_disp ?? clientMaster?.name ?? r.client_name ?? "不明", revenue: 0, grossProfit: 0 };
    }
    clientAgg[cid].revenue += Number(r.revenue ?? 0);
    clientAgg[cid].grossProfit += Number(r.gross_profit ?? 0);
  });
  const clientTableRows = Object.values(clientAgg)
    .map((c) => ({ ...c, grossProfitRate: c.revenue > 0 ? (c.grossProfit / c.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const avgGrossMarginRate = currTotalRevenue > 0
    ? (currPl.reduce((s, r) => s + Number(r.gross_profit ?? 0), 0) / currTotalRevenue) * 100
    : 0;

  const customersData = {
    prevClientCount,
    currClientCount,
    clientCountMom: prevClientCount > 0 ? ((currClientCount - prevClientCount) / prevClientCount) * 100 : 0,
    prevClientAvg: prevClientCount > 0 ? prevTotalRevenue / prevClientCount : 0,
    currClientAvg: currClientCount > 0 ? currTotalRevenue / currClientCount : 0,
    clientAvgMom: 0,
    prevProjectCount,
    currProjectCount,
    projectCountMom: prevProjectCount > 0 ? ((currProjectCount - prevProjectCount) / prevProjectCount) * 100 : 0,
    prevProjectAvg: prevProjectCount > 0 ? prevTotalRevenue / prevProjectCount : 0,
    currProjectAvg: currProjectCount > 0 ? currTotalRevenue / currProjectCount : 0,
    projectAvgMom: 0,
    clientTableRows,
    avgGrossMarginRate,
  };
  // Fill in mom for unit prices
  customersData.clientAvgMom = customersData.prevClientAvg > 0
    ? ((customersData.currClientAvg - customersData.prevClientAvg) / customersData.prevClientAvg) * 100 : 0;
  customersData.projectAvgMom = customersData.prevProjectAvg > 0
    ? ((customersData.currProjectAvg - customersData.prevProjectAvg) / customersData.prevProjectAvg) * 100 : 0;

  // === Tab 4: Quality ===
  const qualityForMonth = (ym: string) => {
    const totalRow = qualityRows.find((r) => r.year_month === ym && r.client_id === "__total__");
    if (totalRow) {
      return {
        totalDeliveries: totalRow.total_deliveries ?? 0,
        onTime: totalRow.on_time_deliveries ?? 0,
        revisions: totalRow.revision_count ?? 0,
      };
    }
    return { totalDeliveries: 0, onTime: 0, revisions: 0 };
  };

  const currQuality = qualityForMonth(selectedYm);
  const prevQuality = qualityForMonth(prev);
  const currOnTimeRate = currQuality.totalDeliveries > 0 ? (currQuality.onTime / currQuality.totalDeliveries) * 100 : 0;
  const prevOnTimeRate = prevQuality.totalDeliveries > 0 ? (prevQuality.onTime / prevQuality.totalDeliveries) * 100 : 0;
  const currRevisionRate = currQuality.totalDeliveries > 0 ? (currQuality.revisions / currQuality.totalDeliveries) * 100 : 0;
  const prevRevisionRate = prevQuality.totalDeliveries > 0 ? (prevQuality.revisions / prevQuality.totalDeliveries) * 100 : 0;

  // Client-level quality
  const clientQualityRows = qualityRows
    .filter((r) => r.year_month === selectedYm && r.client_id !== "__total__" && r.client_id !== "合計" && r.client_name !== "合計")
    .map((r) => {
      const total = r.total_deliveries ?? 0;
      const onTime = r.on_time_deliveries ?? 0;
      const revisions = r.revision_count ?? 0;
      return {
        clientName: r.client_name ?? r.client_id ?? "不明",
        totalDeliveries: total,
        onTimeDeliveries: onTime,
        onTimeRate: total > 0 ? (onTime / total) * 100 : 0,
        revisionCount: revisions,
        revisionRate: total > 0 ? (revisions / total) * 100 : 0,
      };
    });

  const qualityData = {
    totalDeliveries: currQuality.totalDeliveries,
    totalDeliveriesMom: prevQuality.totalDeliveries > 0 ? ((currQuality.totalDeliveries - prevQuality.totalDeliveries) / prevQuality.totalDeliveries) * 100 : 0,
    onTimeDeliveries: currQuality.onTime,
    onTimeDeliveriesMom: prevQuality.onTime > 0 ? ((currQuality.onTime - prevQuality.onTime) / prevQuality.onTime) * 100 : 0,
    onTimeRate: currOnTimeRate,
    onTimeRateMom: currOnTimeRate - prevOnTimeRate,
    revisionCount: currQuality.revisions,
    revisionCountMom: prevQuality.revisions > 0 ? ((currQuality.revisions - prevQuality.revisions) / prevQuality.revisions) * 100 : 0,
    revisionRate: currRevisionRate,
    revisionRateMom: currRevisionRate - prevRevisionRate,
    clientQualityRows,
    hasData: qualityRows.some((r) => r.year_month === selectedYm),
  };

  return {
    isLoading,
    isError,
    managementData,
    productivityData,
    customersData,
    qualityData,
    selectedYm,
    prevYm: prev,
  };
}
