import { useState } from "react";
import { useCustomersData } from "@/hooks/useCustomersData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Briefcase, ChevronDown, Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getMonthLabel } from "@/lib/fiscalYear";
import { PageHeader } from "@/components/PageHeader";

const Customers = ({ embedded }: { embedded?: boolean }) => {
  usePageTitle(embedded ? undefined : "顧客分析");
  const queryClient = useQueryClient();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const d = useCustomersData();
  const [tableMode, setTableMode] = useState<"revenue" | "grossProfit" | "grossProfitRate">("revenue");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);

  const presetQuestions = [
    "顧客ポートフォリオの分析は？",
    "売上集中リスクはある？",
    "新規開拓の優先度は？",
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
        {!embedded && <h2 className="text-2xl font-bold tracking-tight">顧客分析</h2>}
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (d.isError) return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;

  const hasData = d.clientTableData.length > 0;

  // Chart data with display values
  const chartData = d.monthlyData.map((m) => ({
    name: m.month,
    customerUnitPrice: toDisplayValue(m.customerUnitPrice),
    projectUnitPrice: toDisplayValue(m.projectUnitPrice),
    customerCount: m.customerCount,
    projectCount: m.projectCount,
  }));

  // Averages for reference lines (only months with data)
  const withCustomers = chartData.filter((c) => c.customerCount > 0);
  const withProjects = chartData.filter((c) => c.projectCount > 0);
  const avgCustomerCount = withCustomers.length > 0 ? Math.round(withCustomers.reduce((s, c) => s + c.customerCount, 0) / withCustomers.length * 10) / 10 : 0;
  const avgProjectCount = withProjects.length > 0 ? Math.round(withProjects.reduce((s, c) => s + c.projectCount, 0) / withProjects.length * 10) / 10 : 0;
  const avgCustomerUnitPrice = withCustomers.length > 0 ? Math.round(withCustomers.reduce((s, c) => s + c.customerUnitPrice, 0) / withCustomers.length) : 0;
  const avgProjectUnitPrice = withProjects.length > 0 ? Math.round(withProjects.reduce((s, c) => s + c.projectUnitPrice, 0) / withProjects.length) : 0;

  // Rank colors for top 5
  const rankBg = (idx: number) => {
    if (idx === 0) return "bg-amber-50 dark:bg-amber-950/30";
    if (idx === 1) return "bg-slate-50 dark:bg-slate-800/30";
    if (idx === 2) return "bg-orange-50 dark:bg-orange-950/20";
    if (idx <= 4) return "bg-blue-50 dark:bg-blue-950/20";
    return "";
  };

  const totalRevenue = d.clientTableData.reduce((s, c) => s + c.revenue, 0);
  const totalGrossProfit = d.clientTableData.reduce((s, c) => s + c.grossProfit, 0);

  return (
    <div className="space-y-6">
      {!embedded && <h2 className="text-2xl font-bold tracking-tight">顧客分析</h2>}

      {/* Section 1: Customer KPIs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" /> 顧客数 / 単価
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 顧客数" value={`${d.prevCustomerCount}社`} />
          <KpiMiniCard label="今月 顧客数" value={`${d.currCustomerCount}社`} />
          <GrowthCard label="前月比" value={d.customerGrowth} />
          <KpiMiniCard label="通期 取引顧客数" value={`${d.ytdCustomerCount}社`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 顧客単価" value={formatAmount(d.prevCustomerUnitPrice)} />
          <KpiMiniCard label="今月 顧客単価" value={formatAmount(d.currCustomerUnitPrice)} />
          <GrowthCard label="前月比" value={d.customerUnitPriceGrowth} />
          <KpiMiniCard label="通期 平均顧客単価" value={formatAmount(d.ytdCustomerUnitPrice)} />
        </div>
      </div>

      {/* Section 2: Project KPIs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Briefcase className="h-4 w-4" /> 案件数 / 単価
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 案件数" value={`${d.prevProjectCount}件`} />
          <KpiMiniCard label="今月 案件数" value={`${d.currProjectCount}件`} />
          <GrowthCard label="前月比" value={d.projectGrowth} />
          <KpiMiniCard label="通期 取引案件数" value={`${d.ytdProjectCount}件`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 案件単価" value={formatAmount(d.prevProjectUnitPrice)} />
          <KpiMiniCard label="今月 案件単価" value={formatAmount(d.currProjectUnitPrice)} />
          <GrowthCard label="前月比" value={d.projectUnitPriceGrowth} />
          <KpiMiniCard label="通期 平均案件単価" value={formatAmount(d.ytdProjectUnitPrice)} />
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Section 3: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 顧客数推移 */}
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">顧客数推移</h3>
                <span className="text-xs font-semibold text-destructive">平均 {avgCustomerCount}社</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} label={{ value: "社", position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => [`${v}社`, "顧客数"]} />
                  <ReferenceLine y={avgCustomerCount} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="customerCount" name="顧客数" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 案件数推移 */}
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">案件数推移</h3>
                <span className="text-xs font-semibold text-destructive">平均 {avgProjectCount}件</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} label={{ value: "件", position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => [`${v}件`, "案件数"]} />
                  <ReferenceLine y={avgProjectCount} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="projectCount" name="案件数" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 顧客単価推移 */}
            {/* 案件単価推移 */}
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "150ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">顧客単価推移</h3>
                <span className="text-xs font-semibold text-destructive">平均 {avgCustomerUnitPrice.toLocaleString()}{unitSuffix}</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} label={{ value: unitSuffix, position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} label={{ value: "社", position: "insideTopRight", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number, name: string) => [name === "顧客数" ? `${v}社` : `${v.toLocaleString()}${unitSuffix}`, name]} />
                  <Legend />
                  <ReferenceLine yAxisId="left" y={avgCustomerUnitPrice} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar yAxisId="left" dataKey="customerUnitPrice" name="顧客単価" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="customerCount" name="顧客数" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">案件単価推移</h3>
                <span className="text-xs font-semibold text-destructive">平均 {avgProjectUnitPrice.toLocaleString()}{unitSuffix}</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} label={{ value: unitSuffix, position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} label={{ value: "件", position: "insideTopRight", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number, name: string) => [name === "案件数" ? `${v}件` : `${v.toLocaleString()}${unitSuffix}`, name]} />
                  <Legend />
                  <ReferenceLine yAxisId="left" y={avgProjectUnitPrice} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar yAxisId="left" dataKey="projectUnitPrice" name="案件単価" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="projectCount" name="案件数" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section 4: Monthly Client Table */}
          <div className="bg-card rounded-lg shadow-sm animate-fade-in" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-1 p-4 pb-0">
              <button
                onClick={() => setTableMode("revenue")}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tableMode === "revenue" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                売上
              </button>
              <button
                onClick={() => setTableMode("grossProfit")}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tableMode === "grossProfit" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                粗利
              </button>
              <button
                onClick={() => setTableMode("grossProfitRate")}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tableMode === "grossProfitRate" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                粗利率
              </button>
            </div>
            <div className="overflow-x-auto relative">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-20 bg-secondary">
                  <tr>
                    <th className="sticky left-0 z-30 bg-secondary text-left px-3 py-2 font-semibold min-w-[160px] border-b border-border">顧客名</th>
                    {d.fiscalMonths.map((ym) => (
                      <th key={ym} className="text-right px-2 py-2 font-semibold whitespace-nowrap border-b border-border">{getMonthLabel(ym)}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-bold whitespace-nowrap border-b border-border">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {d.clientTableData.map((client, idx) => (
                    <tr key={client.id} className={`${rankBg(idx)} hover:bg-muted/50 transition-colors`}>
                      <td className={`sticky left-0 z-10 ${rankBg(idx) || "bg-card"} px-3 py-1.5 font-medium border-b border-border truncate max-w-[200px]`}>
                        {client.name}
                      </td>
                      {d.fiscalMonths.map((ym) => {
                        const m = client.monthly[ym];
                        if (tableMode === "grossProfitRate") {
                          const rev = m?.revenue ?? 0;
                          const gp = m?.grossProfit ?? 0;
                          const rate = rev > 0 ? (gp / rev) * 100 : 0;
                          return (
                            <td key={ym} className="text-right px-2 py-1.5 font-mono text-xs border-b border-border tabular-nums">
                              {rev > 0 ? `${rate.toFixed(1)}%` : <span className="text-muted-foreground">-</span>}
                            </td>
                          );
                        }
                        const val = tableMode === "revenue" ? (m?.revenue ?? 0) : (m?.grossProfit ?? 0);
                        return (
                          <td key={ym} className="text-right px-2 py-1.5 font-mono text-xs border-b border-border tabular-nums">
                            {val > 0 ? formatAmount(val) : <span className="text-muted-foreground">-</span>}
                          </td>
                        );
                      })}
                      <td className={`text-right px-3 py-1.5 font-mono text-xs font-semibold border-b border-border tabular-nums ${tableMode === "grossProfitRate" && client.revenue > 0 && (client.grossProfit / client.revenue) * 100 < 70 ? "text-destructive" : ""}`}>
                        {tableMode === "grossProfitRate"
                          ? `${client.revenue > 0 ? ((client.grossProfit / client.revenue) * 100).toFixed(1) : "0.0"}%`
                          : formatAmount(tableMode === "revenue" ? client.revenue : client.grossProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-secondary font-semibold">
                  <tr>
                    <td className="sticky left-0 z-30 bg-secondary px-3 py-2 border-t border-border">合計</td>
                    {d.fiscalMonths.map((ym) => {
                      const t = d.monthlyTotals[ym];
                      if (tableMode === "grossProfitRate") {
                        const rev = t?.revenue ?? 0;
                        const gp = t?.grossProfit ?? 0;
                        const rate = rev > 0 ? (gp / rev) * 100 : 0;
                        return (
                          <td key={ym} className="text-right px-2 py-2 font-mono text-xs border-t border-border tabular-nums">
                            {rev > 0 ? `${rate.toFixed(1)}%` : "-"}
                          </td>
                        );
                      }
                      const val = tableMode === "revenue" ? (t?.revenue ?? 0) : (t?.grossProfit ?? 0);
                      return (
                        <td key={ym} className="text-right px-2 py-2 font-mono text-xs border-t border-border tabular-nums">
                          {formatAmount(val)}
                        </td>
                      );
                    })}
                    <td className="text-right px-3 py-2 font-mono text-xs font-bold border-t border-border tabular-nums">
                      {tableMode === "grossProfitRate"
                        ? `${totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : "0.0"}%`
                        : formatAmount(tableMode === "revenue" ? totalRevenue : totalGrossProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* AI Advisor */}
      <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-sm bg-accent flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-accent-foreground" />
          </div>
          <h3 className="text-sm font-semibold">AIアドバイザー</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {presetQuestions.map((q) => (
            <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => handleSendChat(q)}>{q}</Button>
          ))}
        </div>
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
        <div className="flex gap-2">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
            placeholder="顧客に関する質問を入力..."
            className="min-h-[40px] max-h-24 resize-none text-xs"
            rows={1}
          />
          <Button onClick={() => handleSendChat()} size="icon" className="shrink-0 h-[40px] w-[40px]" disabled={!chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calculation Logic */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className="h-3 w-3" />
          計算ロジック
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs text-muted-foreground bg-secondary rounded-lg p-4 space-y-1">
          <p>・顧客数 = 当月のproject_plで売上&gt;0のユニークclient_id数</p>
          <p>・顧客単価 = 月間売上 ÷ 月間顧客数</p>
          <p>・案件数 = 当月のproject_plのレコード数（売上&gt;0）</p>
          <p>・案件単価 = 月間売上 ÷ 月間案件数</p>
          <p>・通期取引顧客数 = 会計年度内で1回以上売上のあったユニーク顧客数</p>
          <p>・通期平均顧客単価 = 通期売上合計 ÷ 通期取引顧客数</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/* ── Sub-components ── */
function KpiMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums">{value}</p>
    </div>
  );
}

function GrowthCard({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-chart-green" />
        ) : (
          <TrendingDown className="h-4 w-4 text-destructive" />
        )}
        <span className={`text-lg font-bold font-mono tabular-nums ${isPositive ? "text-chart-green" : "text-destructive"}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default Customers;
