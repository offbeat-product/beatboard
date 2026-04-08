import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { FieldWithTooltip } from "./FieldWithTooltip";
import { PlanSettings, fmtNum, fmtInputVal, parseInputVal, distributeRevenue, PATTERN_GROWTH_MAP } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth, ORG_ID } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ClientRevenuePlan } from "./ClientRevenuePlan";
import { RotateCcw } from "lucide-react";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
  fiscalYear: string;
}

export function TabSalesPlan({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();
  const [firstHalfTarget, setFirstHalfTarget] = useState(30000000);
  const [secondHalfTarget, setSecondHalfTarget] = useState(45000000);
  // Track manual overrides on individual month cells
  const [monthOverrides, setMonthOverrides] = useState<Record<number, number>>({});

  const getGrowthFactor = (): number => {
    const pattern = settings.revenue_distribution_pattern || "standard";
    if (pattern === "custom") return settings.revenue_growth_factor || 1.5;
    return PATTERN_GROWTH_MAP[pattern] ?? 1.5;
  };

  // Sync half-year targets from loaded distribution & apply growth pattern
  useEffect(() => {
    if (settings.distribution_mode === "half_year" && settings.monthly_revenue_distribution.length === 12) {
      const fh = settings.monthly_revenue_distribution.slice(0, 6).reduce((s, v) => s + v, 0);
      const sh = settings.monthly_revenue_distribution.slice(6, 12).reduce((s, v) => s + v, 0);
      if (fh > 0 || sh > 0) {
        setFirstHalfTarget(fh);
        setSecondHalfTarget(sh);
        // Re-apply growth pattern to fix flat distributions loaded from DB
        const g = (settings.revenue_distribution_pattern === "custom")
          ? (settings.revenue_growth_factor || 1.5)
          : (PATTERN_GROWTH_MAP[settings.revenue_distribution_pattern] ?? 1.5);
        if (Math.abs(g - 1.0) > 0.01) {
          // Check if current distribution is actually flat (all equal within half)
          const fhSlice = settings.monthly_revenue_distribution.slice(0, 6);
          const isFlat = fhSlice.every(v => Math.abs(v - fhSlice[0]) < 1);
          if (isFlat) {
            const fhDist = distributeRevenue(fh, 6, g);
            const shDist = distributeRevenue(sh, 6, g);
            update("monthly_revenue_distribution", [...fhDist, ...shDist]);
          }
        }
      }
    }
    setMonthOverrides({});
  }, [settings.distribution_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHalfYearDist = (fh: number, sh: number, g?: number) => {
    const gf = g ?? getGrowthFactor();
    const firstHalf = distributeRevenue(fh, 6, gf);
    const secondHalf = distributeRevenue(sh, 6, gf);
    const newDist = [...firstHalf, ...secondHalf];
    update("monthly_revenue_distribution", newDist);
    setMonthOverrides({});
  };

  const distSum = settings.distribution_mode === "manual"
    ? settings.monthly_revenue_distribution.reduce((s, v) => s + v, 0)
    : settings.distribution_mode === "half_year"
    ? firstHalfTarget + secondHalfTarget
    : settings.annual_revenue_target;
  const distValid = settings.distribution_mode === "equal" || Math.abs(distSum - settings.annual_revenue_target) < 1;

  // Fetch actuals
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
  const projectPlQuery = useQuery({
    queryKey: ["plan_actual_projectpl", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_pl").select("year_month, revenue, gross_profit, client_id, project_id").eq("org_id", ORG_ID).in("year_month", months).not("client_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const sales = salesQuery.data ?? [];
  const freeeData = freeeQuery.data ?? [];
  const projectPl = projectPlQuery.data ?? [];

  const monthlyProjectTargetAvg = settings.annual_project_target / 12;

  const monthlyPlans = useMemo(() => {
    return months.map((ym, i) => {
      const revPlan = settings.distribution_mode === "equal" ? settings.annual_revenue_target / 12 : (settings.monthly_revenue_distribution[i] || 0);
      const costPlan = revPlan * (settings.cost_rate / 100);
      const gpPlan = revPlan - costPlan;
      const sgaPlan = gpPlan - revPlan * (settings.operating_profit_rate / 100);
      const opPlan = revPlan * (settings.operating_profit_rate / 100);

      const salesRow = sales.filter(s => s.year_month === ym);
      const revActual = salesRow.reduce((s, r) => s + (r.revenue || 0), 0);
      const costActual = salesRow.reduce((s, r) => s + Number(r.cost_total ?? r.cost ?? 0), 0);
      const gpActual = salesRow.reduce((s, r) => s + (r.gross_profit || 0), 0);
      const gpRateActual = revActual > 0 ? (gpActual / revActual) * 100 : 0;

      const freeeRow = freeeData.find(f => f.year_month === ym);
      const sgaActual = freeeRow?.sga_total ? Number(freeeRow.sga_total) : 0;
      const opActual = gpActual - sgaActual;

      const monthPl = projectPl.filter(r => r.year_month === ym && Number(r.revenue ?? 0) > 0);
      const clientCount = new Set(monthPl.map(r => r.client_id)).size;
      const projectCount = monthPl.length;
      const plRevenue = monthPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
      const clientAvg = clientCount > 0 ? plRevenue / clientCount : 0;

      const hasActual = ym <= currentMonth && revActual > 0;

      // Client plan data — auto-calculated from client_revenue_plan
      const crpRows = settings.client_revenue_plan || [];
      const activeFromPlan = crpRows.filter(r => (r.monthly_revenue[ym] || 0) > 0).length;
      const newFromPlan = crpRows.filter(r => r.category === "new" && (r.monthly_revenue[ym] || 0) > 0).length;
      const churnedFromPlan = crpRows.filter(r => r.category === "risk" && (r.monthly_revenue[ym] || 0) > 0).length;
      const clientData = { active: activeFromPlan, new: newFromPlan, churned: churnedFromPlan };
      const existingClients = clientData.active - clientData.new;
      const clientUnitPricePlan = clientData.active > 0 ? revPlan / clientData.active : 0;

      return {
        ym, revPlan, costPlan, gpPlan, sgaPlan, opPlan,
        gpRatePlan: settings.gross_profit_rate,
        revActual, costActual, gpActual, gpRateActual, sgaActual, opActual,
        clientCount, clientAvg, projectCount,
        hasActual, clientData, existingClients, clientUnitPricePlan,
      };
    });
  }, [months, settings, sales, freeeData, projectPl, currentMonth]);


  const fmtC = (v: number, isGph = false) => fmtNum(v, unit, isGph);
  const fmtP = (v: number | null) => v !== null ? `${v.toFixed(1)}%` : "—";

  const isLoading = salesQuery.isLoading || freeeQuery.isLoading || projectPlQuery.isLoading;

  type RowDef = {
    label: string;
    section?: boolean;
    sectionNote?: string;
    planFn?: (mp: typeof monthlyPlans[0]) => string;
    actualFn?: (mp: typeof monthlyPlans[0]) => string;
    diffFn?: (mp: typeof monthlyPlans[0]) => { value: string; color: string } | null;
    totalPlanFn?: () => string;
    totalActualFn?: () => string;
    totalDiffFn?: () => React.ReactNode;
  };

  const mkDiff = (plan: number, actual: number, invert = false) => {
    const diff = actual - plan;
    const color = invert ? (diff <= 0 ? "text-green-600" : "text-destructive") : (diff >= 0 ? "text-green-600" : "text-destructive");
    return { value: fmtC(diff), color };
  };

  const rows: RowDef[] = [
    { label: "売上・粗利", section: true },
    {
      label: "売上",
      planFn: (mp) => fmtC(mp.revPlan),
      actualFn: (mp) => mp.hasActual ? fmtC(mp.revActual) : "—",
      diffFn: (mp) => mp.hasActual ? mkDiff(mp.revPlan, mp.revActual) : null,
      totalPlanFn: () => fmtC(monthlyPlans.reduce((s, m) => s + m.revPlan, 0)),
      totalActualFn: () => fmtC(monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.revActual, 0)),
    },
    {
      label: "原価",
      planFn: (mp) => fmtC(mp.costPlan),
      actualFn: (mp) => mp.hasActual ? fmtC(mp.costActual) : "—",
      diffFn: (mp) => mp.hasActual ? mkDiff(mp.costPlan, mp.costActual, true) : null,
      totalPlanFn: () => fmtC(monthlyPlans.reduce((s, m) => s + m.costPlan, 0)),
      totalActualFn: () => fmtC(monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.costActual, 0)),
    },
    {
      label: "粗利",
      planFn: (mp) => fmtC(mp.gpPlan),
      actualFn: (mp) => mp.hasActual ? fmtC(mp.gpActual) : "—",
      diffFn: (mp) => mp.hasActual ? mkDiff(mp.gpPlan, mp.gpActual) : null,
      totalPlanFn: () => fmtC(monthlyPlans.reduce((s, m) => s + m.gpPlan, 0)),
      totalActualFn: () => fmtC(monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.gpActual, 0)),
    },
    {
      label: "粗利率",
      planFn: (mp) => `${mp.gpRatePlan.toFixed(1)}%`,
      actualFn: (mp) => mp.hasActual ? `${mp.gpRateActual.toFixed(1)}%` : "—",
    },
    { label: "販管費・営業利益", section: true },
    {
      label: "販管費合計",
      planFn: (mp) => fmtC(mp.sgaPlan),
      actualFn: (mp) => mp.hasActual ? fmtC(mp.sgaActual) : "—",
      diffFn: (mp) => mp.hasActual ? mkDiff(mp.sgaPlan, mp.sgaActual, true) : null,
      totalPlanFn: () => fmtC(monthlyPlans.reduce((s, m) => s + m.sgaPlan, 0)),
      totalActualFn: () => fmtC(monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.sgaActual, 0)),
    },
    {
      label: "営業利益",
      planFn: (mp) => fmtC(mp.opPlan),
      actualFn: (mp) => mp.hasActual ? fmtC(mp.opActual) : "—",
      diffFn: (mp) => mp.hasActual ? mkDiff(mp.opPlan, mp.opActual) : null,
      totalPlanFn: () => fmtC(monthlyPlans.reduce((s, m) => s + m.opPlan, 0)),
      totalActualFn: () => fmtC(monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.opActual, 0)),
    },
    { label: "顧客", section: true, sectionNote: "顧客別売上計画から自動算出されます" },
  ];

  // Client section rows rendered separately — now all auto-calculated from client_revenue_plan
  const clientInputRows = [
    { label: "月間アクティブ顧客数", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.clientData.active, showActual: true, actualFn: (mp: typeof monthlyPlans[0]) => mp.clientCount },
    { label: "新規顧客数", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.clientData.new },
    { label: "既存顧客数", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.existingClients },
    { label: "顧客平均単価", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.clientUnitPricePlan, isCurrency: true, showActual: true, actualCalcFn: (mp: typeof monthlyPlans[0]) => mp.clientAvg, actualIsCurrency: true },
    { label: "解約顧客数", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.clientData.churned },
  ];

  return (
    <div className="space-y-8">
      {/* 売上月別配分 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="売上目標構成" description="月別の売上配分方法を設定します" />
        <div className="flex items-center gap-3 mb-4">
          <Select value={settings.distribution_mode} onValueChange={(v) => {
            if (v === "equal") {
              update("monthly_revenue_distribution", months.map(() => settings.annual_revenue_target / 12));
            } else if (v === "half_year") {
              applyHalfYearDist(firstHalfTarget, secondHalfTarget);
            }
            update("distribution_mode", v);
          }}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
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
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FieldWithTooltip label={`上半期目標（5月〜10月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="上半期6ヶ月分の売上目標合計">
                <Input type="text" value={fmtInputVal(firstHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setFirstHalfTarget(v); applyHalfYearDist(v, secondHalfTarget); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
              </FieldWithTooltip>
              <FieldWithTooltip label={`下半期目標（11月〜4月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="下半期6ヶ月分の売上目標合計">
                <Input type="text" value={fmtInputVal(secondHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setSecondHalfTarget(v); applyHalfYearDist(firstHalfTarget, v); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
              </FieldWithTooltip>
              <div>
                <Label className="text-xs font-medium">配分パターン</Label>
                <Select value={settings.revenue_distribution_pattern || "standard"} onValueChange={(v) => {
                  update("revenue_distribution_pattern", v);
                  const g = v === "custom" ? (settings.revenue_growth_factor || 1.5) : (PATTERN_GROWTH_MAP[v] ?? 1.5);
                  applyHalfYearDist(firstHalfTarget, secondHalfTarget, g);
                }}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">均等配分 (g=1.0)</SelectItem>
                    <SelectItem value="gentle">緩やかな右肩上がり (g=1.3)</SelectItem>
                    <SelectItem value="standard">標準的な右肩上がり (g=1.5)</SelectItem>
                    <SelectItem value="aggressive">急成長 (g=2.0)</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.revenue_distribution_pattern === "custom" && (
                <div>
                  <Label className="text-xs font-medium">成長係数 (g)</Label>
                  <Input type="number" step="0.1" min="1.0" max="3.0" value={settings.revenue_growth_factor || 1.5}
                    onChange={(e) => {
                      const g = Math.min(3, Math.max(1, parseFloat(e.target.value) || 1.5));
                      update("revenue_growth_factor", g);
                      applyHalfYearDist(firstHalfTarget, secondHalfTarget, g);
                    }}
                    className="mt-1 h-9 text-xs focus-visible:ring-[hsl(217,91%,60%)]" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">最終月が初月の何倍か (1.0〜3.0)</p>
                </div>
              )}
            </div>
            {/* Half-year consistency check */}
            {(() => {
              const dist = settings.monthly_revenue_distribution;
              if (dist.length < 12) return null;
              const fhActual = dist.slice(0, 6).reduce((s, v) => s + v, 0);
              const shActual = dist.slice(6, 12).reduce((s, v) => s + v, 0);
              const fhDiff = fhActual - firstHalfTarget;
              const shDiff = shActual - secondHalfTarget;
              const hasOverrides = Object.keys(monthOverrides).length > 0;
              if (!hasOverrides) return null;
              return (
                <div className="space-y-1">
                  {Math.abs(fhDiff) > 1 && (
                    <p className="text-xs text-destructive">
                      上半期合計: {fmtNum(fhActual, unit)} / 目標 {fmtNum(firstHalfTarget, unit)}（差額 {fhDiff > 0 ? "+" : ""}{fmtNum(fhDiff, unit)}）
                    </p>
                  )}
                  {Math.abs(shDiff) > 1 && (
                    <p className="text-xs text-destructive">
                      下半期合計: {fmtNum(shActual, unit)} / 目標 {fmtNum(secondHalfTarget, unit)}（差額 {shDiff > 0 ? "+" : ""}{fmtNum(shDiff, unit)}）
                    </p>
                  )}
                  {(Math.abs(fhDiff) > 1 || Math.abs(shDiff) > 1) && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyHalfYearDist(firstHalfTarget, secondHalfTarget)}>
                      <RotateCcw className="h-3 w-3 mr-1" />自動再配分
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        {settings.distribution_mode === "manual" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {months.map((m, i) => (
              <div key={m}>
                <Label className="text-xs">{getMonthLabel(m)}</Label>
                <Input type="text" value={fmtInputVal(settings.monthly_revenue_distribution[i] || 0, unit).toLocaleString()} onChange={(e) => { const newDist = [...settings.monthly_revenue_distribution]; newDist[i] = parseInputVal(e.target.value, unit); update("monthly_revenue_distribution", newDist); }} className="h-7 text-xs mt-1 focus-visible:ring-[hsl(217,91%,60%)]" />
              </div>
            ))}
          </div>
        )}
        {settings.distribution_mode !== "manual" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {months.map((m, i) => {
              const val = settings.distribution_mode === "equal" ? settings.annual_revenue_target / 12 : (settings.monthly_revenue_distribution[i] || 0);
              const isOverride = monthOverrides[i] !== undefined;
              const isHalfYear = settings.distribution_mode === "half_year";
              return (
                <div key={m}>
                  <Label className="text-xs text-muted-foreground">{getMonthLabel(m)}</Label>
                  {isHalfYear ? (
                    <div className="mt-1 relative group">
                      <div
                        className={cn(
                          "h-7 flex items-center justify-between px-2 rounded-md text-xs font-medium cursor-pointer hover:bg-muted/70",
                          isOverride ? "bg-card border border-border" : "bg-muted text-muted-foreground"
                        )}
                        onClick={() => {
                          const input = prompt(`${getMonthLabel(m)}の売上計画（円）`, String(Math.round(val)));
                          if (input !== null) {
                            const v = parseInt(input.replace(/,/g, "")) || 0;
                            if (v > 0) {
                              const newDist = [...settings.monthly_revenue_distribution];
                              newDist[i] = v;
                              update("monthly_revenue_distribution", newDist);
                              setMonthOverrides(prev => ({ ...prev, [i]: v }));
                            }
                          }
                        }}
                      >
                        <span>{fmtNum(val, unit)}</span>
                        <Badge variant={isOverride ? "default" : "secondary"} className="text-[7px] px-1 py-0 h-3.5 shrink-0 ml-1">
                          {isOverride ? "手動" : "自動"}
                        </Badge>
                      </div>
                      {isOverride && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newOverrides = { ...monthOverrides };
                            delete newOverrides[i];
                            setMonthOverrides(newOverrides);
                            applyHalfYearDist(firstHalfTarget, secondHalfTarget);
                          }}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="自動値に戻す"
                        >
                          <RotateCcw className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 h-7 flex items-center px-2 rounded-md bg-muted text-xs font-medium">{fmtNum(val, unit)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 月次事業計画テーブル */}
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="月次事業計画" description="売上・粗利・顧客の月次計画と実績を比較します" />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs">項目</TableHead>
                  <TableHead className="sticky left-[140px] bg-card z-10 min-w-[50px] text-xs">種別</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className={cn("text-center text-xs min-w-[90px]", m === currentMonth && "bg-primary/5")}>
                      {getMonthLabel(m)}
                    </TableHead>
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
                          {row.sectionNote && <span className="ml-2 text-[10px] font-normal text-muted-foreground">{row.sectionNote}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const subRows: { type: string; bgClass: string }[] = [
                    { type: "計画", bgClass: "bg-blue-50/50 dark:bg-blue-950/20" },
                    { type: "実績", bgClass: "" },
                  ];
                  if (row.diffFn) subRows.push({ type: "差異", bgClass: "" });

                  return subRows.map((sub, si) => (
                    <TableRow key={`${row.label}-${sub.type}`} className={cn(sub.bgClass, "hover:bg-muted/30")}>
                      {si === 0 && <TableCell rowSpan={subRows.length} className="sticky left-0 bg-card z-10 font-medium border-r">{row.label}</TableCell>}
                      <TableCell className={cn("sticky left-[140px] bg-card z-10 text-muted-foreground border-r", sub.bgClass)}>{sub.type}</TableCell>
                      {months.map((_, mi) => {
                        const mp = monthlyPlans[mi];
                        let val = "—";
                        let cellClass = "text-center text-right";

                        if (sub.type === "計画" && row.planFn) val = row.planFn(mp);
                        else if (sub.type === "実績" && row.actualFn) val = row.actualFn(mp);
                        else if (sub.type === "差異" && row.diffFn) {
                          const d = row.diffFn(mp);
                          if (d) { val = d.value; cellClass = cn(cellClass, d.color); }
                        }

                        return <TableCell key={mi} className={cn(cellClass, months[mi] === currentMonth && "bg-primary/5")}>{val}</TableCell>;
                      })}
                      <TableCell className="text-right bg-muted/30 font-medium">
                        {sub.type === "計画" && row.totalPlanFn ? row.totalPlanFn() : sub.type === "実績" && row.totalActualFn ? row.totalActualFn() : "—"}
                      </TableCell>
                    </TableRow>
                  ));
                })}

                {/* Customer input rows with plan/actual/diff */}
                {clientInputRows.map((crow) => {
                  const isEditable = crow.editable;
                  const hasActualRow = 'showActual' in crow && crow.showActual;
                  const rowCount = hasActualRow ? 3 : 1;

                  const planRow = (
                    <TableRow key={`${crow.label}-plan`} className={cn("hover:bg-muted/30", "bg-muted/20")}>
                      <TableCell rowSpan={rowCount} className="sticky left-0 bg-card z-10 font-medium border-r">
                        {crow.label}
                        <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">自動計算</Badge>
                      </TableCell>
                      <TableCell className={cn("sticky left-[140px] bg-card z-10 text-muted-foreground border-r")}>計画</TableCell>
                      {months.map((ym, mi) => {
                        const mp = monthlyPlans[mi];
                        const val = crow.calcFn ? crow.calcFn(mp) : 0;
                        return (
                          <TableCell key={ym} className={cn("text-right text-muted-foreground", ym === currentMonth && "bg-primary/5")}>
                            {crow.isCurrency ? (val > 0 ? fmtC(val) : "—") : (val > 0 ? String(val) : "—")}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                    </TableRow>
                  );

                  if (!hasActualRow) return planRow;

                  const actualRow = (
                    <TableRow key={`${crow.label}-actual`} className="hover:bg-muted/30">
                      <TableCell className="sticky left-[140px] bg-card z-10 text-muted-foreground border-r">実績</TableCell>
                      {months.map((ym, mi) => {
                        const mp = monthlyPlans[mi];
                        let val: number | null = null;
                        if (mp.hasActual) {
                          if ('actualFn' in crow && crow.actualFn) val = crow.actualFn(mp);
                          else if ('actualCalcFn' in crow && crow.actualCalcFn) val = crow.actualCalcFn(mp);
                        }
                        const isCur = ('actualIsCurrency' in crow && crow.actualIsCurrency) || crow.isCurrency;
                        return (
                          <TableCell key={ym} className={cn("text-right", ym === currentMonth && "bg-primary/5")}>
                            {val !== null && val > 0 ? (isCur ? fmtC(val) : String(val)) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                    </TableRow>
                  );

                  const diffRow = (
                    <TableRow key={`${crow.label}-diff`} className="hover:bg-muted/30">
                      <TableCell className="sticky left-[140px] bg-card z-10 text-muted-foreground border-r">差異</TableCell>
                      {months.map((ym, mi) => {
                        const mp = monthlyPlans[mi];
                        if (!mp.hasActual) return <TableCell key={ym} className={cn("text-right", ym === currentMonth && "bg-primary/5")}>—</TableCell>;
                        let planVal = 0;
                        let actualVal = 0;
                        if (crow.field && crow.editable) {
                          planVal = mp.clientData[crow.field] || 0;
                          if ('actualFn' in crow && crow.actualFn) actualVal = crow.actualFn(mp);
                        } else {
                          if (crow.calcFn) planVal = crow.calcFn(mp);
                          if ('actualCalcFn' in crow && crow.actualCalcFn) actualVal = crow.actualCalcFn(mp);
                        }
                        const diff = actualVal - planVal;
                        const isCur = ('actualIsCurrency' in crow && crow.actualIsCurrency) || crow.isCurrency;
                        return (
                          <TableCell key={ym} className={cn("text-right", ym === currentMonth && "bg-primary/5", diff >= 0 ? "text-green-600" : "text-destructive")}>
                            {planVal > 0 || actualVal > 0 ? (isCur ? fmtC(diff) : String(diff)) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                    </TableRow>
                  );

                  return [planRow, actualRow, diffRow];
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 顧客別売上計画 */}
      <ClientRevenuePlan months={months} settings={settings} update={update} fiscalYear={fiscalYear} />
    </div>
  );
}
