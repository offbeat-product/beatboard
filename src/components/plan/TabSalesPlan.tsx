import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { FieldWithTooltip } from "./FieldWithTooltip";
import { PlanSettings, MonthlyClientData, fmtNum, fmtInputVal, parseInputVal } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth, ORG_ID } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ClientRevenuePlan } from "./ClientRevenuePlan";

// SGA classification removed - now handled in TabSgaPlan

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

  useEffect(() => {
    if (settings.distribution_mode === "half_year" && settings.monthly_revenue_distribution.length === 12) {
      const fh = settings.monthly_revenue_distribution.slice(0, 6).reduce((s, v) => s + v, 0);
      const sh = settings.monthly_revenue_distribution.slice(6, 12).reduce((s, v) => s + v, 0);
      if (fh > 0 || sh > 0) { setFirstHalfTarget(fh); setSecondHalfTarget(sh); }
    }
  }, [settings.distribution_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHalfYearDist = (fh: number, sh: number) => {
    const newDist = months.map((m) => {
      const mm = parseInt(m.split("-")[1], 10);
      return mm >= 5 && mm <= 10 ? fh / 6 : sh / 6;
    });
    update("monthly_revenue_distribution", newDist);
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

      // Client plan data
      const clientData = settings.monthly_clients[ym] || { active: 0, new: 0, churned: 0 };
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

  const updateClientData = (ym: string, field: keyof MonthlyClientData, value: number) => {
    const next = { ...settings.monthly_clients };
    next[ym] = { ...(next[ym] || { active: 0, new: 0, churned: 0 }), [field]: value };
    update("monthly_clients", next);
  };

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
    { label: "顧客", section: true, sectionNote: "月ごとの顧客数を入力してください" },
  ];

  // Client section rows rendered separately for input support
  const clientInputRows = [
    { label: "月間アクティブ顧客数", field: "active" as const, editable: true },
    { label: "新規顧客数", field: "new" as const, editable: true },
    { label: "既存顧客数", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.existingClients },
    { label: "顧客平均単価", field: null as null, editable: false, calcFn: (mp: typeof monthlyPlans[0]) => mp.clientUnitPricePlan, isCurrency: true },
    { label: "解約顧客数", field: "churned" as const, editable: true },
  ];

  return (
    <div className="space-y-8">
      {/* 売上月別配分 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="売上目標構成" description="月別の売上配分方法を設定します" />
        <div className="flex items-center gap-3 mb-4">
          <Select value={settings.distribution_mode} onValueChange={(v) => {
            const next = { ...settings, distribution_mode: v } as any;
            if (v === "equal") next.monthly_revenue_distribution = months.map(() => settings.annual_revenue_target / 12);
            else if (v === "half_year") {
              next.monthly_revenue_distribution = months.map((m) => {
                const mm = parseInt(m.split("-")[1], 10);
                return mm >= 5 && mm <= 10 ? firstHalfTarget / 6 : secondHalfTarget / 6;
              });
            }
            update("distribution_mode", next.distribution_mode);
            update("monthly_revenue_distribution", next.monthly_revenue_distribution);
          }}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FieldWithTooltip label={`上半期目標（5月〜10月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="上半期6ヶ月分の売上目標合計">
              <Input type="text" value={fmtInputVal(firstHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setFirstHalfTarget(v); applyHalfYearDist(v, secondHalfTarget); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
            </FieldWithTooltip>
            <FieldWithTooltip label={`下半期目標（11月〜4月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="下半期6ヶ月分の売上目標合計">
              <Input type="text" value={fmtInputVal(secondHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setSecondHalfTarget(v); applyHalfYearDist(firstHalfTarget, v); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
            </FieldWithTooltip>
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
              return (
                <div key={m}>
                  <Label className="text-xs text-muted-foreground">{getMonthLabel(m)}</Label>
                  <div className="mt-1 h-7 flex items-center px-2 rounded-md bg-muted text-xs font-medium">{fmtNum(val, unit)}</div>
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

                {/* Customer input rows */}
                {clientInputRows.map((crow) => {
                  const isEditable = crow.editable;
                  return (
                    <TableRow key={crow.label} className={cn("hover:bg-muted/30", !isEditable && "bg-muted/20")}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium border-r">
                        {crow.label}
                        {!isEditable && <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">自動計算</Badge>}
                      </TableCell>
                      <TableCell className="sticky left-[140px] bg-card z-10 text-muted-foreground border-r">計画</TableCell>
                      {months.map((ym, mi) => {
                        const mp = monthlyPlans[mi];
                        if (isEditable && crow.field) {
                          return (
                            <TableCell key={ym} className={cn("p-1", ym === currentMonth && "bg-primary/5")}>
                              <Input
                                type="number"
                                value={mp.clientData[crow.field] || ""}
                                onChange={(e) => updateClientData(ym, crow.field!, parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center w-16 mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                                tabIndex={0}
                              />
                            </TableCell>
                          );
                        }
                        // Auto-calc fields
                        const val = crow.calcFn ? crow.calcFn(mp) : 0;
                        return (
                          <TableCell key={ym} className={cn("text-right text-muted-foreground", ym === currentMonth && "bg-primary/5")}>
                            {crow.isCurrency ? (val > 0 ? fmtC(val) : "—") : (mp.clientData.active > 0 ? String(val) : "—")}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                    </TableRow>
                  );
                })}

                {/* Landing forecast */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={months.length + 3} className="sticky left-0 bg-muted/50 z-10 font-semibold text-xs border-l-4 border-l-primary">着地予測</TableCell>
                </TableRow>
                {(() => {
                  const me = monthlyPlans.filter(m => m.hasActual).length;
                  const revSum = monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.revActual, 0);
                  const gpSum = monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.gpActual, 0);
                  const opSum = monthlyPlans.filter(m => m.hasActual).reduce((s, m) => s + m.opActual, 0);
                  return [
                    { label: "売上着地予測", value: me > 0 ? (revSum / me) * 12 : 0 },
                    { label: "粗利着地予測", value: me > 0 ? (gpSum / me) * 12 : 0 },
                    { label: "営業利益着地予測", value: me > 0 ? (opSum / me) * 12 : 0 },
                  ].map(f => (
                    <TableRow key={f.label} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-card z-10 font-medium border-r">{f.label}</TableCell>
                      <TableCell className="sticky left-[140px] bg-card z-10 text-muted-foreground border-r">予測</TableCell>
                      {months.map((_, i) => <TableCell key={i} className="text-center text-muted-foreground">—</TableCell>)}
                      <TableCell className="text-right bg-muted/30 font-semibold">{me > 0 ? fmtC(f.value) : "—"}</TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
