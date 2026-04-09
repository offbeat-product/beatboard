import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { ClientRevenuePlan } from "./ClientRevenuePlan";
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

export function TabCustomerPlan({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();

  const projectPlQuery = useQuery({
    queryKey: ["plan_actual_projectpl_customer", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase.from("project_pl").select("year_month, revenue, gross_profit, client_id, project_id").eq("org_id", ORG_ID).in("year_month", months).not("client_id", "is", null);
      return data ?? [];
    },
  });
  const salesQuery = useQuery({
    queryKey: ["plan_actual_sales_customer", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase.from("monthly_sales").select("year_month, revenue").eq("org_id", ORG_ID).in("year_month", months);
      return data ?? [];
    },
  });

  const projectPl = projectPlQuery.data ?? [];
  const sales = salesQuery.data ?? [];

  const customerMetrics = useMemo(() => {
    return months.map((ym, i) => {
      const revPlan = settings.distribution_mode === "equal" ? settings.annual_revenue_target / 12 : (settings.monthly_revenue_distribution[i] || 0);

      const salesRow = sales.filter(s => s.year_month === ym);
      const revActual = salesRow.reduce((s, r) => s + (r.revenue || 0), 0);

      const monthPl = projectPl.filter(r => r.year_month === ym && Number(r.revenue ?? 0) > 0);
      const clientCount = new Set(monthPl.map(r => r.client_id)).size;
      const plRevenue = monthPl.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
      const clientAvg = clientCount > 0 ? plRevenue / clientCount : 0;

      const hasActual = ym <= currentMonth && revActual > 0;

      const crpRows = settings.client_revenue_plan || [];
      const activeFromPlan = crpRows.filter(r => (r.monthly_revenue[ym] || 0) > 0).length;
      const newFromPlan = crpRows.filter(r => r.category === "new" && (r.monthly_revenue[ym] || 0) > 0).length;
      const churnedFromPlan = crpRows.filter(r => r.category === "risk" && (r.monthly_revenue[ym] || 0) > 0).length;
      const existingClients = activeFromPlan - newFromPlan;
      const clientUnitPricePlan = activeFromPlan > 0 ? revPlan / activeFromPlan : 0;

      return {
        ym, revPlan, hasActual,
        clientCount, clientAvg,
        activeFromPlan, newFromPlan, churnedFromPlan, existingClients, clientUnitPricePlan,
      };
    });
  }, [months, settings, sales, projectPl, currentMonth]);

  const fmtC = (v: number) => fmtNum(v, unit);
  const isLoading = projectPlQuery.isLoading || salesQuery.isLoading;

  const clientRows = [
    { label: "月間アクティブ顧客数", planFn: (m: typeof customerMetrics[0]) => m.activeFromPlan, actualFn: (m: typeof customerMetrics[0]) => m.clientCount, hasActual: true },
    { label: "新規顧客数", planFn: (m: typeof customerMetrics[0]) => m.newFromPlan },
    { label: "既存顧客数", planFn: (m: typeof customerMetrics[0]) => m.existingClients },
    { label: "顧客平均単価", planFn: (m: typeof customerMetrics[0]) => m.clientUnitPricePlan, actualFn: (m: typeof customerMetrics[0]) => m.clientAvg, hasActual: true, isCurrency: true },
    { label: "解約予定数", planFn: (m: typeof customerMetrics[0]) => m.churnedFromPlan },
  ];

  return (
    <div className="space-y-8">
      {/* 顧客別売上計画 */}
      <ClientRevenuePlan months={months} settings={settings} update={update} fiscalYear={fiscalYear} />

      {/* 顧客指標サマリー */}
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="顧客指標サマリー" description="顧客別売上計画から自動算出された月次顧客指標です" />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] text-xs">指標</TableHead>
                  <TableHead className="sticky left-[160px] bg-card z-10 min-w-[50px] text-xs">種別</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className={cn("text-center text-xs min-w-[80px]", m === currentMonth && "bg-primary/5")}>
                      {getMonthLabel(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-xs min-w-[80px] bg-muted/50">通期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map((crow) => {
                  const rowCount = crow.hasActual ? 2 : 1;
                  return (
                    <>
                      <TableRow key={`${crow.label}-plan`} className="hover:bg-muted/30 bg-blue-50/50 dark:bg-blue-950/20">
                        <TableCell rowSpan={rowCount} className="sticky left-0 bg-card z-10 font-medium border-r">
                          {crow.label}
                          <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">自動</Badge>
                        </TableCell>
                        <TableCell className="sticky left-[160px] bg-card z-10 text-muted-foreground border-r">計画</TableCell>
                        {months.map((_, mi) => {
                          const m = customerMetrics[mi];
                          const val = crow.planFn(m);
                          return (
                            <TableCell key={mi} className={cn("text-right", months[mi] === currentMonth && "bg-primary/5")}>
                              {crow.isCurrency ? (val > 0 ? fmtC(val) : "—") : (val > 0 ? String(val) : "—")}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                      </TableRow>
                      {crow.hasActual && crow.actualFn && (
                        <TableRow key={`${crow.label}-actual`} className="hover:bg-muted/30">
                          <TableCell className="sticky left-[160px] bg-card z-10 text-muted-foreground border-r">実績</TableCell>
                          {months.map((_, mi) => {
                            const m = customerMetrics[mi];
                            if (!m.hasActual) return <TableCell key={mi} className={cn("text-right", months[mi] === currentMonth && "bg-primary/5")}>—</TableCell>;
                            const val = crow.actualFn!(m);
                            return (
                              <TableCell key={mi} className={cn("text-right", months[mi] === currentMonth && "bg-primary/5")}>
                                {crow.isCurrency ? (val > 0 ? fmtC(val) : "—") : (val > 0 ? String(val) : "—")}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right bg-muted/30 font-medium">—</TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
