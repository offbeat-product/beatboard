import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, fmtNum } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth, ORG_ID } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
  fiscalYear: string;
}

export function TabMonthlyPlan({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();

  // Fetch actuals
  const salesQuery = useQuery({
    queryKey: ["plan_actual_sales_monthly", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase.from("monthly_sales").select("year_month, revenue, cost, cost_total, gross_profit").eq("org_id", ORG_ID).in("year_month", months);
      return data ?? [];
    },
  });
  const freeeQuery = useQuery({
    queryKey: ["plan_actual_freee_monthly", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase.from("freee_monthly_pl").select("year_month, sga_total, sga_details").eq("org_id", ORG_ID).in("year_month", months);
      return data ?? [];
    },
  });
  const projectPlQuery = useQuery({
    queryKey: ["plan_actual_projectpl_monthly", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase.from("project_pl").select("year_month, revenue, gross_profit, client_id, project_id").eq("org_id", ORG_ID).in("year_month", months).not("client_id", "is", null);
      return data ?? [];
    },
  });

  const sales = salesQuery.data ?? [];
  const freeeData = freeeQuery.data ?? [];
  const projectPl = projectPlQuery.data ?? [];

  // Compute per-client GP rate weighted average for plan
  const getWeightedGpRate = (ym: string): number => {
    const crp = settings.client_revenue_plan || [];
    let totalRev = 0;
    let weightedGp = 0;
    for (const row of crp) {
      const rev = row.monthly_revenue[ym] || 0;
      if (rev > 0) {
        const rate = row.gross_profit_rate ?? settings.gross_profit_rate;
        totalRev += rev;
        weightedGp += rev * (rate / 100);
      }
    }
    if (totalRev <= 0) return settings.gross_profit_rate;
    return (weightedGp / totalRev) * 100;
  };

  const monthlyPlans = useMemo(() => {
    return months.map((ym, i) => {
      const revPlan = settings.distribution_mode === "equal" ? settings.annual_revenue_target / 12 : (settings.monthly_revenue_distribution[i] || 0);

      // Use weighted GP rate from client plan
      const weightedGpRate = getWeightedGpRate(ym);
      const gpPlan = revPlan * (weightedGpRate / 100);
      const costPlan = revPlan - gpPlan;
      const opPlan = revPlan * (settings.operating_profit_rate / 100);
      const sgaPlan = gpPlan - opPlan;

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

      const hasActual = ym <= currentMonth && revActual > 0;

      // Client plan auto-calc
      const crpRows = settings.client_revenue_plan || [];
      const activeFromPlan = crpRows.filter(r => (r.monthly_revenue[ym] || 0) > 0).length;
      const newFromPlan = crpRows.filter(r => r.category === "new" && (r.monthly_revenue[ym] || 0) > 0).length;
      const churnedFromPlan = crpRows.filter(r => r.category === "risk" && (r.monthly_revenue[ym] || 0) > 0).length;
      const clientData = { active: activeFromPlan, new: newFromPlan, churned: churnedFromPlan };

      return {
        ym, revPlan, costPlan, gpPlan, sgaPlan, opPlan,
        gpRatePlan: weightedGpRate,
        revActual, costActual, gpActual, gpRateActual, sgaActual, opActual,
        clientCount, projectCount,
        hasActual, clientData,
      };
    });
  }, [months, settings, sales, freeeData, projectPl, currentMonth]);

  const fmtC = (v: number) => fmtNum(v, unit);
  const isLoading = salesQuery.isLoading || freeeQuery.isLoading || projectPlQuery.isLoading;

  const mkDiff = (plan: number, actual: number, invert = false) => {
    const diff = actual - plan;
    const color = invert ? (diff <= 0 ? "text-green-600" : "text-destructive") : (diff >= 0 ? "text-green-600" : "text-destructive");
    return { value: fmtC(diff), color };
  };

  type RowDef = {
    label: string;
    section?: boolean;
    planFn?: (mp: typeof monthlyPlans[0]) => string;
    actualFn?: (mp: typeof monthlyPlans[0]) => string;
    diffFn?: (mp: typeof monthlyPlans[0]) => { value: string; color: string } | null;
    totalPlanFn?: () => string;
    totalActualFn?: () => string;
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
    { label: "顧客指標", section: true },
    {
      label: "アクティブ顧客数",
      planFn: (mp) => mp.clientData.active > 0 ? String(mp.clientData.active) : "—",
      actualFn: (mp) => mp.hasActual && mp.clientCount > 0 ? String(mp.clientCount) : "—",
    },
    {
      label: "新規顧客数",
      planFn: (mp) => mp.clientData.new > 0 ? String(mp.clientData.new) : "—",
    },
    {
      label: "解約予定数",
      planFn: (mp) => mp.clientData.churned > 0 ? String(mp.clientData.churned) : "—",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="月次事業計画" description="売上・粗利・販管費・営業利益の月次計画と実績を比較します。顧客別粗利率を反映した精緻な計算を行います。" />
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              加重平均粗利率を使用（顧客別粗利率が設定されている場合）
            </Badge>
          </div>
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
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
