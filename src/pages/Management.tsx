import React, { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useManagementData, SGA_CATEGORY_NAMES } from "@/hooks/useManagementData";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { DashboardKpiCard } from "@/components/DashboardKpiCard";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart,
} from "recharts";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Bot, Send } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const Management = ({ embedded }: { embedded?: boolean }) => {
  usePageTitle(embedded ? undefined : "経営指標");
  const queryClient = useQueryClient();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const d = useManagementData();
  const [logicOpen, setLogicOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const [sgaOpen, setSgaOpen] = useState(true);
  const [budgetSgaOpen, setBudgetSgaOpen] = useState(true);
  const presetQuestions = [
    "今期の売上着地予測は？",
    "利益改善の打ち手は？",
    "コスト構造に問題はある？",
  ];

  const handleSendChat = (text?: string) => {
    const msg = text ?? chatInput.trim();
    if (!msg) return;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "ai", content: "ただいま分析中です。この機能は近日中に実装予定です。" },
    ]);
    setChatInput("");
  };

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        {!embedded && <PageHeader title="経営指標" description="CEO向け - 売上成長・利益構造・財務健全性" />}
        <KpiCardSkeleton count={3} />
        <KpiCardSkeleton count={3} />
        <ChartSkeleton />
        <TableSkeleton cols={8} />
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const hasData = d.monthlyData.some((m) => m.revenue > 0);
  // totals are used directly for cumulative values

  // Chart data converted
  const displayChartData = d.chartData.map((c) => ({
    name: c.name,
    売上原価: toDisplayValue(c.売上原価),
    粗利: toDisplayValue(c.粗利),
    粗利率: c.粗利率,
  }));

  const allChartValues = displayChartData.flatMap((c) => [c.売上原価 + c.粗利]).filter(Boolean);
  const chartMax = Math.max(...allChartValues, 1);
  const yMax = Math.ceil(chartMax * 1.2 / (10 ** Math.floor(Math.log10(chartMax)))) * (10 ** Math.floor(Math.log10(chartMax)));

  // SGA horizontal bar data
  const sgaBarData = d.sgaBreakdown.slice(0, 10).map((item) => ({
    name: item.name.length > 12 ? item.name.slice(0, 12) + "…" : item.name,
    金額: toDisplayValue(item.amount),
    rawAmount: item.amount,
  }));

  // Totals for table
  const totals = d.monthlyData.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      grossProfit: acc.grossProfit + m.grossProfit,
      sga: acc.sga + (m.sgaTotal ?? 0),
      operatingProfit: acc.operatingProfit + (m.operatingProfit ?? 0),
    }),
    { revenue: 0, cost: 0, grossProfit: 0, sga: 0, operatingProfit: 0 }
  );

  // SGA category totals
  const sgaCategoryTotals: Record<string, number> = {};
  SGA_CATEGORY_NAMES.forEach((cat) => {
    sgaCategoryTotals[cat] = d.monthlyData.reduce((s, m) => s + (m.sgaCategoryBreakdown[cat] ?? 0), 0);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      {!embedded && <PageHeader title="経営指標" description="CEO向け - 売上成長・利益構造・財務健全性" />}

      {/* Row 1: Current month KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DashboardKpiCard
          label="今月の売上"
          value={formatAmount(d.currentRevenue)}
          target={formatAmount(d.currentTarget)}
          progress={d.currentTarget > 0 ? (d.currentRevenue / d.currentTarget) * 100 : undefined}
          delay={0}
        />
        <DashboardKpiCard
          label="今月の粗利"
          value={formatAmount(d.currentGrossProfit)}
          target={formatAmount(d.currentTarget * 0.7)}
          progress={d.currentTarget > 0 ? (d.currentGrossProfit / (d.currentTarget * 0.7)) * 100 : undefined}
          subtext={`粗利率 ${fmtPct(d.currentGrossMarginRate)}`}
          delay={50}
        />
        {d.currentOperatingProfit !== null ? (
          <DashboardKpiCard
            label="今月の営業利益"
            value={formatAmount(d.currentOperatingProfit)}
            target={formatAmount(d.currentTarget * 0.2)}
            progress={d.currentTarget > 0 ? (d.currentOperatingProfit / (d.currentTarget * 0.2)) * 100 : undefined}
            subtext={`営業利益率 ${fmtPct(d.currentOperatingMarginRate ?? 0)}`}
            delay={100}
          />
        ) : (
          <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <p className="text-xs text-muted-foreground mb-2">今月の営業利益</p>
            <span className="text-2xl font-bold font-mono-num tracking-tight text-muted-foreground">—</span>
            <p className="text-xs text-muted-foreground mt-2">販管費データなし</p>
          </div>
        )}
      </div>

      {/* Row 2: Cumulative & forecast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DashboardKpiCard
          label={`累計売上（${d.fyLabel}）`}
          value={formatAmount(totals.revenue)}
          target={formatAmount(d.annualTarget)}
          progress={d.annualTarget > 0 ? (totals.revenue / d.annualTarget) * 100 : undefined}
          subtext={`${d.monthsElapsed}/12ヶ月経過`}
          delay={150}
        />
        <DashboardKpiCard
          label={`累計粗利（${d.fyLabel}）`}
          value={formatAmount(totals.grossProfit)}
          target={formatAmount(d.annualTarget * 0.7)}
          progress={d.annualTarget > 0 ? (totals.grossProfit / (d.annualTarget * 0.7)) * 100 : undefined}
          delay={200}
        />
        <DashboardKpiCard
          label={`累計営業利益（${d.fyLabel}）`}
          value={formatAmount(totals.operatingProfit)}
          target={formatAmount(d.annualTarget * 0.2)}
          progress={d.annualTarget > 0 ? (totals.operatingProfit / (d.annualTarget * 0.2)) * 100 : undefined}
          delay={250}
        />
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* P/L Stacked Bar Chart */}
          <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <h3 className="text-sm font-semibold mb-4">月次P/L推移</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={displayChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toLocaleString()}
                  domain={[0, yMax]}
                  label={{ value: unitSuffix, position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                  formatter={(value: number, name: string) => {
                    if (name === "粗利率") return [`${value}%`, name];
                    return [`${value.toLocaleString()}${unitSuffix}`, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="売上原価" stackId="a" fill="hsl(var(--muted))" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="粗利" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="粗利率" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly P/L Table (transposed: months as columns) */}
          <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
            <h3 className="text-sm font-semibold mb-4">月次P/Lテーブル</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[120px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">項目</TableHead>
                  {d.monthlyData.map((m) => (
                    <TableHead key={m.ym} className="text-right whitespace-nowrap">{m.label}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">合計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 売上 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">売上</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.revenue)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.revenue)}</TableCell>
                </TableRow>
                {/* 売上原価 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">売上原価</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.cost)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.cost)}</TableCell>
                </TableRow>
                {/* 粗利 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">粗利</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.grossProfit)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.grossProfit)}</TableCell>
                </TableRow>
                {/* 粗利率 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">粗利率</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.grossMarginRate <= 60 && "text-destructive font-semibold")}>{fmtPct(m.grossMarginRate)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{totals.revenue > 0 ? fmtPct((totals.grossProfit / totals.revenue) * 100) : "—"}</TableCell>
                </TableRow>
                {/* 販管費 (clickable to toggle sub-rows) */}
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSgaOpen(!sgaOpen)}
                >
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <span className="flex items-center gap-1">
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !sgaOpen && "-rotate-90")} />
                      販管費
                    </span>
                  </TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{m.sgaTotal !== null ? formatAmount(m.sgaTotal) : "—"}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.sga)}</TableCell>
                </TableRow>
                {/* SGA Category sub-rows */}
                {sgaOpen && SGA_CATEGORY_NAMES.map((cat) => (
                  <TableRow key={cat} className="bg-muted/30">
                    <TableCell className="sticky left-0 z-10 pl-8 text-xs text-muted-foreground bg-secondary shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      └ {cat}
                    </TableCell>
                    {d.monthlyData.map((m) => {
                      const val = m.sgaCategoryBreakdown[cat] ?? 0;
                      return (
                        <TableCell key={m.ym} className="text-right font-mono-num text-xs text-muted-foreground whitespace-nowrap">
                          {m.sgaTotal !== null ? (val > 0 ? formatAmount(val) : "—") : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-mono-num text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {sgaCategoryTotals[cat] > 0 ? formatAmount(sgaCategoryTotals[cat]) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {/* 営業利益 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">営業利益</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.operatingProfit !== null && m.operatingProfit < 0 && "text-destructive font-semibold")}>
                      {m.operatingProfit !== null ? formatAmount(m.operatingProfit) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.operatingProfit)}</TableCell>
                </TableRow>
                {/* 営業利益率 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">営業利益率</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.operatingMarginRate !== null && m.operatingMarginRate < 0 && "text-destructive font-semibold")}>
                      {m.operatingMarginRate !== null ? fmtPct(m.operatingMarginRate) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{totals.revenue > 0 ? fmtPct((totals.operatingProfit / totals.revenue) * 100) : "—"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* SGA Breakdown */}
          {sgaBarData.length > 0 && (
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
              <h3 className="text-sm font-semibold mb-1">販管費内訳</h3>
              <p className="text-xs text-muted-foreground mb-4">{d.sgaBreakdownMonth}のfreeeデータ</p>
              <ResponsiveContainer width="100%" height={Math.max(sgaBarData.length * 36, 150)}>
                <BarChart data={sgaBarData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                    formatter={(value: number) => [`${value.toLocaleString()}${unitSuffix}`, "金額"]}
                  />
                  <Bar dataKey="金額" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Budget vs Actuals Table */}
          {(() => {
            function calcBudget(target: number) {
              const gp = target * 0.70;
              const op = target * 0.20;
              const sgaT = gp - op;
              const personnel = gp * 0.50;
              const rem = sgaT - personnel;
              return {
                revenue: target, cost: target * 0.30, grossProfit: gp, grossMarginRate: 70,
                sgaTotal: sgaT, '人件費': personnel, '採用費': rem * 0.15, 'オフィス費': rem * 0.35,
                '広告宣伝・営業活動費': rem * 0.20, 'IT・システム費': rem * 0.15, '専門家・税務費': rem * 0.10,
                'その他': rem * 0.05, operatingProfit: op, operatingMarginRate: 20,
              };
            }
            const budgetMonths = d.monthlyData.map((m) => ({ ym: m.ym, label: m.label, budget: calcBudget(m.target), actual: m, target: m.target }));
            const bTotals = budgetMonths.reduce((a, bd) => {
              const b = bd.budget;
              a.revenue += b.revenue; a.cost += b.cost; a.grossProfit += b.grossProfit;
              a.sgaTotal += b.sgaTotal; a.operatingProfit += b.operatingProfit;
              SGA_CATEGORY_NAMES.forEach((c) => { a.sgaCats[c] = (a.sgaCats[c] ?? 0) + (b[c as keyof typeof b] as number ?? 0); });
              return a;
            }, { revenue: 0, cost: 0, grossProfit: 0, sgaTotal: 0, operatingProfit: 0, sgaCats: {} as Record<string, number> });

            type RowDef = { label: string; isRate?: boolean; isSgaHeader?: boolean; isSgaSub?: boolean; invertColor?: boolean; getBudget: (b: ReturnType<typeof calcBudget>) => number | null; getActual: (m: typeof d.monthlyData[0]) => number | null; getBudgetTotal: () => number | null; getActualTotal: () => number | null; };
            const rows: RowDef[] = [
              { label: '売上', getBudget: (b) => b.revenue, getActual: (m) => m.revenue, getBudgetTotal: () => bTotals.revenue, getActualTotal: () => totals.revenue },
              { label: '原価', invertColor: true, getBudget: (b) => b.cost, getActual: (m) => m.cost, getBudgetTotal: () => bTotals.cost, getActualTotal: () => totals.cost },
              { label: '粗利', getBudget: (b) => b.grossProfit, getActual: (m) => m.grossProfit, getBudgetTotal: () => bTotals.grossProfit, getActualTotal: () => totals.grossProfit },
              { label: '粗利率', isRate: true, getBudget: (b) => b.grossMarginRate, getActual: (m) => m.grossMarginRate, getBudgetTotal: () => bTotals.revenue > 0 ? (bTotals.grossProfit / bTotals.revenue) * 100 : null, getActualTotal: () => totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : null },
              { label: '販管費', isSgaHeader: true, invertColor: true, getBudget: (b) => b.sgaTotal, getActual: (m) => m.sgaTotal, getBudgetTotal: () => bTotals.sgaTotal, getActualTotal: () => totals.sga },
              ...SGA_CATEGORY_NAMES.map((cat): RowDef => ({ label: cat, isSgaSub: true, invertColor: true, getBudget: (b) => b[cat as keyof typeof b] as number, getActual: (m) => m.sgaTotal !== null ? (m.sgaCategoryBreakdown[cat] ?? 0) : null, getBudgetTotal: () => bTotals.sgaCats[cat] ?? 0, getActualTotal: () => sgaCategoryTotals[cat] ?? 0 })),
              { label: '営業利益', getBudget: (b) => b.operatingProfit, getActual: (m) => m.operatingProfit, getBudgetTotal: () => bTotals.operatingProfit, getActualTotal: () => totals.operatingProfit },
              { label: '営業利益率', isRate: true, getBudget: (b) => b.operatingMarginRate, getActual: (m) => m.operatingMarginRate, getBudgetTotal: () => bTotals.revenue > 0 ? (bTotals.operatingProfit / bTotals.revenue) * 100 : null, getActualTotal: () => totals.revenue > 0 ? (totals.operatingProfit / totals.revenue) * 100 : null },
            ];
            const vc = (diff: number, inv?: boolean) => { if (diff === 0) return ''; return (inv ? diff < 0 : diff > 0) ? 'text-emerald-600' : 'text-destructive'; };
            const fmtV = (v: number | null, isRate?: boolean) => { if (v === null) return "—"; return isRate ? fmtPct(v) : formatAmount(v); };

            return (
              <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
                <h3 className="text-sm font-semibold mb-4">月次予算 vs 実績</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[120px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>項目</TableHead>
                      {budgetMonths.map((bd) => (
                        <TableHead key={bd.ym} colSpan={3} className="text-center whitespace-nowrap border-l border-border/50">{bd.label}</TableHead>
                      ))}
                      <TableHead colSpan={3} className="text-center font-bold border-l border-border/50">通期合計</TableHead>
                    </TableRow>
                    <TableRow>
                      {[...budgetMonths.map(b => b.ym), 'total'].map((k) => (
                        <React.Fragment key={`sub-${k}`}>
                          <TableHead className="text-right text-[10px] whitespace-nowrap bg-blue-50/60 dark:bg-blue-950/20 border-l border-border/50">予算</TableHead>
                          <TableHead className="text-right text-[10px] whitespace-nowrap">実績</TableHead>
                          <TableHead className="text-right text-[10px] whitespace-nowrap">差異</TableHead>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      if (row.isSgaSub && !budgetSgaOpen) return null;
                      return (
                        <TableRow key={row.label} className={cn(row.isSgaHeader && "cursor-pointer hover:bg-muted/50", row.isSgaSub && "bg-muted/30")} onClick={row.isSgaHeader ? () => setBudgetSgaOpen(!budgetSgaOpen) : undefined}>
                          <TableCell className={cn("sticky left-0 z-10 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]", row.isSgaSub ? "bg-secondary pl-8 text-xs text-muted-foreground" : "bg-card font-medium")}>
                            {row.isSgaHeader ? <span className="flex items-center gap-1"><ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !budgetSgaOpen && "-rotate-90")} />{row.label}</span> : row.isSgaSub ? `└ ${row.label}` : row.label}
                          </TableCell>
                          {budgetMonths.map((bd) => {
                            const bV = bd.target > 0 ? row.getBudget(bd.budget) : null;
                            const aV = row.getActual(bd.actual);
                            const diff = bV !== null && aV !== null ? aV - bV : null;
                            return (
                              <React.Fragment key={bd.ym}>
                                <TableCell className="text-right font-mono-num whitespace-nowrap text-xs bg-blue-50/60 dark:bg-blue-950/20 border-l border-border/50">{fmtV(bV, row.isRate)}</TableCell>
                                <TableCell className="text-right font-mono-num whitespace-nowrap text-xs">{fmtV(aV, row.isRate)}</TableCell>
                                <TableCell className={cn("text-right font-mono-num whitespace-nowrap text-xs", diff !== null && vc(diff, row.invertColor))}>{diff !== null ? fmtV(diff, row.isRate) : "—"}</TableCell>
                              </React.Fragment>
                            );
                          })}
                          {(() => {
                            const bT = row.getBudgetTotal(); const aT = row.getActualTotal(); const dT = bT !== null && aT !== null ? aT - bT : null;
                            return (<>
                              <TableCell className="text-right font-mono-num whitespace-nowrap text-xs font-semibold bg-blue-50/60 dark:bg-blue-950/20 border-l border-border/50">{fmtV(bT, row.isRate)}</TableCell>
                              <TableCell className="text-right font-mono-num whitespace-nowrap text-xs font-semibold">{fmtV(aT, row.isRate)}</TableCell>
                              <TableCell className={cn("text-right font-mono-num whitespace-nowrap text-xs font-semibold", dT !== null && vc(dT, row.invertColor))}>{dT !== null ? fmtV(dT, row.isRate) : "—"}</TableCell>
                            </>);
                          })()}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-4 text-[11px] text-muted-foreground space-y-0.5 leading-relaxed">
                  <p className="font-medium text-foreground/70 mb-1">予算配分ルール:</p>
                  <p>・粗利目標 = 売上目標 × 70%</p>
                  <p>・営業利益目標 = 売上目標 × 20%</p>
                  <p>・販管費予算 = 粗利目標 - 営業利益目標（= 売上目標 × 50%）</p>
                  <p>・人件費 = 粗利目標 × 50%</p>
                  <p>・残り予算（販管費 - 人件費）の配分: 採用費15%, オフィス費35%, 広告宣伝・営業活動費20%, IT・システム費15%, 専門家・税務費10%, その他5%</p>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* AI Advisor Mini Section */}
      <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-sm bg-accent flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-accent-foreground" />
          </div>
          <h3 className="text-sm font-semibold">AIアドバイザー</h3>
        </div>

        {/* Preset questions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {presetQuestions.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleSendChat(q)}
            >
              {q}
            </Button>
          ))}
        </div>

        {/* Chat messages */}
        {chatMessages.length > 0 && (
          <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
            {chatMessages.map((msg, i) =>
              msg.role === "ai" ? (
                <div key={i} className="flex gap-2 items-start">
                  <div className="h-6 w-6 rounded-sm bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-accent-foreground" />
                  </div>
                  <div className="bg-secondary rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* Chat input */}
        <div className="flex gap-2">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
            placeholder="経営に関する質問を入力..."
            className="min-h-[40px] max-h-24 resize-none text-xs"
            rows={1}
          />
          <Button onClick={() => handleSendChat()} size="icon" className="shrink-0 h-[40px] w-[40px]" disabled={!chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calculation Logic */}
      <Collapsible open={logicOpen} onOpenChange={setLogicOpen}>
        <div className="bg-card rounded-lg shadow-sm">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-lg">
            <h3 className="text-sm font-semibold">計算ロジック</h3>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", logicOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p>・<strong>売上</strong> = monthly_salesテーブルのrevenue（Board計上日基準、受注確定+受注済）</p>
              <p>・<strong>粗利</strong> = monthly_salesテーブルのgross_profit</p>
              <p>・<strong>粗利率</strong> = 粗利 ÷ 売上 × 100</p>
              <p>・<strong>営業利益</strong> = 粗利 - 販管費（freee_monthly_plテーブルのsga_total）</p>
              <p>・<strong>営業利益率</strong> = 営業利益 ÷ 売上 × 100</p>
              <p>・<strong>累計営業利益</strong> = 月次P/Lテーブルの営業利益合計</p>
              <p>・<strong>営業利益目標</strong> = 年間売上目標 × 20%（¥{(d.annualTarget * 0.2).toLocaleString()}）</p>
              <p>・<strong>粗利目標</strong> = 売上目標 × 70%</p>
              <p>・<strong>年間目標</strong> = ¥75,000,000</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default Management;
