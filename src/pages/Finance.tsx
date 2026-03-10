import React, { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { DashboardKpiCard } from "@/components/DashboardKpiCard";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { FinanceInputModal } from "@/components/FinanceInputModal";
import { FetchLatestButton } from "@/components/FetchLatestButton";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Bot, Send, AlertTriangle, AlertCircle, Plus } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const Finance = () => {
  usePageTitle("財務指標");
  const queryClient = useQueryClient();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const d = useFinanceData();
  const [logicOpen, setLogicOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const [inputModalOpen, setInputModalOpen] = useState(false);

  const presetQuestions = [
    "資金繰りの改善策は？",
    "売掛金の回収を早めるには？",
    "借入の適正額は？",
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
        <PageHeader title="財務指標" description="資金繰り・キャッシュフロー管理" />
        <KpiCardSkeleton count={4} />
        <ChartSkeleton />
        <TableSkeleton cols={8} />
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const hasData = d.rows.some((r) => r.cash > 0 || r.ar > 0 || r.ap > 0);
  const c = d.current;
  const p = d.prev;

  // KPI helpers
  const cashDeltaAmt = p ? c.cash - p.cash : 0;
  const cashDeltaPct = p && p.cash > 0 ? ((c.cash - p.cash) / p.cash) * 100 : 0;
  const arDeltaAmt = p ? c.ar - p.ar : 0;
  const apDeltaAmt = p ? c.ap - p.ap : 0;

  const wcmColor = c.workingCapitalMonths >= 3 ? "text-chart-green" : c.workingCapitalMonths >= 2 ? "text-chart-yellow" : "text-chart-red";

  // Chart data
  const cashChartData = d.rows.map((r) => ({
    name: r.label,
    現預金残高: toDisplayValue(r.cash),
    運転資金月数: r.workingCapitalMonths > 0 ? Number(r.workingCapitalMonths.toFixed(1)) : null,
    入金額: r.income > 0 ? toDisplayValue(r.income) : null,
    出金額: r.expense > 0 ? toDisplayValue(r.expense) : null,
  }));

  const safetyLine = toDisplayValue(d.currentSga * 3);

  const arApChartData = d.rows.map((r) => ({
    name: r.label,
    売掛金: toDisplayValue(r.ar),
    買掛金: toDisplayValue(r.ap),
    売掛回転日数: r.arDays > 0 ? Number(r.arDays.toFixed(1)) : null,
  }));

  // Table summary
  const dataRows = d.rows.filter((r) => r.cash > 0 || r.ar > 0 || r.ap > 0 || r.income > 0);
  const lastRow = dataRows.length > 0 ? dataRows[dataRows.length - 1] : null;
  const avgWcm = dataRows.length > 0 ? dataRows.reduce((s, r) => s + r.workingCapitalMonths, 0) / dataRows.length : 0;
  const avgArDays = dataRows.length > 0 ? dataRows.reduce((s, r) => s + r.arDays, 0) / dataRows.length : 0;
  const avgApDays = dataRows.length > 0 ? dataRows.reduce((s, r) => s + r.apDays, 0) / dataRows.length : 0;
  const totalIncome = d.rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = d.rows.reduce((s, r) => s + r.expense, 0);
  const totalInterest = d.rows.reduce((s, r) => s + r.interest, 0);
  const totalCashFlow = totalIncome - totalExpense;

  type RowDef = { label: string; key: string; summaryType: "last" | "avg" | "sum" | "none" };
  const tableDefs: RowDef[] = [
    { label: "現預金残高", key: "cash", summaryType: "last" },
    { label: "前月比増減", key: "cashDelta", summaryType: "none" },
    { label: "売掛金残高", key: "ar", summaryType: "last" },
    { label: "売掛回転日数", key: "arDays", summaryType: "avg" },
    { label: "買掛金残高", key: "ap", summaryType: "last" },
    { label: "買掛回転日数", key: "apDays", summaryType: "avg" },
    { label: "入金額", key: "income", summaryType: "sum" },
    { label: "出金額", key: "expense", summaryType: "sum" },
    { label: "収支差額", key: "cashFlow", summaryType: "sum" },
    { label: "借入金残高", key: "borrowings", summaryType: "last" },
    { label: "支払利息", key: "interest", summaryType: "sum" },
    { label: "運転資金月数", key: "workingCapitalMonths", summaryType: "avg" },
  ];

  const fmtYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;

  const getCellValue = (row: typeof d.rows[0], key: string): string => {
    const hasFinance = d.financeMap.has(row.month);
    if (!hasFinance && !["cashDelta", "cashFlow"].includes(key)) return "—";
    if (key === "cashFlow") {
      if (!hasFinance) return "—";
      const cf = row.income - row.expense;
      return fmtYen(cf);
    }
    const v = (row as any)[key] as number;
    if (key === "cashDelta") {
      const idx = d.fiscalMonths.indexOf(row.month);
      if (idx === 0 || !d.financeMap.has(row.month)) return "—";
      return formatAmount(v);
    }
    if (["arDays", "apDays"].includes(key)) return v > 0 ? v.toFixed(1) : "—";
    if (key === "workingCapitalMonths") return v > 0 ? v.toFixed(1) : "—";
    if (["income", "expense"].includes(key)) return v > 0 ? fmtYen(v) : "—";
    return formatAmount(v);
  };

  const getSummaryValue = (def: RowDef): string => {
    if (def.summaryType === "none") return "—";
    if (def.summaryType === "last") return lastRow ? formatAmount((lastRow as any)[def.key]) : "—";
    if (def.summaryType === "sum") {
      if (def.key === "income") return fmtYen(totalIncome);
      if (def.key === "expense") return fmtYen(totalExpense);
      if (def.key === "cashFlow") return fmtYen(totalCashFlow);
      if (def.key === "interest") return formatAmount(totalInterest);
    }
    if (def.summaryType === "avg") {
      if (def.key === "arDays") return avgArDays > 0 ? avgArDays.toFixed(1) : "—";
      if (def.key === "apDays") return avgApDays > 0 ? avgApDays.toFixed(1) : "—";
      if (def.key === "workingCapitalMonths") return avgWcm > 0 ? avgWcm.toFixed(1) : "—";
    }
    return "—";
  };

  const getCellClass = (row: typeof d.rows[0], key: string): string => {
    if (key === "workingCapitalMonths" && row.workingCapitalMonths > 0) {
      if (row.workingCapitalMonths < 2) return "bg-destructive/10";
      if (row.workingCapitalMonths < 3) return "bg-chart-yellow/10";
    }
    if (key === "arDays" && row.arDays >= 60) return "text-destructive";
    if (key === "cashFlow") {
      const cf = row.income - row.expense;
      if (cf < 0) return "text-destructive";
      if (cf > 0) return "text-chart-green";
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="財務指標" description="資金繰り・キャッシュフロー管理" />
        <FetchLatestButton targets="both" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardKpiCard
          label="現預金残高"
          value={c.cash > 0 ? formatAmount(c.cash) : "—"}
          change={p && c.cash > 0 ? {
            text: `${formatAmount(Math.abs(cashDeltaAmt))} (${Math.abs(cashDeltaPct).toFixed(1)}%)`,
            direction: cashDeltaAmt >= 0 ? "up" : "down",
            positive: cashDeltaAmt >= 0,
          } : undefined}
          delay={0}
        />
        <div className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <p className="text-xs text-muted-foreground mb-1">運転資金月数</p>
          <p className="text-[10px] text-muted-foreground mb-2">（月平均販管費ベース）</p>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold font-mono-num tracking-tight", wcmColor)}>
              {c.workingCapitalMonths > 0 ? `${c.workingCapitalMonths.toFixed(1)}ヶ月` : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">目標: 3ヶ月以上</p>
        </div>
        <DashboardKpiCard
          label="売掛金残高"
          value={c.ar > 0 ? formatAmount(c.ar) : "—"}
          change={p && c.ar > 0 ? {
            text: formatAmount(Math.abs(arDeltaAmt)),
            direction: arDeltaAmt >= 0 ? "up" : "down",
            positive: arDeltaAmt <= 0,
          } : undefined}
          delay={100}
        />
        <DashboardKpiCard
          label="買掛金残高"
          value={c.ap > 0 ? formatAmount(c.ap) : "—"}
          change={p && c.ap > 0 ? {
            text: formatAmount(Math.abs(apDeltaAmt)),
            direction: apDeltaAmt >= 0 ? "up" : "down",
            positive: apDeltaAmt <= 0,
          } : undefined}
          delay={150}
        />
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cash Chart */}
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
              <h3 className="text-sm font-semibold mb-4">現預金残高推移</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={cashChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="現預金残高" fill="hsl(var(--chart-blue))" radius={[4, 4, 0, 0]} />
                  {safetyLine > 0 && (
                    <ReferenceLine yAxisId="left" y={safetyLine} stroke="hsl(var(--chart-red))" strokeDasharray="5 5" label={{ value: "安全水準(3ヶ月)", position: "right", fontSize: 10 }} />
                  )}
                  <Line yAxisId="right" type="monotone" dataKey="運転資金月数" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="入金額" stroke="hsl(var(--chart-blue))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="6 3" />
                  <Line yAxisId="left" type="monotone" dataKey="出金額" stroke="hsl(var(--chart-red))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="6 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* AR/AP Chart */}
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
              <h3 className="text-sm font-semibold mb-4">売掛金・買掛金推移</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={arApChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="売掛金" fill="hsl(var(--chart-blue))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="買掛金" fill="hsl(var(--chart-orange))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="売掛回転日数" stroke="hsl(var(--chart-yellow))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Input Button + Table */}
          <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">月次財務テーブル</h3>
              <Button size="sm" variant="outline" onClick={() => setInputModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                データ入力
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">項目</TableHead>
                    {d.rows.map((r) => (
                      <TableHead key={r.month} className="text-right min-w-[90px]">{r.label}</TableHead>
                    ))}
                    <TableHead className="text-right min-w-[100px] bg-muted/30">通期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableDefs.map((def) => (
                    <TableRow key={def.key}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium text-xs">{def.label}</TableCell>
                      {d.rows.map((r) => (
                        <TableCell key={r.month} className={cn("text-right text-xs font-mono-num", getCellClass(r, def.key))}>
                          {getCellValue(r, def.key)}
                        </TableCell>
                      ))}
                      <TableCell className={cn(
                        "text-right text-xs font-mono-num bg-muted/30 font-semibold",
                        def.key === "cashFlow" && totalCashFlow < 0 && "text-destructive",
                        def.key === "cashFlow" && totalCashFlow > 0 && "text-chart-green",
                      )}>
                        {getSummaryValue(def)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Alerts */}
          {d.alerts.length > 0 && (
            <div className="space-y-2">
              {d.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-4",
                    alert.level === "danger" ? "bg-destructive/10 border border-destructive/30" : "bg-chart-yellow/10 border border-chart-yellow/30",
                  )}
                >
                  {alert.level === "danger" ? (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-chart-yellow shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{alert.level === "danger" ? "🔴" : "🟡"} {alert.message}</p>
                </div>
              ))}
            </div>
          )}
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
            <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => handleSendChat(q)}>
              {q}
            </Button>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
            placeholder="財務に関する質問を入力..."
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
              <p>・<strong>運転資金月数</strong> = 現預金残高 ÷ 月平均販管費（sga_total &gt; 1万円の月の平均、安全水準: 3ヶ月以上）</p>
              <p>・<strong>売掛回転日数</strong> = 売掛金残高 ÷ 月間売上 × 30</p>
              <p>・<strong>買掛回転日数</strong> = 買掛金残高 ÷ 月間原価 × 30</p>
              <p>・手動入力データは将来freee B/S API自動取得に切り替え予定</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Input Modal */}
      <FinanceInputModal
        open={inputModalOpen}
        onOpenChange={setInputModalOpen}
        fiscalMonths={d.fiscalMonths}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["finance_monthly"] });
        }}
      />
    </div>
  );
};

export default Finance;
