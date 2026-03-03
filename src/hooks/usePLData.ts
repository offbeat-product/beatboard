import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function getFiscalYearMonths() {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 8 ? 2025 : 2026;
    const m = ((i + 4) % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "1月", "02": "2月", "03": "3月", "04": "4月", "05": "5月", "06": "6月",
  "07": "7月", "08": "8月", "09": "9月", "10": "10月", "11": "11月", "12": "12月",
};

export function usePLData() {
  const fiscalMonths = getFiscalYearMonths();
  const currentMonth = "2026-03";
  const previousMonth = "2026-02";

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const plQuery = useQuery({
    queryKey: ["pl_records", "pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pl_records")
        .select("year_month, account_name, amount")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const worklogsQuery = useQuery({
    queryKey: ["daily_worklogs", "pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_worklogs")
        .select("date, hours")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", "pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("metric_name, target_value")
        .eq("org_id", ORG_ID)
        .in("metric_name", ["gross_margin_rate", "gross_profit_per_hour"]);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = salesQuery.isLoading || plQuery.isLoading || worklogsQuery.isLoading || targetsQuery.isLoading;
  const isError = salesQuery.isError || plQuery.isError || worklogsQuery.isError || targetsQuery.isError;
  const sales = salesQuery.data ?? [];
  const plRecords = plQuery.data ?? [];
  const worklogs = worklogsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];

  const targetGrossMargin = (targets.find((t) => t.metric_name === "gross_margin_rate")?.target_value ?? 0.63) * 100;
  const targetGPH = targets.find((t) => t.metric_name === "gross_profit_per_hour")?.target_value ?? 22000;

  // Build monthly PL rows
  const monthlyPL = fiscalMonths.map((ym) => {
    const salesRows = sales.filter((s) => s.year_month === ym);
    const revenue = salesRows.reduce((s, r) => s + r.revenue, 0);
    const cost = salesRows.reduce((s, r) => s + r.cost, 0);
    const grossProfit = salesRows.reduce((s, r) => s + r.gross_profit, 0);
    const grossMarginRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const sgaRows = plRecords.filter((p) => p.year_month === ym);
    const sga = sgaRows.reduce((s, r) => s + r.amount, 0);
    const operatingProfit = grossProfit - sga;
    const operatingMarginRate = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

    // Hours for GPH
    const monthWorklogs = worklogs.filter((w) => w.date.startsWith(ym));
    const totalHours = monthWorklogs.reduce((s, w) => s + w.hours, 0);
    const gph = totalHours > 0 ? grossProfit / totalHours : 0;

    return {
      ym,
      label: MONTH_LABELS[ym.slice(5)] ?? ym,
      revenue,
      cost,
      grossProfit,
      grossMarginRate,
      sga,
      operatingProfit,
      operatingMarginRate,
      gph,
      totalHours,
    };
  });

  // Totals
  const totals = monthlyPL.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      grossProfit: acc.grossProfit + m.grossProfit,
      sga: acc.sga + m.sga,
      operatingProfit: acc.operatingProfit + m.operatingProfit,
      totalHours: acc.totalHours + m.totalHours,
    }),
    { revenue: 0, cost: 0, grossProfit: 0, sga: 0, operatingProfit: 0, totalHours: 0 }
  );

  const currentData = monthlyPL.find((m) => m.ym === currentMonth);
  const prevData = monthlyPL.find((m) => m.ym === previousMonth);

  const opMarginChange = (currentData?.operatingMarginRate ?? 0) - (prevData?.operatingMarginRate ?? 0);
  const grossMarginChange = (currentData?.grossMarginRate ?? 0) - (prevData?.grossMarginRate ?? 0);
  const gphChange = (currentData?.gph ?? 0) - (prevData?.gph ?? 0);

  // Chart data
  const chartData = monthlyPL.map((m) => ({
    name: m.label,
    売上原価: Math.round(m.cost / 10000),
    販管費: Math.round(m.sga / 10000),
    営業利益: Math.round(m.operatingProfit / 10000),
    粗利率: Number(m.grossMarginRate.toFixed(1)),
  }));

  const gphChartData = monthlyPL.map((m) => ({
    name: m.label,
    粗利工数単価: Math.round(m.gph),
    目標: targetGPH,
  }));

  return {
    isLoading,
    isError,
    currentData,
    targetGrossMargin,
    targetGPH,
    opMarginChange,
    grossMarginChange,
    gphChange,
    chartData,
    gphChartData,
    monthlyPL,
    totals,
  };
}
