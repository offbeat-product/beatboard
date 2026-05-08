import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, getCurrentMonth, getPreviousMonth, ORG_ID, getFiscalYearLabel, getFiscalEndYear } from "@/lib/fiscalYear";

export const SGA_CATEGORIES: Record<string, string[]> = {
  '人件費': ['役員報酬', '給料手当', '法定福利費', '福利厚生費', '外注費'],
  '採用費': ['採用教育費'],
  'オフィス費': ['地代家賃', '水道光熱費', '更新料', '修繕費'],
  '広告宣伝・営業活動費': ['交際費', '会議費', '旅費交通費', '広告宣伝費'],
  'IT・システム費': ['システム利用料', '通信費'],
  '専門家・税務費': ['支払報酬料', '租税公課', '支払手数料'],
  'その他': ['消耗品費', '諸会費', '長期前払費用償却', '雑費'],
};

export const SGA_CATEGORY_NAMES = Object.keys(SGA_CATEGORIES);

function classifySgaDetails(sgaDetails: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  SGA_CATEGORY_NAMES.forEach((cat) => (result[cat] = 0));

  if (!Array.isArray(sgaDetails)) return result;

  const accountToCategory: Record<string, string> = {};
  for (const [cat, accounts] of Object.entries(SGA_CATEGORIES)) {
    for (const acc of accounts) {
      accountToCategory[acc] = cat;
    }
  }

  for (const item of sgaDetails as Array<Record<string, unknown>>) {
    const name = (item.name ?? item.account_item_name ?? "") as string;
    const amount = Number(item.amount ?? item.closing_balance ?? item.total_line ?? 0);
    if (amount === 0 || !name) continue;
    const cat = accountToCategory[name] ?? 'その他';
    result[cat] = (result[cat] ?? 0) + amount;
  }

  return result;
}

