import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID, getFiscalYearLabel, getFiscalYearMonths, getFiscalEndYear } from "@/lib/fiscalYear";

/**
 * Management page SGA category names (display).
 */
export const MGMT_SGA_CATEGORY_NAMES = [
  "人件費",
  "採用費",
  "オフィス費",
  "広告宣伝・営業活動費",
  "IT・システム費",
  "専門家・税務費",
  "その他",
] as const;

/** Map plan_settings SGA category id → Management page category name. */
const PLAN_TO_MGMT_SGA: Record<string, string> = {
  executive_comp: "人件費",
  personnel: "人件費",
  recruiting: "採用費",
  office: "オフィス費",
  marketing: "広告宣伝・営業活動費",
  it_system: "IT・システム費",
  professional: "専門家・税務費",
  other: "その他",
};

export interface PlanBudget {
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginRate: number;
  sgaTotal: number;
  operatingProfit: number;
  operatingMarginRate: number;
  sgaCategories: Record<string, number>;
}

const EMPTY_BUDGET: PlanBudget = {
  revenue: 0, cost: 0, grossProfit: 0, grossMarginRate: 0,
  sgaTotal: 0, operatingProfit: 0, operatingMarginRate: 0,
  sgaCategories: Object.fromEntries(MGMT_SGA_CATEGORY_NAMES.map((n) => [n, 0])),
};

/**
 * Fetches plan_settings for all fiscal years that the given months belong to and
 * computes the monthly budget per ym, sourced from the user's business plan.
 */
export function usePlanBudget(months: string[]) {
  // Determine fiscal years covered by the months
  const fyEndYears = Array.from(new Set(months.map((m) => getFiscalEndYear(m))));
  const fiscalYears = fyEndYears.map((y) => `${y}年4月期`);

  const query = useQuery({
    queryKey: ["plan_settings", "budget", fiscalYears.join(",")],
    enabled: fiscalYears.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings" as any)
        .select("*")
        .eq("org_id", ORG_ID)
        .in("fiscal_year", fiscalYears);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const planByFy = new Map<string, any>();
  (query.data ?? []).forEach((p) => planByFy.set(p.fiscal_year, p));

  const budgetByYm = new Map<string, PlanBudget>();

  for (const ym of months) {
    const fyLabel = getFiscalYearLabel(ym);
    const plan = planByFy.get(fyLabel);
    if (!plan) {
      budgetByYm.set(ym, { ...EMPTY_BUDGET, sgaCategories: { ...EMPTY_BUDGET.sgaCategories } });
      continue;
    }

    const fyEnd = getFiscalEndYear(ym);
    const fyMonths = getFiscalYearMonths(fyEnd);
    const idx = fyMonths.indexOf(ym);

    const annualRevenue = Number(plan.annual_revenue_target) || 0;
    const distribution: number[] = Array.isArray(plan.monthly_revenue_distribution)
      ? plan.monthly_revenue_distribution.map((v: any) => Number(v) || 0)
      : [];
    const distMode = plan.distribution_mode || "half_year";

    let monthlyRevenue = 0;
    if (distMode === "equal" || distribution.length !== 12) {
      monthlyRevenue = annualRevenue / 12;
    } else {
      monthlyRevenue = distribution[idx] ?? 0;
    }

    const grossRate = Number(plan.gross_profit_rate) || 70;
    const opRate = Number(plan.operating_profit_rate) || 20;
    const costRate = Number(plan.cost_rate) || (100 - grossRate);

    const cost = monthlyRevenue * (costRate / 100);
    const grossProfit = monthlyRevenue * (grossRate / 100);
    const operatingProfit = monthlyRevenue * (opRate / 100);
    const sgaTotal = grossProfit - operatingProfit;

    // SGA categories: per-month override first, else allocation rate × sgaTotal
    const allocRates: Record<string, number> = (plan.sga_allocation_rates && typeof plan.sga_allocation_rates === "object")
      ? plan.sga_allocation_rates
      : {};
    const overrides: Record<string, Record<string, number>> = (plan.monthly_sga_overrides && typeof plan.monthly_sga_overrides === "object")
      ? plan.monthly_sga_overrides
      : {};
    const monthOverrides = overrides[ym] || {};

    const sgaCategories: Record<string, number> = Object.fromEntries(
      MGMT_SGA_CATEGORY_NAMES.map((n) => [n, 0])
    );

    for (const planCatId of Object.keys(PLAN_TO_MGMT_SGA)) {
      const mgmtName = PLAN_TO_MGMT_SGA[planCatId];
      let val: number;
      const ov = monthOverrides[planCatId];
      if (ov !== undefined && ov !== null) {
        val = Number(ov) || 0;
      } else {
        const rate = Number(allocRates[planCatId]) || 0;
        val = sgaTotal * (rate / 100);
      }
      sgaCategories[mgmtName] = (sgaCategories[mgmtName] ?? 0) + val;
    }

    budgetByYm.set(ym, {
      revenue: monthlyRevenue,
      cost,
      grossProfit,
      grossMarginRate: monthlyRevenue > 0 ? (grossProfit / monthlyRevenue) * 100 : 0,
      sgaTotal,
      operatingProfit,
      operatingMarginRate: monthlyRevenue > 0 ? (operatingProfit / monthlyRevenue) * 100 : 0,
      sgaCategories,
    });
  }

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    getBudget: (ym: string): PlanBudget => budgetByYm.get(ym) ?? EMPTY_BUDGET,
  };
}
