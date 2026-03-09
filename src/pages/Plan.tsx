import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, getMonthLabel, ORG_ID, CURRENT_MONTH } from "@/lib/fiscalYear";
import { SGA_CATEGORIES, SGA_CATEGORY_NAMES } from "@/hooks/useManagementData";
import { toast } from "sonner";
import { Save, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

/* ── Types ── */
interface StaffingRow {
  month: string;
  fullTimeCount: number;
  partTimeCount: number;
  fullTimeHours: number;
  partTimeTotalHours: number;
}

interface PlanSettings {
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
}

const DEFAULT_STAFFING = (months: string[]): StaffingRow[] =>
  months.map((m) => {
    const [, mm] = m.split("-").map(Number);
    const isLaterPeriod = (mm >= 2 && mm <= 4);
    return {
      month: m,
      fullTimeCount: isLaterPeriod ? 2 : 3,
      partTimeCount: isLaterPeriod ? 3 : 0,
      fullTimeHours: 160,
      partTimeTotalHours: isLaterPeriod ? 260 : 0,
    };
  });

const DEFAULT_HALF_YEAR_DIST = (months: string[], annualTarget: number): number[] => {
  const firstHalf = annualTarget * 0.4; // 30M of 75M
  const secondHalf = annualTarget * 0.6; // 45M of 75M
  return months.map((m) => {
    const mm = parseInt(m.split("-")[1], 10);
    return mm >= 5 && mm <= 10 ? firstHalf / 6 : secondHalf / 6;
  });
};

const DEFAULT_SETTINGS = (months: string[]): PlanSettings => ({
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
});

/* ── Helpers ── */
const fmtNum = (v: number, unit: string, isGph = false) => {
  if (isGph) return `¥${Math.round(v).toLocaleString()}`;
  if (unit === "thousand") return `¥${Math.round(v / 1000).toLocaleString()}千`;
  return `¥${Math.round(v).toLocaleString()}`;
};

const fmtInputVal = (v: number, unit: string) => {
  if (unit === "thousand") return Math.round(v / 1000);
  return v;
};

const parseInputVal = (v: string, unit: string) => {
  const n = parseFloat(v.replace(/,/g, "")) || 0;
  return unit === "thousand" ? n * 1000 : n;
};

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

/* ── STEP1: KPI Input ── */
function Step1KpiInput({ fiscalYear, months, settings, setSettings, onSave, saving }: {
  fiscalYear: string;
  months: string[];
  settings: PlanSettings;
  setSettings: (s: PlanSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { unit } = useCurrencyUnit();
  const [open, setOpen] = useState(false);
  const [firstHalfTarget, setFirstHalfTarget] = useState(30000000);
  const [secondHalfTarget, setSecondHalfTarget] = useState(45000000);

  // Sync half-year targets from distribution when loading
  useEffect(() => {
    if (settings.distribution_mode === "half_year" && settings.monthly_revenue_distribution.length === 12) {
      const fh = settings.monthly_revenue_distribution.slice(0, 6).reduce((s, v) => s + v, 0);
      const sh = settings.monthly_revenue_distribution.slice(6, 12).reduce((s, v) => s + v, 0);
      if (fh > 0 || sh > 0) {
        setFirstHalfTarget(fh);
        setSecondHalfTarget(sh);
      }
    }
  }, [settings.distribution_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: keyof PlanSettings, value: any) => {
    const next = { ...settings, [field]: value };
    // Auto-calc gross_profit_rate
    if (field === "cost_rate") {
      next.gross_profit_rate = 100 - (value as number);
    }
    setSettings(next);
  };

  const sgaRatesSum = settings.recruitment_rate + settings.office_rate + settings.marketing_rate + settings.it_rate + settings.professional_rate + settings.other_rate;
  const sgaRatesValid = Math.abs(sgaRatesSum - 100) < 0.1;

  const monthlyRevenues = useMemo(() => {
    if (settings.distribution_mode === "equal") {
      return months.map(() => settings.annual_revenue_target / 12);
    }
    return settings.monthly_revenue_distribution;
  }, [settings, months]);

  const distSum = settings.distribution_mode === "manual"
    ? settings.monthly_revenue_distribution.reduce((s, v) => s + v, 0)
    : settings.distribution_mode === "half_year"
    ? firstHalfTarget + secondHalfTarget
    : settings.annual_revenue_target;
  const distValid = settings.distribution_mode === "equal" || Math.abs(distSum - settings.annual_revenue_target) < 1;

  // Customer metrics auto-calc
  const annualClientUnitPrice = settings.annual_client_target > 0 ? settings.annual_revenue_target / settings.annual_client_target : 0;
  const annualProjectUnitPrice = settings.annual_project_target > 0 ? settings.annual_revenue_target / settings.annual_project_target : 0;

  const applyHalfYearDist = (fh: number, sh: number) => {
    const newDist = months.map((m) => {
      const mm = parseInt(m.split("-")[1], 10);
      return mm >= 5 && mm <= 10 ? fh / 6 : sh / 6;
    });
    update("monthly_revenue_distribution", newDist);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold">年間KPI設定</h3>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {open ? <><ChevronUp className="h-4 w-4 mr-1" />閉じる</> : <><Pencil className="h-4 w-4 mr-1" />編集</>}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-6">
            {/* Revenue & Profit */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">売上・利益目標</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">年間売上目標 ({unit === "thousand" ? "千円" : "円"})</Label>
                  <Input type="text" value={fmtInputVal(settings.annual_revenue_target, unit).toLocaleString()} onChange={(e) => update("annual_revenue_target", parseInputVal(e.target.value, unit))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">目標原価率 (%)</Label>
                  <Input type="number" value={settings.cost_rate} onChange={(e) => update("cost_rate", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">目標粗利率 (自動計算)</Label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{settings.gross_profit_rate.toFixed(1)}%</div>
                </div>
                <div>
                  <Label className="text-xs">目標営業利益率 (%)</Label>
                  <Input type="number" value={settings.operating_profit_rate} onChange={(e) => update("operating_profit_rate", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">販管費率 (自動計算)</Label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{(settings.gross_profit_rate - settings.operating_profit_rate).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Customer Metrics */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">顧客指標目標</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">年間取引顧客数目標 (社)</Label>
                  <Input type="number" value={settings.annual_client_target} onChange={(e) => update("annual_client_target", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">年間顧客単価目標 (自動計算)</Label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{fmtNum(annualClientUnitPrice, unit)}</div>
                </div>
                <div>
                  <Label className="text-xs">年間案件数目標 (件)</Label>
                  <Input type="number" value={settings.annual_project_target} onChange={(e) => update("annual_project_target", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">年間案件単価目標 (自動計算)</Label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{fmtNum(annualProjectUnitPrice, unit)}</div>
                </div>
              </div>
            </div>

            {/* SGA Allocation */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">販管費配分</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">人件費率 (対粗利%)</Label>
                  <Input type="number" value={settings.personnel_cost_rate} onChange={(e) => update("personnel_cost_rate", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">残り販管費の配分 (合計100%): <span className={cn(sgaRatesValid ? "text-green-600" : "text-destructive", "font-semibold")}>{sgaRatesSum.toFixed(1)}%</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {([["recruitment_rate", "採用費"], ["office_rate", "オフィス費"], ["marketing_rate", "広告宣伝"], ["it_rate", "IT"], ["professional_rate", "専門家"], ["other_rate", "その他"]] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs">{label} (%)</Label>
                    <Input type="number" value={(settings as any)[key]} onChange={(e) => update(key, parseFloat(e.target.value) || 0)} className="mt-1 h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>

            {/* Staffing Plan */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">人員計画</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">月</TableHead>
                      <TableHead className="text-xs text-center">正社員数</TableHead>
                      <TableHead className="text-xs text-center">パート数</TableHead>
                      <TableHead className="text-xs text-center">正社員h/月</TableHead>
                      <TableHead className="text-xs text-center">パート合計h/月</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.staffing_plan.map((row, i) => (
                      <TableRow key={row.month}>
                        <TableCell className="text-xs font-medium">{getMonthLabel(row.month)}</TableCell>
                        {(["fullTimeCount", "partTimeCount", "fullTimeHours", "partTimeTotalHours"] as const).map((f) => (
                          <TableCell key={f} className="p-1">
                            <Input
                              type="number"
                              value={row[f]}
                              onChange={(e) => {
                                const newPlan = [...settings.staffing_plan];
                                newPlan[i] = { ...newPlan[i], [f]: parseFloat(e.target.value) || 0 };
                                update("staffing_plan", newPlan);
                              }}
                              className="h-7 text-xs text-center w-20 mx-auto"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Productivity Targets */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">生産性目標</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">粗利工数単価目標 (円)</Label>
                  <Input type="number" value={settings.gp_per_hour_target} onChange={(e) => update("gp_per_hour_target", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">案件粗利工数単価目標 (円)</Label>
                  <Input type="number" value={settings.gp_per_project_hour_target} onChange={(e) => update("gp_per_project_hour_target", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Quality Targets */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">品質目標</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">納期遵守率目標 (%)</Label>
                  <Input type="number" value={settings.on_time_delivery_target} onChange={(e) => update("on_time_delivery_target", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">修正発生率目標 (%)</Label>
                  <Input type="number" value={settings.revision_rate_target} onChange={(e) => update("revision_rate_target", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Revenue Distribution */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">売上月別配分</h4>
              <div className="flex items-center gap-3 mb-2">
                <Select value={settings.distribution_mode} onValueChange={(v) => {
                  const next = { ...settings, distribution_mode: v };
                  if (v === "equal") {
                    next.monthly_revenue_distribution = months.map(() => settings.annual_revenue_target / 12);
                  } else if (v === "half_year") {
                    const fh = firstHalfTarget;
                    const sh = secondHalfTarget;
                    next.monthly_revenue_distribution = months.map((m) => {
                      const mm = parseInt(m.split("-")[1], 10);
                      return mm >= 5 && mm <= 10 ? fh / 6 : sh / 6;
                    });
                  }
                  setSettings(next);
                }}>
                  <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">均等割</SelectItem>
                    <SelectItem value="half_year">半期別</SelectItem>
                    <SelectItem value="manual">手動入力</SelectItem>
                  </SelectContent>
                </Select>
                {(settings.distribution_mode === "manual" || settings.distribution_mode === "half_year") && (
                  <span className={cn("text-xs font-medium", distValid ? "text-green-600" : "text-destructive")}>
                    合計: {fmtNum(distSum, unit)} / {fmtNum(settings.annual_revenue_target, unit)}
                  </span>
                )}
              </div>
              {settings.distribution_mode === "half_year" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <Label className="text-xs">上半期目標（5月〜10月）({unit === "thousand" ? "千円" : "円"})</Label>
                    <Input
                      type="text"
                      value={fmtInputVal(firstHalfTarget, unit).toLocaleString()}
                      onChange={(e) => {
                        const v = parseInputVal(e.target.value, unit);
                        setFirstHalfTarget(v);
                        applyHalfYearDist(v, secondHalfTarget);
                      }}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">下半期目標（11月〜4月）({unit === "thousand" ? "千円" : "円"})</Label>
                    <Input
                      type="text"
                      value={fmtInputVal(secondHalfTarget, unit).toLocaleString()}
                      onChange={(e) => {
                        const v = parseInputVal(e.target.value, unit);
                        setSecondHalfTarget(v);
                        applyHalfYearDist(firstHalfTarget, v);
                      }}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
              )}
              {settings.distribution_mode === "manual" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {months.map((m, i) => (
                    <div key={m}>
                      <Label className="text-xs">{getMonthLabel(m)}</Label>
                      <Input
                        type="text"
                        value={fmtInputVal(settings.monthly_revenue_distribution[i] || 0, unit).toLocaleString()}
                        onChange={(e) => {
                          const newDist = [...settings.monthly_revenue_distribution];
                          newDist[i] = parseInputVal(e.target.value, unit);
                          update("monthly_revenue_distribution", newDist);
                        }}
                        className="h-7 text-xs mt-1"
                      />
                    </div>
                  ))}
                </div>
              )}
              {settings.distribution_mode !== "manual" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {months.map((m, i) => {
                    const val = settings.distribution_mode === "equal"
                      ? settings.annual_revenue_target / 12
                      : (settings.monthly_revenue_distribution[i] || 0);
                    return (
                      <div key={m}>
                        <Label className="text-xs text-muted-foreground">{getMonthLabel(m)}</Label>
                        <div className="mt-1 h-7 flex items-center px-2 rounded-md bg-muted text-xs font-medium">{fmtNum(val, unit)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving || !sgaRatesValid || !distValid}>
                <Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ── STEP2: Monthly Plan Table ── */
function Step2MonthlyPlanTable({ months, settings, fiscalYear }: {
  months: string[];
  settings: PlanSettings;
  fiscalYear: string;
}) {
  const { unit } = useCurrencyUnit();

  // Fetch actual data
  const salesQuery = useQuery({
    queryKey: ["plan_actual_sales", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_sales").select("year_month, revenue, cost, cost_total, gross_profit").eq("org_id", ORG_ID).in("year_month", months);
      if (error) throw error;
      return data;
    },
  });

  const freeeQuery = useQuery({
    queryKey: ["plan_actual_freee", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("freee_monthly_pl").select("year_month, sga_total, sga_details").eq("org_id", ORG_ID).in("year_month", months);
      if (error) throw error;
      return data;
    },
  });

  const kpiQuery = useQuery({
    queryKey: ["plan_actual_kpi", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("kpi_snapshots").select("snapshot_date, metric_name, actual_value").eq("org_id", ORG_ID).in("metric_name", ["total_labor_hours", "project_hours", "gross_profit_per_hour", "gross_profit_per_project_hour"]);
      if (error) throw error;
      return data;
    },
  });

  const projectPlQuery = useQuery({
    queryKey: ["plan_actual_projectpl", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_pl").select("year_month, revenue, gross_profit, client_id, project_id").eq("org_id", ORG_ID).in("year_month", months).not("client_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const qualityQuery = useQuery({
    queryKey: ["plan_actual_quality", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_monthly").select("*").eq("org_id", ORG_ID).in("year_month", months);
      if (error) throw error;
      return data;
    },
  });

  const sales = salesQuery.data ?? [];
  const freeeData = freeeQuery.data ?? [];
  const kpiData = kpiQuery.data ?? [];
  const projectPl = projectPlQuery.data ?? [];
  const qualityData = qualityQuery.data ?? [];

  const isLoading = salesQuery.isLoading || freeeQuery.isLoading || kpiQuery.isLoading || projectPlQuery.isLoading || qualityQuery.isLoading;

  // Customer metrics plan values
  const annualClientUnitPrice = settings.annual_client_target > 0 ? settings.annual_revenue_target / settings.annual_client_target : 0;
  const annualProjectUnitPrice = settings.annual_project_target > 0 ? settings.annual_revenue_target / settings.annual_project_target : 0;
  const monthlyProjectTargetAvg = settings.annual_project_target / 12;

  // Plan calculations per month
  const monthlyPlans = useMemo(() => {
    return months.map((ym, i) => {
      const revPlan = settings.distribution_mode === "equal"
        ? settings.annual_revenue_target / 12
        : (settings.monthly_revenue_distribution[i] || 0);
      const costPlan = revPlan * (settings.cost_rate / 100);
      const gpPlan = revPlan - costPlan;
      const gpRatePlan = settings.gross_profit_rate;
      const sgaPlan = gpPlan - revPlan * (settings.operating_profit_rate / 100);
      const opPlan = revPlan * (settings.operating_profit_rate / 100);

      // SGA breakdown plan
      const personnelPlan = gpPlan * (settings.personnel_cost_rate / 100);
      const remainingSga = sgaPlan - personnelPlan;
      const sgaBreakdown: Record<string, number> = {
        "人件費": personnelPlan,
        "採用費": remainingSga * (settings.recruitment_rate / 100),
        "オフィス費": remainingSga * (settings.office_rate / 100),
        "広告宣伝・営業活動費": remainingSga * (settings.marketing_rate / 100),
        "IT・システム費": remainingSga * (settings.it_rate / 100),
        "専門家・税務費": remainingSga * (settings.professional_rate / 100),
        "その他": remainingSga * (settings.other_rate / 100),
      };

      // Staffing
      const staff = settings.staffing_plan[i] || { fullTimeCount: 0, partTimeCount: 0, fullTimeHours: 160, partTimeTotalHours: 0 };
      const totalHoursPlan = staff.fullTimeCount * staff.fullTimeHours + staff.partTimeTotalHours;
      const internalHours = staff.fullTimeCount * 40 + staff.partTimeCount * 20;
      const projectHoursPlan = totalHoursPlan - internalHours;
      const gphPlan = totalHoursPlan > 0 ? gpPlan / totalHoursPlan : 0;
      const projectGphPlan = projectHoursPlan > 0 ? gpPlan / projectHoursPlan : 0;

      // Actuals
      const salesRow = sales.filter(s => s.year_month === ym);
      const revActual = salesRow.reduce((s, r) => s + (r.revenue || 0), 0);
      const costActual = salesRow.reduce((s, r) => s + Number(r.cost_total ?? r.cost ?? 0), 0);
      const gpActual = salesRow.reduce((s, r) => s + (r.gross_profit || 0), 0);
      const gpRateActual = revActual > 0 ? (gpActual / revActual) * 100 : 0;

      const freeeRow = freeeData.find(f => f.year_month === ym);
      const sgaActual = freeeRow?.sga_total ? Number(freeeRow.sga_total) : 0;
      const sgaDetailBreakdown = classifySgaDetails(freeeRow?.sga_details);
      const opActual = gpActual - sgaActual;
      const opRateActual = revActual > 0 ? (opActual / revActual) * 100 : 0;

      const findKpi = (metric: string) => kpiData.find(k => k.snapshot_date.startsWith(ym) && k.metric_name === metric)?.actual_value ?? null;
      const totalHoursActual = findKpi("total_labor_hours");
      const projectHoursActual = findKpi("project_hours");
      const gphActual = findKpi("gross_profit_per_hour");
      const projectGphActual = findKpi("gross_profit_per_project_hour");

      const monthProjectPl = projectPl.filter(r => r.year_month === ym && Number(r.revenue ?? 0) > 0);
      const clientCount = new Set(monthProjectPl.map(r => r.client_id)).size;
      const projectCount = monthProjectPl.length;
      const plRevenue = monthProjectPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
      const clientAvg = clientCount > 0 ? plRevenue / clientCount : 0;
      const projectAvg = projectCount > 0 ? plRevenue / projectCount : 0;

      const qualTotal = qualityData.find(r => r.year_month === ym && r.client_id === "__total__");
      const onTimeRate = qualTotal && qualTotal.total_deliveries ? ((qualTotal.on_time_deliveries ?? 0) / qualTotal.total_deliveries) * 100 : null;
      const revisionRate = qualTotal && qualTotal.total_deliveries ? ((qualTotal.revision_count ?? 0) / qualTotal.total_deliveries) * 100 : null;

      const hasActual = ym <= CURRENT_MONTH && revActual > 0;

      return {
        ym, revPlan, costPlan, gpPlan, gpRatePlan, sgaPlan, opPlan, sgaBreakdown,
        staff, totalHoursPlan, projectHoursPlan, gphPlan, projectGphPlan,
        revActual, costActual, gpActual, gpRateActual, sgaActual, sgaDetailBreakdown, opActual, opRateActual,
        totalHoursActual, projectHoursActual, gphActual, projectGphActual,
        clientCount, clientAvg, projectCount, projectAvg,
        onTimeRate, revisionRate, hasActual,
      };
    });
  }, [months, settings, sales, freeeData, kpiData, projectPl, qualityData]);

  // Totals
  const totals = useMemo(() => {
    const sumPlan = (field: string) => monthlyPlans.reduce((s, m) => s + ((m as any)[field] || 0), 0);
    const sumActual = (field: string) => monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + ((m as any)[field] || 0), 0);
    const monthsWithActual = monthlyPlans.filter(m => m.hasActual).length;

    // Customer totals across all months with actuals
    const allActualProjectPl = projectPl.filter(r => {
      const ym = r.year_month;
      return months.includes(ym) && Number(r.revenue ?? 0) > 0;
    });
    const totalUniqueClients = new Set(allActualProjectPl.map(r => r.client_id)).size;
    const totalProjectCount = allActualProjectPl.length;
    const totalPlRevenue = allActualProjectPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    const totalClientAvg = totalUniqueClients > 0 ? totalPlRevenue / totalUniqueClients : 0;
    const totalProjectAvg = totalProjectCount > 0 ? totalPlRevenue / totalProjectCount : 0;

    return { sumPlan, sumActual, monthsWithActual, totalUniqueClients, totalProjectCount, totalClientAvg, totalProjectAvg };
  }, [monthlyPlans, projectPl, months]);

  // Landing forecast
  const monthsElapsed = totals.monthsWithActual;
  const revActualSum = totals.sumActual("revActual");
  const gpActualSum = totals.sumActual("gpActual");
  const opActualSum = totals.sumActual("opActual");
  const revForecast = monthsElapsed > 0 ? (revActualSum / monthsElapsed) * 12 : 0;
  const gpForecast = monthsElapsed > 0 ? (gpActualSum / monthsElapsed) * 12 : 0;
  const opForecast = monthsElapsed > 0 ? (opActualSum / monthsElapsed) * 12 : 0;

  const fmtC = (v: number, isGph = false) => fmtNum(v, unit, isGph);
  const fmtP = (v: number | null) => v !== null ? `${v.toFixed(1)}%` : "—";

  type RowDef = {
    label: string;
    section?: boolean;
    planKey?: string;
    actualKey?: string;
    showDiff?: boolean;
    isRate?: boolean;
    isGph?: boolean;
    isCount?: boolean;
    invertDiff?: boolean;
    planOnly?: boolean;
    actualOnly?: boolean;
    customerPlanValue?: string; // for customer metrics plan display
  };

  const rows: RowDef[] = [
    { label: "売上・利益", section: true },
    { label: "売上", planKey: "revPlan", actualKey: "revActual", showDiff: true },
    { label: "原価", planKey: "costPlan", actualKey: "costActual", showDiff: true, invertDiff: true },
    { label: "粗利", planKey: "gpPlan", actualKey: "gpActual", showDiff: true },
    { label: "粗利率", planKey: "gpRatePlan", actualKey: "gpRateActual", isRate: true },
    { label: "販管費", section: true },
    { label: "販管費合計", planKey: "sgaPlan", actualKey: "sgaActual", showDiff: true, invertDiff: true },
    { label: "営業利益", planKey: "opPlan", actualKey: "opActual", showDiff: true },
    { label: "営業利益率", planKey: undefined, actualKey: "opRateActual", isRate: true },
    { label: "生産性", section: true },
    { label: "正社員数", planOnly: true, isCount: true },
    { label: "パート数", planOnly: true, isCount: true },
    { label: "総労働時間", planKey: "totalHoursPlan", actualKey: "totalHoursActual", isGph: true },
    { label: "案件工数", planKey: "projectHoursPlan", actualKey: "projectHoursActual", isGph: true },
    { label: "粗利工数単価", planKey: "gphPlan", actualKey: "gphActual", isGph: true },
    { label: "案件粗利工数単価", planKey: "projectGphPlan", actualKey: "projectGphActual", isGph: true },
    { label: "顧客", section: true, sectionNote: "※顧客数・顧客単価は年間目標" },
    { label: "顧客数", customerPlanValue: "clientTarget", actualKey: "clientCount", isCount: true },
    { label: "顧客単価", customerPlanValue: "clientUnitPrice", actualKey: "clientAvg" },
    { label: "案件数", customerPlanValue: "projectTarget", actualKey: "projectCount", isCount: true },
    { label: "案件単価", customerPlanValue: "projectUnitPrice", actualKey: "projectAvg" },
    { label: "品質", section: true },
    { label: "納期遵守率", isRate: true, actualKey: "onTimeRate" },
    { label: "修正発生率", isRate: true, actualKey: "revisionRate" },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">読み込み中...</div>;
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold">月次事業計画</h3>
      </div>
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[120px] text-xs">項目</TableHead>
              <TableHead className="sticky left-[120px] bg-card z-10 min-w-[50px] text-xs">種別</TableHead>
              {months.map(m => (
                <TableHead key={m} className="text-center text-xs min-w-[90px]">{getMonthLabel(m)}</TableHead>
              ))}
              <TableHead className="text-center text-xs min-w-[100px] bg-muted/50">通期合計</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              if (row.section) {
                return (
                  <TableRow key={row.label}>
                    <TableCell colSpan={months.length + 3} className="font-semibold text-xs bg-muted/50 border-l-4 border-l-primary">
                      {row.label}
                    </TableCell>
                  </TableRow>
                );
              }

              // Customer metrics rows have plan + actual
              const isCustomerMetric = !!row.customerPlanValue;
              const subRows: { type: string; bgClass: string }[] = [];
              if (isCustomerMetric) {
                subRows.push({ type: "計画", bgClass: "bg-blue-50/50 dark:bg-blue-950/20" });
                subRows.push({ type: "実績", bgClass: "" });
              } else if (row.actualOnly) {
                subRows.push({ type: "実績", bgClass: "" });
              } else {
                if (!row.actualOnly) subRows.push({ type: "計画", bgClass: "bg-blue-50/50 dark:bg-blue-950/20" });
                if (!row.planOnly) subRows.push({ type: "実績", bgClass: "" });
                if (row.showDiff) subRows.push({ type: "差異", bgClass: "" });
              }

              return subRows.map((sub, si) => (
                <TableRow key={`${row.label}-${sub.type}`} className={sub.bgClass}>
                  {si === 0 && (
                    <TableCell rowSpan={subRows.length} className="sticky left-0 bg-card z-10 font-medium border-r">
                      {row.label}
                    </TableCell>
                  )}
                  <TableCell className={cn("sticky left-[120px] bg-card z-10 text-muted-foreground border-r", sub.bgClass)}>
                    {sub.type}
                  </TableCell>
                  {months.map((_, mi) => {
                    const mp = monthlyPlans[mi];
                    let val: string = "—";

                    if (sub.type === "計画") {
                      if (isCustomerMetric) {
                        // Customer metrics plan
                        if (row.customerPlanValue === "clientTarget") val = `${settings.annual_client_target}社`;
                        else if (row.customerPlanValue === "clientUnitPrice") val = fmtC(annualClientUnitPrice);
                        else if (row.customerPlanValue === "projectTarget") val = `${Math.round(monthlyProjectTargetAvg)}件`;
                        else if (row.customerPlanValue === "projectUnitPrice") val = fmtC(annualProjectUnitPrice);
                      } else if (row.label === "正社員数") val = String(mp.staff.fullTimeCount);
                      else if (row.label === "パート数") val = String(mp.staff.partTimeCount);
                      else if (row.label === "営業利益率") val = `${settings.operating_profit_rate}%`;
                      else if (row.label === "納期遵守率") val = `${settings.on_time_delivery_target}%`;
                      else if (row.label === "修正発生率") val = `${settings.revision_rate_target}%`;
                      else if (row.planKey) {
                        const pv = (mp as any)[row.planKey];
                        val = row.isRate ? `${pv.toFixed(1)}%` : row.isGph ? `${Math.round(pv).toLocaleString()}h` : fmtC(pv);
                        if (row.label === "粗利工数単価" || row.label === "案件粗利工数単価") val = fmtC(pv, true);
                        if (row.label === "総労働時間" || row.label === "案件工数") val = `${Math.round(pv).toLocaleString()}h`;
                      }
                    } else if (sub.type === "実績") {
                      if (!mp.hasActual && !isCustomerMetric) { val = "—"; }
                      else if (row.label === "顧客数") val = mp.clientCount > 0 ? `${mp.clientCount}社` : "—";
                      else if (row.label === "案件数") val = mp.projectCount > 0 ? `${mp.projectCount}件` : "—";
                      else if (row.label === "顧客単価") val = mp.clientCount > 0 ? fmtC(mp.clientAvg) : "—";
                      else if (row.label === "案件単価") val = mp.projectCount > 0 ? fmtC(mp.projectAvg) : "—";
                      else if (row.actualKey) {
                        const av = (mp as any)[row.actualKey];
                        if (av === null || av === undefined) val = "—";
                        else if (row.isRate) val = `${av.toFixed(1)}%`;
                        else if (row.label === "総労働時間" || row.label === "案件工数") val = `${Math.round(av).toLocaleString()}h`;
                        else if (row.label === "粗利工数単価" || row.label === "案件粗利工数単価") val = fmtC(av, true);
                        else val = fmtC(av);
                      }
                    } else if (sub.type === "差異") {
                      if (!mp.hasActual) { val = "—"; }
                      else if (row.planKey && row.actualKey) {
                        const pv = (mp as any)[row.planKey];
                        const av = (mp as any)[row.actualKey];
                        if (av !== null && av !== undefined) {
                          const diff = av - pv;
                          val = fmtC(diff);
                        }
                      }
                    }

                    // Color for diff
                    let cellClass = "text-center";
                    if (sub.type === "差異" && mp.hasActual && row.planKey && row.actualKey) {
                      const pv = (mp as any)[row.planKey];
                      const av = (mp as any)[row.actualKey];
                      if (av !== null && av !== undefined) {
                        const diff = av - pv;
                        if (row.invertDiff) {
                          cellClass = cn(cellClass, diff <= 0 ? "text-green-600" : "text-destructive");
                        } else {
                          cellClass = cn(cellClass, diff >= 0 ? "text-green-600" : "text-destructive");
                        }
                      }
                    }

                    return <TableCell key={mi} className={cellClass}>{val}</TableCell>;
                  })}

                  {/* Total column */}
                  <TableCell className="text-center bg-muted/30 font-medium">
                    {(() => {
                      if (sub.type === "計画") {
                        if (isCustomerMetric) {
                          if (row.customerPlanValue === "clientTarget") return `${settings.annual_client_target}社`;
                          if (row.customerPlanValue === "clientUnitPrice") return fmtC(annualClientUnitPrice);
                          if (row.customerPlanValue === "projectTarget") return `${settings.annual_project_target}件`;
                          if (row.customerPlanValue === "projectUnitPrice") return fmtC(annualProjectUnitPrice);
                        }
                        if (row.isRate || row.isCount || row.label === "正社員数" || row.label === "パート数" || row.label === "営業利益率" || row.label === "納期遵守率" || row.label === "修正発生率") return "—";
                        if (row.planKey) {
                          const total = monthlyPlans.reduce((s, m) => s + ((m as any)[row.planKey!] || 0), 0);
                          if (row.label === "総労働時間" || row.label === "案件工数") return `${Math.round(total).toLocaleString()}h`;
                          if (row.isGph) return "—";
                          return fmtC(total);
                        }
                        return "—";
                      } else if (sub.type === "実績") {
                        if (isCustomerMetric) {
                          if (row.label === "顧客数") return totals.totalUniqueClients > 0 ? `${totals.totalUniqueClients}社` : "—";
                          if (row.label === "顧客単価") return totals.totalClientAvg > 0 ? fmtC(totals.totalClientAvg) : "—";
                          if (row.label === "案件数") return totals.totalProjectCount > 0 ? `${totals.totalProjectCount}件` : "—";
                          if (row.label === "案件単価") return totals.totalProjectAvg > 0 ? fmtC(totals.totalProjectAvg) : "—";
                        }
                        if (row.isRate || row.isCount || row.actualOnly) return "—";
                        if (row.actualKey && !row.isGph) {
                          const total = monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + ((m as any)[row.actualKey!] || 0), 0);
                          if (row.label === "総労働時間" || row.label === "案件工数") return `${Math.round(total).toLocaleString()}h`;
                          return fmtC(total);
                        }
                        return "—";
                      } else {
                        // Diff total
                        if (row.planKey && row.actualKey && !row.isRate && !row.isGph) {
                          const planTotal = monthlyPlans.reduce((s, m) => s + ((m as any)[row.planKey!] || 0), 0);
                          const actualTotal = monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + ((m as any)[row.actualKey!] || 0), 0);
                          const diff = actualTotal - planTotal;
                          const color = row.invertDiff ? (diff <= 0 ? "text-green-600" : "text-destructive") : (diff >= 0 ? "text-green-600" : "text-destructive");
                          return <span className={color}>{fmtC(diff)}</span>;
                        }
                        return "—";
                      }
                    })()}
                  </TableCell>
                </TableRow>
              ));
            })}

            {/* Landing forecast */}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={months.length + 2} className="sticky left-0 bg-muted/50 z-10 font-semibold text-xs border-l-4 border-l-primary">着地予測</TableCell>
              <TableCell />
            </TableRow>
            {[
              { label: "売上着地予測", value: revForecast },
              { label: "粗利着地予測", value: gpForecast },
              { label: "営業利益着地予測", value: opForecast },
            ].map(f => (
              <TableRow key={f.label}>
                <TableCell className="sticky left-0 bg-card z-10 font-medium border-r">{f.label}</TableCell>
                <TableCell className="sticky left-[120px] bg-card z-10 text-muted-foreground border-r">予測</TableCell>
                {months.map((_, i) => <TableCell key={i} className="text-center text-muted-foreground">—</TableCell>)}
                <TableCell className="text-center bg-muted/30 font-semibold">{monthsElapsed > 0 ? fmtC(f.value) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ── Main Page ── */
const Plan = () => {
  usePageTitle("事業計画");
  const [fyTab, setFyTab] = useState("2026");
  const fyEndYear = parseInt(fyTab);
  const months = useMemo(() => getFiscalYearMonths(fyEndYear), [fyEndYear]);
  const fiscalYear = `${fyEndYear}年4月期`;

  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS(months));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load settings from DB
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("plan_settings" as any)
        .select("*")
        .eq("org_id", ORG_ID)
        .eq("fiscal_year", fiscalYear)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setSettings({
          annual_revenue_target: Number(d.annual_revenue_target) || 0,
          cost_rate: Number(d.cost_rate) || 30,
          gross_profit_rate: Number(d.gross_profit_rate) || 70,
          operating_profit_rate: Number(d.operating_profit_rate) || 20,
          personnel_cost_rate: Number(d.personnel_cost_rate) || 50,
          recruitment_rate: Number(d.recruitment_rate) || 15,
          office_rate: Number(d.office_rate) || 35,
          marketing_rate: Number(d.marketing_rate) || 20,
          it_rate: Number(d.it_rate) || 15,
          professional_rate: Number(d.professional_rate) || 10,
          other_rate: Number(d.other_rate) || 5,
          gp_per_hour_target: Number(d.gp_per_hour_target) || 21552,
          gp_per_project_hour_target: Number(d.gp_per_project_hour_target) || 25000,
          on_time_delivery_target: Number(d.on_time_delivery_target) || 95,
          revision_rate_target: Number(d.revision_rate_target) || 20,
          staffing_plan: Array.isArray(d.staffing_plan) && d.staffing_plan.length > 0 ? d.staffing_plan : DEFAULT_STAFFING(months),
          monthly_revenue_distribution: Array.isArray(d.monthly_revenue_distribution) && d.monthly_revenue_distribution.length > 0 ? d.monthly_revenue_distribution : DEFAULT_HALF_YEAR_DIST(months, Number(d.annual_revenue_target) || 75000000),
          distribution_mode: d.distribution_mode || "half_year",
          annual_client_target: Number(d.annual_client_target) || 30,
          annual_project_target: Number(d.annual_project_target) || 250,
        });
      } else {
        setSettings(DEFAULT_SETTINGS(months));
      }
      setLoaded(true);
    })();
  }, [fyTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert plan_settings
      const payload = {
        org_id: ORG_ID,
        fiscal_year: fiscalYear,
        annual_revenue_target: settings.annual_revenue_target,
        cost_rate: settings.cost_rate,
        gross_profit_rate: settings.gross_profit_rate,
        operating_profit_rate: settings.operating_profit_rate,
        personnel_cost_rate: settings.personnel_cost_rate,
        recruitment_rate: settings.recruitment_rate,
        office_rate: settings.office_rate,
        marketing_rate: settings.marketing_rate,
        it_rate: settings.it_rate,
        professional_rate: settings.professional_rate,
        other_rate: settings.other_rate,
        gp_per_hour_target: settings.gp_per_hour_target,
        gp_per_project_hour_target: settings.gp_per_project_hour_target,
        on_time_delivery_target: settings.on_time_delivery_target,
        revision_rate_target: settings.revision_rate_target,
        staffing_plan: settings.staffing_plan,
        monthly_revenue_distribution: settings.monthly_revenue_distribution,
        distribution_mode: settings.distribution_mode,
        annual_client_target: settings.annual_client_target,
        annual_project_target: settings.annual_project_target,
        updated_at: new Date().toISOString(),
      };

      // Try update first, then insert
      const { data: existing } = await supabase
        .from("plan_settings" as any)
        .select("id")
        .eq("org_id", ORG_ID)
        .eq("fiscal_year", fiscalYear)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase.from("plan_settings" as any) as any).update(payload).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("plan_settings" as any) as any).insert(payload);
        if (error) throw error;
      }

      // Also save monthly targets to targets table
      const monthlyRevenues = settings.distribution_mode === "equal"
        ? months.map(() => settings.annual_revenue_target / 12)
        : settings.monthly_revenue_distribution;

      await supabase.from("targets").delete().eq("org_id", ORG_ID).in("year_month", months);
      const targetInserts = months.flatMap((ym, i) => [
        { org_id: ORG_ID, year_month: ym, metric_name: "monthly_revenue", target_value: monthlyRevenues[i] || 0 },
        { org_id: ORG_ID, year_month: ym, metric_name: "gross_margin_rate", target_value: settings.gross_profit_rate },
        { org_id: ORG_ID, year_month: ym, metric_name: "gross_profit_per_hour", target_value: settings.gp_per_hour_target },
      ]);
      const { error: tErr } = await supabase.from("targets").insert(targetInserts);
      if (tErr) throw tErr;

      toast.success("事業計画を保存しました");
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || ""));
    }
    setSaving(false);
  };

  if (!loaded) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <PageHeader title="事業計画" description="期別KPI目標と月次展開" />
        <CurrencyToggle />
      </div>

      <Tabs value={fyTab} onValueChange={setFyTab}>
        <TabsList>
          <TabsTrigger value="2026">当期（2026年4月期）</TabsTrigger>
          <TabsTrigger value="2027">来期（2027年4月期）</TabsTrigger>
          <TabsTrigger value="2028">再来期（2028年4月期）</TabsTrigger>
        </TabsList>

        <TabsContent value={fyTab} className="space-y-6 mt-4">
          <Step1KpiInput
            fiscalYear={fiscalYear}
            months={months}
            settings={settings}
            setSettings={setSettings}
            onSave={handleSave}
            saving={saving}
          />
          <Step2MonthlyPlanTable
            months={months}
            settings={settings}
            fiscalYear={fiscalYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Plan;
