export interface StaffingRow {
  month: string;
  fullTimeCount: number;
  partTimeCount: number;
  fullTimeHours: number;
  partTimeTotalHours: number;
}

export interface MonthlyClientData {
  active: number;
  new: number;
  churned: number;
}

export interface SgaCategory {
  id: string;
  name: string;
  order: number;
}

export interface ClientRevenuePlanRow {
  client_id: string | null;
  client_name: string;
  category: "existing" | "new" | "risk";
  monthly_revenue: Record<string, number>;
  order: number;
  revenue_cap?: number | null;
}

export interface PlanSettings {
  annual_revenue_target: number;
  cost_rate: number;
  gross_profit_rate: number;
  operating_profit_rate: number;
  personnel_cost_rate: number;
  recruitment_rate: number;
  office_rate: number;
  marketing_rate: number;
  it_rate: number;
  professional_rate: number;
  other_rate: number;
  gp_per_hour_target: number;
  gp_per_project_hour_target: number;
  on_time_delivery_target: number;
  revision_rate_target: number;
  staffing_plan: StaffingRow[];
  monthly_revenue_distribution: number[];
  distribution_mode: string;
  annual_client_target: number;
  annual_project_target: number;
  monthly_clients: Record<string, MonthlyClientData>;
  sga_categories: SgaCategory[];
  monthly_sga: Record<string, Record<string, number>>;
  // New fields
  sga_allocation_rates: Record<string, number>;
  monthly_sga_overrides: Record<string, Record<string, number>>;
  annual_sga_total: number;
  client_revenue_plan: ClientRevenuePlanRow[];
  revenue_distribution_pattern: string;
  revenue_growth_factor: number;
}

export const DEFAULT_SGA_CATEGORIES: SgaCategory[] = [
  { id: "personnel", name: "人件費", order: 1 },
  { id: "recruiting", name: "採用費", order: 2 },
  { id: "office", name: "オフィス費", order: 3 },
  { id: "marketing", name: "広告宣伝・営業活動費", order: 4 },
  { id: "it_system", name: "IT・システム関連費", order: 5 },
  { id: "professional", name: "専門家・税務費", order: 6 },
  { id: "other", name: "その他", order: 7 },
];

export const DEFAULT_SGA_ALLOCATION_RATES: Record<string, number> = {
  personnel: 50,
  recruiting: 10,
  office: 10,
  marketing: 12,
  it_system: 10,
  professional: 4,
  other: 4,
};

export const SGA_CATEGORY_TOOLTIPS: Record<string, string> = {
  personnel: "給与・賞与・役員報酬・法定福利費・福利厚生費・退職金",
  recruiting: "求人媒体・人材紹介料・採用イベント・リファラルボーナス",
  office: "地代家賃・水道光熱費・通信費(回線)・備品消耗品・清掃",
  marketing: "Web広告・展示会・販促物・営業交通費・接待交際費",
  it_system: "SaaS利用料・サーバー費・ドメイン・PC/ソフトウェア・セキュリティ",
  professional: "顧問税理士・社労士・弁護士・コンサル・監査費用",
  other: "雑費・予備費・上記に分類されないもの",
};

export const DEFAULT_STAFFING = (months: string[]): StaffingRow[] =>
  months.map((m) => {
    const [, mm] = m.split("-").map(Number);
    const isLaterPeriod = mm >= 2 && mm <= 4;
    return {
      month: m,
      fullTimeCount: isLaterPeriod ? 2 : 3,
      partTimeCount: isLaterPeriod ? 3 : 0,
      fullTimeHours: 160,
      partTimeTotalHours: isLaterPeriod ? 260 : 0,
    };
  });

export const DEFAULT_HALF_YEAR_DIST = (months: string[], annualTarget: number): number[] => {
  const firstHalf = annualTarget * 0.4;
  const secondHalf = annualTarget * 0.6;
  return months.map((m) => {
    const mm = parseInt(m.split("-")[1], 10);
    return mm >= 5 && mm <= 10 ? firstHalf / 6 : secondHalf / 6;
  });
};

export const DEFAULT_SETTINGS = (months: string[]): PlanSettings => ({
  annual_revenue_target: 75000000,
  cost_rate: 30,
  gross_profit_rate: 70,
  operating_profit_rate: 20,
  personnel_cost_rate: 50,
  recruitment_rate: 15,
  office_rate: 35,
  marketing_rate: 20,
  it_rate: 15,
  professional_rate: 10,
  other_rate: 5,
  gp_per_hour_target: 21552,
  gp_per_project_hour_target: 25000,
  on_time_delivery_target: 95,
  revision_rate_target: 20,
  staffing_plan: DEFAULT_STAFFING(months),
  monthly_revenue_distribution: DEFAULT_HALF_YEAR_DIST(months, 75000000),
  distribution_mode: "half_year",
  annual_client_target: 30,
  annual_project_target: 250,
  monthly_clients: {},
  sga_categories: DEFAULT_SGA_CATEGORIES,
  monthly_sga: {},
  sga_allocation_rates: DEFAULT_SGA_ALLOCATION_RATES,
  monthly_sga_overrides: {},
  annual_sga_total: 0,
  client_revenue_plan: [],
  revenue_distribution_pattern: "standard",
  revenue_growth_factor: 1.5,
});

