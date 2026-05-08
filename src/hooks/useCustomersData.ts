import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getMonthLabel } from "@/lib/fiscalYear";

/** Derive previous month from YYYY-MM */
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export function useCustomersData(months?: string[]) {
  const fiscalMonths = months && months.length > 0 ? months : getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const previousMonth = prevMonth(currentMonth);
  const fetchMonths = fiscalMonths.includes(currentMonth)
    ? (fiscalMonths.includes(previousMonth) ? fiscalMonths : [...fiscalMonths, previousMonth])
    : [...fiscalMonths, currentMonth, previousMonth];
  const rangeKey = fetchMonths.join(",");

  // Fiscal months up to current month
  const fiscalMonthsToDate = fiscalMonths.filter((m) => m <= currentMonth);

  const projectPlQuery = useQuery({
    queryKey: ["project_pl", "customers_v2", rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("year_month, revenue, gross_profit, client_id, client_name, project_id")
        .eq("org_id", ORG_ID)
        .in("year_month", fetchMonths)
        .not("client_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = projectPlQuery.isLoading;
  const isError = projectPlQuery.isError;
  const projectPl = projectPlQuery.data ?? [];

  // Helper: filter rows by month with revenue > 0
  const rowsForMonth = (ym: string) => projectPl.filter((r) => r.year_month === ym && Number(r.revenue ?? 0) > 0);
  const allRowsForMonth = (ym: string) => projectPl.filter((r) => r.year_month === ym);

  // --- Customer counts ---
  const uniqueClients = (rows: typeof projectPl) => new Set(rows.map((r) => r.client_id)).size;
  const prevMonthRows = rowsForMonth(previousMonth);
  const currMonthRows = rowsForMonth(currentMonth);
  const ytdRows = projectPl.filter((r) => fiscalMonthsToDate.includes(r.year_month) && Number(r.revenue ?? 0) > 0);

  const prevCustomerCount = uniqueClients(prevMonthRows);
  const currCustomerCount = uniqueClients(currMonthRows);
  const ytdCustomerCount = new Set(ytdRows.map((r) => r.client_id)).size;
  const customerGrowth = prevCustomerCount > 0 ? ((currCustomerCount - prevCustomerCount) / prevCustomerCount) * 100 : 0;

  // --- Revenue sums ---
  const sumRevenue = (rows: typeof projectPl) => rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const sumGrossProfit = (rows: typeof projectPl) => rows.reduce((s, r) => s + Number(r.gross_profit ?? 0), 0);

  const prevRevenue = sumRevenue(prevMonthRows);
  const currRevenue = sumRevenue(currMonthRows);
  const ytdRevenue = sumRevenue(ytdRows);

  // --- Customer unit price ---
  const prevCustomerUnitPrice = prevCustomerCount > 0 ? prevRevenue / prevCustomerCount : 0;
  const currCustomerUnitPrice = currCustomerCount > 0 ? currRevenue / currCustomerCount : 0;
  const customerUnitPriceGrowth = prevCustomerUnitPrice > 0 ? ((currCustomerUnitPrice - prevCustomerUnitPrice) / prevCustomerUnitPrice) * 100 : 0;
  const ytdCustomerUnitPrice = ytdCustomerCount > 0 ? ytdRevenue / ytdCustomerCount : 0;

  // --- Project counts ---
  const prevProjectCount = prevMonthRows.length;
  const currProjectCount = currMonthRows.length;
  const ytdProjectCount = ytdRows.length;
  const projectGrowth = prevProjectCount > 0 ? ((currProjectCount - prevProjectCount) / prevProjectCount) * 100 : 0;

  // --- Project unit price ---
  const prevProjectUnitPrice = prevProjectCount > 0 ? prevRevenue / prevProjectCount : 0;
  const currProjectUnitPrice = currProjectCount > 0 ? currRevenue / currProjectCount : 0;
  const projectUnitPriceGrowth = prevProjectUnitPrice > 0 ? ((currProjectUnitPrice - prevProjectUnitPrice) / prevProjectUnitPrice) * 100 : 0;
  const ytdProjectUnitPrice = ytdProjectCount > 0 ? ytdRevenue / ytdProjectCount : 0;

  // --- Monthly breakdown for charts ---
  const monthlyData = fiscalMonths.map((ym) => {
    const rows = rowsForMonth(ym);
    const rev = sumRevenue(rows);
    const clientCount = uniqueClients(rows);
    const projCount = rows.length;
    return {
      month: getMonthLabel(ym),
      yearMonth: ym,
      revenue: rev,
      grossProfit: sumGrossProfit(rows),
      customerCount: clientCount,
      projectCount: projCount,
      customerUnitPrice: clientCount > 0 ? rev / clientCount : 0,
      projectUnitPrice: projCount > 0 ? rev / projCount : 0,
    };
  });

  // --- Client monthly table data ---
  // Aggregate by client across all fiscal months
  const clientAgg: Record<string, { name: string; revenue: number; grossProfit: number; monthly: Record<string, { revenue: number; grossProfit: number }> }> = {};
  projectPl.forEach((r) => {
    const cid = String(r.client_id);
    if (!clientAgg[cid]) {
      clientAgg[cid] = { name: r.client_name ?? "不明", revenue: 0, grossProfit: 0, monthly: {} };
    }
    clientAgg[cid].revenue += Number(r.revenue ?? 0);
    clientAgg[cid].grossProfit += Number(r.gross_profit ?? 0);
    if (!clientAgg[cid].monthly[r.year_month]) {
      clientAgg[cid].monthly[r.year_month] = { revenue: 0, grossProfit: 0 };
    }
    clientAgg[cid].monthly[r.year_month].revenue += Number(r.revenue ?? 0);
    clientAgg[cid].monthly[r.year_month].grossProfit += Number(r.gross_profit ?? 0);
  });

  const clientTableData = Object.entries(clientAgg)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Monthly totals for footer
  const monthlyTotals: Record<string, { revenue: number; grossProfit: number }> = {};
  fiscalMonths.forEach((ym) => {
    monthlyTotals[ym] = { revenue: 0, grossProfit: 0 };
    projectPl.filter((r) => r.year_month === ym).forEach((r) => {
      monthlyTotals[ym].revenue += Number(r.revenue ?? 0);
      monthlyTotals[ym].grossProfit += Number(r.gross_profit ?? 0);
    });
  });

  return {
    isLoading,
    isError,
    currentMonth,
    previousMonth,
    fiscalMonths,
    // Customer KPIs
    prevCustomerCount,
    currCustomerCount,
    customerGrowth,
    ytdCustomerCount,
    prevCustomerUnitPrice,
    currCustomerUnitPrice,
    customerUnitPriceGrowth,
    ytdCustomerUnitPrice,
    // Project KPIs
    prevProjectCount,
    currProjectCount,
    projectGrowth,
    ytdProjectCount,
    prevProjectUnitPrice,
    currProjectUnitPrice,
    projectUnitPriceGrowth,
    ytdProjectUnitPrice,
    // Charts
    monthlyData,
    // Table
    clientTableData,
    monthlyTotals,
  };
}
