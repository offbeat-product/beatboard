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
}

export const DEFAULT_SGA_CATEGORIES: SgaCategory[] = [
  { id: "personnel", name: "人件費（給与・賞与）", order: 1 },
  { id: "welfare", name: "法定福利費・福利厚生費", order: 2 },
  { id: "rent", name: "地代家賃", order: 3 },
  { id: "telecom", name: "通信費・サブスク", order: 4 },
  { id: "outsource", name: "外注費（販管費側）", order: 5 },
  { id: "advertising", name: "広告宣伝費", order: 6 },
  { id: "travel", name: "旅費交通費", order: 7 },
  { id: "other", name: "その他", order: 8 },
];

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
});

/* ── Helpers ── */
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
