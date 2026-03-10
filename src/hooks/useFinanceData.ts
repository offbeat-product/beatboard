import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getFiscalYearLabel, getFiscalMonthNumber, getMonthLabel } from "@/lib/fiscalYear";

export interface FinanceMonthly {
  year_month: string;
  cash_and_deposits: number;
  accounts_receivable: number;
  accounts_payable: number;
  borrowings: number;
  interest_expense: number;
  income_amount: number;
  expense_amount: number;
}

export interface FinanceRow {
  month: string;
  label: string;
  cash: number;
  cashDelta: number;
  ar: number;
  arDays: number;
  ap: number;
  apDays: number;
  income: number;
  expense: number;
  borrowings: number;
  interest: number;
  workingCapitalMonths: number;
}

export function useFinanceData() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const fyLabel = getFiscalYearLabel(currentMonth);
  const monthsElapsed = getFiscalMonthNumber(currentMonth);

  const financeQuery = useQuery({
    queryKey: ["finance_monthly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_monthly")
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data ?? [];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost_total")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sgaQuery = useQuery({
    queryKey: ["freee_monthly_pl", "finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freee_monthly_pl")
        .select("year_month, sga_total")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = financeQuery.isLoading || salesQuery.isLoading || sgaQuery.isLoading;
  const isError = financeQuery.isError || salesQuery.isError || sgaQuery.isError;

  const financeMap = new Map<string, FinanceMonthly>();
  (financeQuery.data ?? []).forEach((r: any) => {
    financeMap.set(r.year_month, {
      year_month: r.year_month,
      cash_and_deposits: Number(r.cash_and_deposits ?? 0),
      accounts_receivable: Number(r.accounts_receivable ?? 0),
      accounts_payable: Number(r.accounts_payable ?? 0),
      borrowings: Number(r.borrowings ?? 0),
      interest_expense: Number(r.interest_expense ?? 0),
      income_amount: Number(r.income_amount ?? 0),
      expense_amount: Number(r.expense_amount ?? 0),
    });
  });

  const salesMap = new Map<string, { revenue: number; costTotal: number }>();
  (salesQuery.data ?? []).forEach((r: any) => {
    salesMap.set(r.year_month, {
      revenue: Number(r.revenue ?? 0),
      costTotal: Number(r.cost_total ?? 0),
    });
  });

  const sgaMap = new Map<string, number>();
  (sgaQuery.data ?? []).forEach((r: any) => {
    sgaMap.set(r.year_month, Number(r.sga_total ?? 0));
  });

  // Calculate average SGA from months with meaningful data (> 10,000)
  const sgaValues = Array.from(sgaMap.values()).filter((v) => v > 10000);
  const avgSga = sgaValues.length > 0
    ? sgaValues.reduce((sum, v) => sum + v, 0) / sgaValues.length
    : 0;

  const rows: FinanceRow[] = fiscalMonths.map((ym, idx) => {
    const f = financeMap.get(ym);
    const s = salesMap.get(ym);
    const prevYm = idx > 0 ? fiscalMonths[idx - 1] : null;
    const prevF = prevYm ? financeMap.get(prevYm) : undefined;

    const cash = f?.cash_and_deposits ?? 0;
    const prevCash = prevF?.cash_and_deposits ?? 0;
    const ar = f?.accounts_receivable ?? 0;
    const ap = f?.accounts_payable ?? 0;
    const revenue = s?.revenue ?? 0;
    const costTotal = s?.costTotal ?? 0;

    return {
      month: ym,
      label: getMonthLabel(ym),
      cash,
      cashDelta: prevF ? cash - prevCash : 0,
      ar,
      arDays: revenue > 0 ? (ar / revenue) * 30 : 0,
      ap,
      apDays: costTotal > 0 ? (ap / costTotal) * 30 : 0,
      income: f?.income_amount ?? 0,
      expense: f?.expense_amount ?? 0,
      borrowings: f?.borrowings ?? 0,
      interest: f?.interest_expense ?? 0,
      workingCapitalMonths: avgSga > 0 ? cash / avgSga : 0,
    };
  });

  // Current month data
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const current = rows[currentIdx] ?? rows[0];
  const prev = currentIdx > 0 ? rows[currentIdx - 1] : null;

  // Alerts
  const alerts: { level: "danger" | "warn"; message: string }[] = [];
  if (current && current.cash > 0) {
    if (current.workingCapitalMonths > 0 && current.workingCapitalMonths < 2) {
      alerts.push({ level: "danger", message: "運転資金が2ヶ月を下回っています。資金調達を検討してください。" });
    }
    if (current.arDays >= 60) {
      alerts.push({ level: "warn", message: "売掛金の回収サイクルが長期化しています。回収状況を確認してください。" });
    }
    if (prev && prev.cash > 0) {
      const changeRate = (current.cash - prev.cash) / prev.cash;
      if (changeRate <= -0.2) {
        alerts.push({ level: "warn", message: "現預金が大幅に減少しています。入出金バランスを確認してください。" });
      }
    }
  }

  // Current month SGA for safety line
  const currentSga = sgaMap.get(currentMonth) ?? 0;

  return {
    isLoading,
    isError,
    rows,
    current,
    prev,
    alerts,
    fiscalMonths,
    currentMonth,
    fyLabel,
    monthsElapsed,
    currentSga,
    financeMap,
    sgaMap,
  };
}
