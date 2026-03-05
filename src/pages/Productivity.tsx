import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProductivityData } from "@/hooks/useProductivityData";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { DashboardKpiCard } from "@/components/DashboardKpiCard";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
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

const Productivity = () => {
  usePageTitle("生産性指標");
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrencyUnit();
  const d = useProductivityData();
  const [logicOpen, setLogicOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);

  const presetQuestions = [
    "稼働率を改善するには？",
    "工数単価が低い月の原因は？",
    "人員配置の最適化提案",
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

  const growthArrow = (val: number) => ({
    text: `${Math.abs(val).toFixed(1)}%`,
    direction: val >= 0 ? "up" as const : "down" as const,
    positive: val >= 0,
  });

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">生産性指標</h2>
          <p className="text-sm text-muted-foreground mt-1">局長向け - 工数あたりの収益性・リソース効率</p>
        </div>
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <ChartSkeleton />
        <TableSkeleton cols={9} />
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  // GPH chart Y-axis
  const gphMax = Math.max(
    ...d.gphChartData.map((c) => Math.max(c.粗利工数単価, c.案件粗利工数単価)),
    d.targetGPH,
    d.targetProjectGPH,
    1
  );
  const gphYMax = Math.ceil(gphMax * 1.2 / 1000) * 1000;

  // Per-head chart Y-axis
  const perHeadMax = Math.max(
    ...d.perHeadChartData.map((c) => Math.max(c["1人あたり売上"], c["1人あたり粗利"])),
    1
  );
  const perHeadYMax = Math.ceil(perHeadMax * 1.2 / 100000) * 100000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">生産性指標</h2>
        <p className="text-sm text-muted-foreground mt-1">局長向け - 工数あたりの収益性・リソース効率</p>
      </div>

      {/* Row 1: GPH (Total Labor Hours) */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">粗利工数単価（総労働時間）</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の粗利工数単価" value={`¥${Math.round(d.prevGPH).toLocaleString()}`} delay={0} />
          <DashboardKpiCard
            label="今月の粗利工数単価"
            value={`¥${Math.round(d.currentGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetGPH.toLocaleString()}`}
            progress={d.targetGPH > 0 ? (d.currentGPH / d.targetGPH) * 100 : undefined}
            delay={50}
          />
          <DashboardKpiCard
            label="前月比成長率"
            value={`${d.gphMomChange >= 0 ? "+" : ""}${d.gphMomChange.toFixed(1)}%`}
            change={growthArrow(d.gphMomChange)}
            delay={100}
          />
          <DashboardKpiCard
            label="通期平均粗利工数単価"
            value={`¥${Math.round(d.avgGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetGPH.toLocaleString()}`}
            progress={d.targetGPH > 0 ? (d.avgGPH / d.targetGPH) * 100 : undefined}
            delay={150}
          />
        </div>
      </div>

      {/* Row 2: Project GPH (Project Hours) */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">案件粗利工数単価（案件工数）</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の案件粗利工数単価" value={`¥${Math.round(d.prevProjectGPH).toLocaleString()}`} delay={200} />
          <DashboardKpiCard
            label="今月の案件粗利工数単価"
            value={`¥${Math.round(d.currentProjectGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`}
            progress={d.targetProjectGPH > 0 ? (d.currentProjectGPH / d.targetProjectGPH) * 100 : undefined}
            delay={250}
          />
          <DashboardKpiCard
            label="前月比成長率"
            value={`${d.projectGphMomChange >= 0 ? "+" : ""}${d.projectGphMomChange.toFixed(1)}%`}
            change={growthArrow(d.projectGphMomChange)}
            delay={300}
          />
          <DashboardKpiCard
            label="通期平均案件粗利工数単価"
            value={`¥${Math.round(d.avgProjectGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`}
            progress={d.targetProjectGPH > 0 ? (d.avgProjectGPH / d.targetProjectGPH) * 100 : undefined}
            delay={350}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GPH Trend Chart */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-sm font-semibold mb-4">工数単価推移</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={d.gphChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, gphYMax]}
                tickFormatter={(v) => `¥${v.toLocaleString()}`}
                label={{ value: "円", position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
              />
              <Legend fontSize={12} />
              <ReferenceLine y={d.targetGPH} stroke="hsl(var(--chart-4))" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標 ¥${d.targetGPH.toLocaleString()}`, position: "right", fontSize: 10, fill: "hsl(var(--chart-4))" }} />
              <ReferenceLine y={d.targetProjectGPH} stroke="hsl(var(--chart-2))" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標 ¥${d.targetProjectGPH.toLocaleString()}`, position: "right", fontSize: 10, fill: "hsl(var(--chart-2))" }} />
              <Line type="monotone" dataKey="粗利工数単価" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-4))" }} />
              <Line type="monotone" dataKey="案件粗利工数単価" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "hsl(var(--chart-2))" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Per-Head Chart */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-4">1人あたり指標推移</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={d.perHeadChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, perHeadYMax]}
                tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                label={{ value: "円", position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
              />
              <Legend fontSize={12} />
              <Line type="monotone" dataKey="1人あたり売上" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              <Line type="monotone" dataKey="1人あたり粗利" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-2))" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resource Breakdown Table (transposed: months as columns) */}
      <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
        <h3 className="text-sm font-semibold mb-4">リソース内訳テーブル</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">項目</TableHead>
              {d.monthlyData.map((m) => (
                <TableHead key={m.ym} className="text-right whitespace-nowrap">{m.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">正社員数</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className="text-right font-mono-num">{m.employees}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">パート数</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className="text-right font-mono-num">{m.partTimers}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">総労働時間</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{m.totalLaborHours.toLocaleString()}h</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件工数</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{m.projectHours.toLocaleString()}h</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件稼働率</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.utilizationRate < 70 && "text-destructive font-semibold")}>
                  {fmtPct(m.utilizationRate)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">粗利</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className="text-right font-mono-num whitespace-nowrap">{formatAmount(m.grossProfit)}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">粗利工数単価</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.gph < d.targetGPH && m.gph > 0 && "text-destructive font-semibold")}>
                  ¥{Math.round(m.gph).toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件粗利工数単価</TableCell>
              {d.monthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-right font-mono-num whitespace-nowrap", m.projectGph < d.targetProjectGPH && m.projectGph > 0 && "text-destructive font-semibold")}>
                  ¥{Math.round(m.projectGph).toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* AI Advisor Mini Section */}
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
            placeholder="生産性に関する質問を入力..."
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
              <p>・<strong>粗利工数単価（総労働時間）</strong> = 月間粗利 ÷ 月間総労働時間。目標¥21,552</p>
              <p>・<strong>案件粗利工数単価（案件工数）</strong> = 月間粗利 ÷ 月間案件工数時間。目標¥25,000</p>
              <p>・<strong>総労働時間</strong> = 正社員数×160h + パート時間合計</p>
              <p>・<strong>案件工数</strong> = 総労働時間 - 社内業務時間（正社員40h/人 + パート20h/人）</p>
              <p>・<strong>案件稼働率</strong> = 案件工数 ÷ 総労働時間 × 100</p>
              <p>・<strong>1人あたり売上</strong> = 売上 ÷ 総人員数（正社員+パート）</p>
              <p>・<strong>1人あたり粗利</strong> = 粗利 ÷ 総人員数</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default Productivity;