export function useManagementData(months?: string[]) {
  const currentMonth = getCurrentMonth();
  const fyEndYear = getFiscalEndYear(currentMonth);
  const fiscalMonths = months && months.length > 0 ? months : getFiscalYearMonths(fyEndYear);
  const previousMonth = getPreviousMonth(currentMonth);
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const monthsElapsed = currentIdx >= 0 ? currentIdx + 1 : fiscalMonths.length;
  const fyLabel = getFiscalYearLabel(currentMonth);

  // Always fetch JST current month so KPI cards reflect it even when outside the selected range
  const fetchMonths = fiscalMonths.includes(currentMonth) ? fiscalMonths : [...fiscalMonths, currentMonth];
  const rangeKey = fetchMonths.join(",");

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "management", rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost, cost_total, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fetchMonths);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", "management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("year_month, metric_name, target_value")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const freeePlQuery = useQuery({
    queryKey: ["freee_monthly_pl", "management", rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freee_monthly_pl")
        .select("year_month, revenue, cost_of_sales, gross_profit, gross_profit_rate, sga_total, sga_details, operating_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fetchMonths);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = salesQuery.isLoading || targetsQuery.isLoading || freeePlQuery.isLoading;
  const isError = salesQuery.isError || targetsQuery.isError || freeePlQuery.isError;
  const sales = salesQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const freeePl = freeePlQuery.data ?? [];

  // Monthly aggregation
  const monthlyData = fiscalMonths.map((ym) => {
    const salesRows = sales.filter((s) => s.year_month === ym);
    const revenue = salesRows.reduce((s, r) => s + r.revenue, 0);
    const cost = salesRows.reduce((s, r) => s + Number(r.cost_total ?? r.cost ?? 0), 0);
    const grossProfit = salesRows.reduce((s, r) => s + r.gross_profit, 0);
    const grossMarginRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const freeeRow = freeePl.find((f) => f.year_month === ym);
    const sgaTotal = freeeRow?.sga_total ?? null;
    const sgaDetails = freeeRow?.sga_details ?? null;
    const operatingProfit = sgaTotal !== null ? grossProfit - Number(sgaTotal) : null;
    const operatingMarginRate = operatingProfit !== null && revenue > 0 ? (operatingProfit / revenue) * 100 : null;

    const sgaCategoryBreakdown = classifySgaDetails(sgaDetails);

    const target = targets.find((t) => t.year_month === ym && t.metric_name === "monthly_revenue");

    return {
      ym,
      label: `${ym.split("-")[0].slice(2)}/${Number(ym.split("-")[1])}月`,
      revenue,
      cost,
      grossProfit,
      grossMarginRate,
      sgaTotal: sgaTotal !== null ? Number(sgaTotal) : null,
      sgaDetails,
      sgaCategoryBreakdown,
      operatingProfit,
      operatingMarginRate,
      target: target?.target_value ?? 0,
    };
  });

  // Current month data — look up directly in fetched sales/freee since it may be outside the displayed range
  const currentSalesRows = sales.filter((s) => s.year_month === currentMonth);
  const currentRevenueRaw = currentSalesRows.reduce((s, r) => s + r.revenue, 0);
  const currentCostRaw = currentSalesRows.reduce((s, r) => s + Number(r.cost_total ?? r.cost ?? 0), 0);
  const currentGrossProfitRaw = currentSalesRows.reduce((s, r) => s + r.gross_profit, 0);
  const currentGrossMarginRateRaw = currentRevenueRaw > 0 ? (currentGrossProfitRaw / currentRevenueRaw) * 100 : 0;
  const currentFreeeRow = freeePl.find((f) => f.year_month === currentMonth);
  const currentSgaTotal = currentFreeeRow?.sga_total ?? null;
  const currentOperatingProfitRaw = currentSgaTotal !== null ? currentGrossProfitRaw - Number(currentSgaTotal) : null;
  const currentOperatingMarginRateRaw = currentOperatingProfitRaw !== null && currentRevenueRaw > 0 ? (currentOperatingProfitRaw / currentRevenueRaw) * 100 : null;
  const currentTargetRow = targets.find((t) => t.year_month === currentMonth && t.metric_name === "monthly_revenue");

  const currentData = {
    revenue: currentRevenueRaw,
    grossProfit: currentGrossProfitRaw,
    grossMarginRate: currentGrossMarginRateRaw,
    operatingProfit: currentOperatingProfitRaw,
    operatingMarginRate: currentOperatingMarginRateRaw,
    target: currentTargetRow?.target_value ?? 0,
  };
  const prevData = monthlyData.find((m) => m.ym === previousMonth);

  // Whether current month actually has data (revenue > 0 from monthly_sales)
  const currentMonthHasData = (currentData?.revenue ?? 0) > 0;

  // Current month KPIs — only show if data exists for the JST current month
  const currentRevenue = currentMonthHasData ? currentData!.revenue : 0;
  const currentTarget = currentData?.target ?? 0;
  const currentGrossProfit = currentMonthHasData ? currentData!.grossProfit : 0;
  const currentGrossMarginRate = currentMonthHasData ? currentData!.grossMarginRate : 0;
  const currentOperatingProfit = currentMonthHasData ? (currentData?.operatingProfit ?? null) : null;
  const currentOperatingMarginRate = currentMonthHasData ? (currentData?.operatingMarginRate ?? null) : null;

  // Cumulative
  const cumulativeRevenue = monthlyData.slice(0, currentIdx + 1).reduce((s, m) => s + m.revenue, 0);
  const cumulativeGrossProfit = monthlyData.slice(0, currentIdx + 1).reduce((s, m) => s + m.grossProfit, 0);
  const annualTarget = 75000000; // ¥75M annual target

  // Landing forecast
  const landingForecast = monthsElapsed > 0 ? (cumulativeRevenue / monthsElapsed) * 12 : 0;

  // SGA details for latest month with freee data
  const latestFreeeMonth = [...monthlyData].reverse().find((m) => m.sgaDetails !== null);
  const sgaBreakdown: { name: string; amount: number }[] = [];
  if (latestFreeeMonth?.sgaDetails) {
    const details = latestFreeeMonth.sgaDetails as Array<{ account_item_name?: string; total_line?: number; closing_balance?: number }>;
    if (Array.isArray(details)) {
      details.forEach((item) => {
        const name = item.account_item_name ?? "不明";
        const amount = item.closing_balance ?? item.total_line ?? 0;
        if (amount > 0) {
          sgaBreakdown.push({ name, amount: Number(amount) });
        }
      });
      sgaBreakdown.sort((a, b) => b.amount - a.amount);
    }
  }

  // Chart data: stacked bar (cost + grossProfit = revenue) + gross margin line
  const chartData = monthlyData.map((m) => ({
    name: m.label,
    売上原価: m.cost,
    粗利: m.grossProfit,
    粗利率: Number(m.grossMarginRate.toFixed(1)),
  }));

  return {
    isLoading,
    isError,
    fyLabel,
    monthsElapsed,
    currentMonth,
    currentMonthHasData,
    // Current month
    currentRevenue,
    currentTarget,
    currentGrossProfit,
    currentGrossMarginRate,
    currentOperatingProfit,
    currentOperatingMarginRate,
    // Cumulative
    cumulativeRevenue,
    cumulativeGrossProfit,
    annualTarget,
    landingForecast,
    // Table & chart
    monthlyData,
    chartData,
    sgaBreakdown,
    sgaBreakdownMonth: latestFreeeMonth?.label ?? null,
  };
}
