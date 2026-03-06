import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useManagementData } from "@/hooks/useManagementData";
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

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const Management = () => {
  usePageTitle("経営指標");
  const queryClient = useQueryClient();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const d = useManagementData();
  const [logicOpen, setLogicOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);

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
        <div>
          <h2 className="text-2xl font-bold tracking-tight">経営指標</h2>
          <p className="text-sm text-muted-foreground mt-1">CEO向け - 売上成長・利益構造・財務健全性</p>
        </div>
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
  const cumulativeRate = d.annualTarget > 0 ? (d.cumulativeRevenue / d.annualTarget) * 100 : 0;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">経営指標</h2>
          <p className="text-sm text-muted-foreground mt-1">CEO向け - 売上成長・利益構造・財務健全性</p>
        </div>
      </div>

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
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[80px]">項目</TableHead>
                  {d.monthlyData.map((m) => (
                    <TableHead key={m.ym} className="text-right whitespace-nowrap">{m.label}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">合計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 売上 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">売上</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.revenue)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.revenue)}</TableCell>
                </TableRow>
                {/* 売上原価 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">売上原価</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.cost)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.cost)}</TableCell>
                </TableRow>
                {/* 粗利 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">粗利</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.grossProfit)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.grossProfit)}</TableCell>
                </TableRow>
                {/* 粗利率 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">粗利率</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.grossMarginRate <= 60 && "text-destructive font-semibold")}>{fmtPct(m.grossMarginRate)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{totals.revenue > 0 ? fmtPct((totals.grossProfit / totals.revenue) * 100) : "—"}</TableCell>
                </TableRow>
                {/* 販管費 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">販管費</TableCell>
                  {d.monthlyData.map((m) => (
                    <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{m.sgaTotal !== null ? formatAmount(m.sgaTotal) : "—"}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono-num font-bold whitespace-nowrap">{formatAmount(totals.sga)}</TableCell>
                </TableRow>
                {/* 営業利益 */}
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">営業利益</TableCell>
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
                <BarChart data={sgaBarData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                    formatter={(value: number) => [`${value.toLocaleString()}${unitSuffix}`, "金額"]}
                  />
                  <Bar dataKey="金額" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
              <p>・<strong>売上着地予測</strong> = 累計売上 ÷ 経過月数 × 12</p>
              <p>・<strong>累計売上</strong> = 会計年度（5月〜当月）のrevenue合計</p>
              <p>・<strong>年間目標</strong> = ¥75,000,000</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default Management;