/* ── Helpers ── */

/** Distribute a total amount across n months using arithmetic progression.
 *  growthFactor g = last month / first month. g=1 → equal distribution. */
export function distributeRevenue(
  totalAmount: number,
  monthCount: number,
  growthFactor: number
): number[] {
  const n = monthCount;
  const g = Math.max(growthFactor, 1);
  if (n <= 0) return [];
  if (n === 1) return [totalAmount];
  if (Math.abs(g - 1.0) < 0.001) {
    // Equal distribution
    const base = Math.round(totalAmount / n);
    const result = Array(n).fill(base);
    result[n - 1] += totalAmount - base * n;
    return result;
  }
  // Arithmetic progression: a, a+d, a+2d, ..., a+(n-1)d
  // sum = n*a + n*(n-1)/2 * d = totalAmount
  // a+(n-1)*d = g*a → d = (g-1)*a/(n-1)
  // totalAmount = n*a + n*(n-1)/2 * (g-1)*a/(n-1) = n*a + n/2*(g-1)*a = a*(n + n*(g-1)/2) = a*n*(1+g)/2
  const a = totalAmount / ((n / 2) * (1 + g));
  const d = ((g - 1) * a) / (n - 1);
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(Math.round(a + i * d));
  }
  // Rounding adjustment on last month
  const sum = result.reduce((s, v) => s + v, 0);
  result[n - 1] += totalAmount - sum;
  return result;
}

/** Map pattern name to growth factor */
export const PATTERN_GROWTH_MAP: Record<string, number> = {
  flat: 1.0,
  gentle: 1.3,
  standard: 1.5,
  aggressive: 2.0,
};

export const fmtNum = (v: number, unit: string, isGph = false) => {
  if (isGph) return `¥${Math.round(v).toLocaleString()}`;
  if (unit === "thousand") return `¥${Math.round(v / 1000).toLocaleString()}千`;
  return `¥${Math.round(v).toLocaleString()}`;
};

export const fmtInputVal = (v: number, unit: string) => {
  if (unit === "thousand") return Math.round(v / 1000);
  return v;
};

export const parseInputVal = (v: string, unit: string) => {
  const n = parseFloat(v.replace(/,/g, "")) || 0;
  return unit === "thousand" ? n * 1000 : n;
};

/** Compute annual SGA total: if manual value set, use it; otherwise derive from targets */
export const computeAnnualSgaTotal = (s: PlanSettings): number => {
  if (s.annual_sga_total > 0) return s.annual_sga_total;
  // Derive: annual_revenue × gross_profit_rate% - annual_revenue × operating_profit_rate%
  const gp = s.annual_revenue_target * (s.gross_profit_rate / 100);
  const op = s.annual_revenue_target * (s.operating_profit_rate / 100);
  return gp - op;
};

/** Get SGA cell value: override first, then auto-calc from monthly SGA budget (GP - OP) */
export const getSgaCellValue = (
  s: PlanSettings,
  ym: string,
  catId: string,
  _annualSga: number,
  months?: string[]
): { value: number; isOverride: boolean } => {
  const override = s.monthly_sga_overrides?.[ym]?.[catId];
  if (override !== undefined && override !== null) {
    return { value: override, isOverride: true };
  }
  const rate = s.sga_allocation_rates?.[catId] ?? 0;

  // Monthly SGA budget = monthly GP - monthly OP (same as TabSalesPlan sgaPlan)
  const dist = s.monthly_revenue_distribution ?? [];
  const monthIndex = months ? months.indexOf(ym) : -1;
  const monthlyRevenue = monthIndex >= 0 && monthIndex < dist.length ? dist[monthIndex] : 0;
  const equalRevenue = s.distribution_mode === "equal"
    ? s.annual_revenue_target / (months?.length || 12)
    : monthlyRevenue;
  const rev = s.distribution_mode === "equal" ? equalRevenue : monthlyRevenue;
  const gpPlan = rev * ((s.gross_profit_rate ?? 70) / 100);
  const opPlan = rev * ((s.operating_profit_rate ?? 20) / 100);
  const sgaBudget = gpPlan - opPlan;
  const autoValue = sgaBudget * (rate / 100);

  return { value: autoValue, isOverride: false };
};
