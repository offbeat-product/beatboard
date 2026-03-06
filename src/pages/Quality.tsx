import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQualityData, QualityMonthlyInput } from "@/hooks/useQualityData";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import {
  BarChart, Bar, LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Package, Clock, AlertTriangle, ChevronDown, Save, RotateCcw, Bot, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

const Quality = ({ embedded }: { embedded?: boolean }) => {
  usePageTitle(embedded ? undefined : "品質指標");
  const queryClient = useQueryClient();
  const d = useQualityData();

  // Editable inputs state
  const [inputMap, setInputMap] = useState<Record<string, QualityMonthlyInput>>({});
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);

  const presetQuestions = [
    "品質改善の優先施策は？",
    "納期遅延の主要因は？",
    "修正率を下げるには？",
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

  const defaultKey = useMemo(() => {
    if (d.isLoading) return "";
    return JSON.stringify(d.defaultInputMap);
  }, [d.isLoading, d.defaultInputMap]);

  useEffect(() => {
    if (defaultKey) {
      setInputMap(JSON.parse(defaultKey));
      setInitialized(true);
    }
  }, [defaultKey]);

  // Compute monthly rows from editable inputs
  const editedMonthlyData = useMemo(() => {
    if (!d.fiscalMonths || Object.keys(inputMap).length === 0) return [];
    return d.fiscalMonths.map((ym) => {
      const input = inputMap[ym] ?? d.defaultInputMap[ym];
      return d.computeMonthlyRow(ym, input);
    });
  }, [inputMap, d.fiscalMonths, d.defaultInputMap, d.computeMonthlyRow]);

  // Recompute KPIs from edited data
  const kpis = useMemo(() => {
    const curr = editedMonthlyData.find((m) => m.ym === d.currentMonth);
    const prev = editedMonthlyData.find((m) => m.ym === d.previousMonth);
    const currDel = curr?.deliveries ?? 0;
    const prevDel = prev?.deliveries ?? 0;
    const deliveriesGrowth = prevDel > 0 ? ((currDel - prevDel) / prevDel) * 100 : 0;

    const prevOnTimeRate = prevDel > 0 ? ((prev?.onTimeDeliveries ?? 0) / prevDel) * 100 : 0;
    const currOnTimeRate = currDel > 0 ? ((curr?.onTimeDeliveries ?? 0) / currDel) * 100 : 0;

    const prevRevisionRate = prevDel > 0 ? ((prev?.revisionCount ?? 0) / prevDel) * 100 : 0;
    const currRevisionRate = currDel > 0 ? ((curr?.revisionCount ?? 0) / currDel) * 100 : 0;

    const fiscalMonthsToDate = d.fiscalMonths.filter((m) => m <= d.currentMonth);
    const activeMonths = editedMonthlyData.filter((m) => fiscalMonthsToDate.includes(m.ym) && m.deliveries > 0);
    const ytdAvgOnTimeRate = activeMonths.length > 0
      ? activeMonths.reduce((s, m) => s + m.onTimeRate, 0) / activeMonths.length : 0;
    const ytdAvgRevisionRate = activeMonths.length > 0
      ? activeMonths.reduce((s, m) => s + m.revisionRate, 0) / activeMonths.length : 0;
    const ytdDeliveries = editedMonthlyData
      .filter((m) => fiscalMonthsToDate.includes(m.ym))
      .reduce((s, m) => s + m.deliveries, 0);

    return {
      prevDel, currDel, deliveriesGrowth, ytdDeliveries,
      prevOnTime: prev?.onTimeDeliveries ?? 0,
      currOnTime: curr?.onTimeDeliveries ?? 0,
      prevOnTimeRate, currOnTimeRate,
      onTimeRateDiff: currOnTimeRate - prevOnTimeRate,
      prevRevisions: prev?.revisionCount ?? 0,
      currRevisions: curr?.revisionCount ?? 0,
      prevRevisionRate, currRevisionRate,
      revisionRateDiff: currRevisionRate - prevRevisionRate,
      ytdAvgOnTimeRate, ytdAvgRevisionRate,
    };
  }, [editedMonthlyData, d.currentMonth, d.previousMonth, d.fiscalMonths]);

  const updateInput = useCallback((ym: string, field: keyof QualityMonthlyInput, value: number) => {
    setInputMap((prev) => ({
      ...prev,
      [ym]: { ...prev[ym], [field]: value },
    }));
  }, []);

  const resetInputs = useCallback(() => {
    setInputMap({ ...d.defaultInputMap });
    toast.success("デフォルト値にリセットしました");
  }, [d.defaultInputMap]);

  const saveInputs = useCallback(async () => {
    setSaving(true);
    try {
      for (const ym of d.fiscalMonths) {
        const input = inputMap[ym];
        if (!input) continue;
        // Upsert aggregated row (no client_id for aggregated)
        const { error } = await supabase.from("quality_monthly").upsert(
          {
            org_id: ORG_ID,
            year_month: ym,
            client_id: "__total__",
            client_name: "合計",
            total_deliveries: d.projectCountForMonth(ym),
            on_time_deliveries: input.onTimeDeliveries,
            revision_count: input.revisionCount,
          },
          { onConflict: "org_id,year_month,client_id" }
        );
        if (error) throw error;
      }
      d.refetch();
      toast.success("品質データを保存しました");
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }, [inputMap, d]);

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        {!embedded && <PageHeader title="品質指標" />}
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (d.isError) return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;

  return (
    <div className="space-y-6">
      {!embedded && <PageHeader title="品質指標" />}

      {/* Section 1: KPI Cards */}
      {/* Row 1: 案件数 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Package className="h-4 w-4" /> 案件数
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 案件数" value={`${kpis.prevDel}件`} />
          <KpiMiniCard label="今月 案件数" value={`${kpis.currDel}件`} />
          <GrowthCard label="前月比" value={kpis.deliveriesGrowth} />
          <KpiMiniCard label="通期 案件数" value={`${kpis.ytdDeliveries}件`} />
        </div>
      </div>

      {/* Row 2: 納期遵守数/率 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clock className="h-4 w-4" /> 納期遵守数 / 率
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 遵守数/率" value={`${kpis.prevOnTime}件 / ${kpis.prevOnTimeRate.toFixed(1)}%`} />
          <KpiMiniCard label="今月 遵守数/率" value={`${kpis.currOnTime}件 / ${kpis.currOnTimeRate.toFixed(1)}%`} />
          <DiffCard label="前月比" value={kpis.onTimeRateDiff} positiveIsGood={true} />
          <KpiMiniCard label="通期 平均遵守率" value={`${kpis.ytdAvgOnTimeRate.toFixed(1)}%`} />
        </div>
      </div>

      {/* Row 3: 修正発生数/率 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> 修正発生数 / 率
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 修正数/率" value={`${kpis.prevRevisions}件 / ${kpis.prevRevisionRate.toFixed(1)}%`} />
          <KpiMiniCard label="今月 修正数/率" value={`${kpis.currRevisions}件 / ${kpis.currRevisionRate.toFixed(1)}%`} />
          <DiffCard label="前月比" value={kpis.revisionRateDiff} positiveIsGood={false} />
          <KpiMiniCard label="通期 平均修正率" value={`${kpis.ytdAvgRevisionRate.toFixed(1)}%`} />
        </div>
      </div>

      {/* Section 2: Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
          <h3 className="text-sm font-semibold mb-4">案件数推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={editedMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => [`${v}件`, "案件数"]} />
              <Bar dataKey="deliveries" name="案件数" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <h3 className="text-sm font-semibold mb-4">納期遵守率推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={editedMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "納期遵守率"]} />
              <ReferenceLine y={95} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "目標 95%", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Line type="monotone" dataKey="onTimeRate" name="納期遵守率" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-sm font-semibold mb-4">修正発生率推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={editedMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "修正発生率"]} />
              <ReferenceLine y={20} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "目標 20%", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Line type="monotone" dataKey="revisionRate" name="修正発生率" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 3: Editable Transposed Table */}
      <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">品質データ入力テーブル</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetInputs} className="text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> リセット
            </Button>
            <Button size="sm" onClick={saveInputs} disabled={saving} className="text-xs gap-1">
              <Save className="h-3 w-3" /> {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">項目</TableHead>
              {editedMonthlyData.map((m) => (
                <TableHead key={m.ym} className="text-center whitespace-nowrap min-w-[80px]">{m.month}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 案件数 (read-only, from project_pl) */}
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件数</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono tabular-nums">{m.deliveries > 0 ? `${m.deliveries}件` : "-"}</TableCell>
              ))}
            </TableRow>

            {/* 納期遵守数 (editable) */}
            <TableRow className="bg-accent/30">
              <TableCell className="font-medium sticky left-0 bg-accent/30 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ 納期遵守数</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={inputMap[ym]?.onTimeDeliveries ?? 0}
                    onChange={(e) => updateInput(ym, "onTimeDeliveries", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[60px] font-mono tabular-nums"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* 納期遵守率 (auto-calculated) */}
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">納期遵守率</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell
                  key={m.ym}
                  className={cn(
                    "text-center font-mono tabular-nums whitespace-nowrap",
                    m.deliveries > 0 && m.onTimeRate < 95 && "bg-destructive/10 text-destructive font-semibold"
                  )}
                >
                  {m.deliveries > 0 ? `${m.onTimeRate.toFixed(1)}%` : "-"}
                </TableCell>
              ))}
            </TableRow>

            {/* 修正発生数 (editable) */}
            <TableRow className="bg-accent/30">
              <TableCell className="font-medium sticky left-0 bg-accent/30 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ 修正発生数</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={inputMap[ym]?.revisionCount ?? 0}
                    onChange={(e) => updateInput(ym, "revisionCount", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[60px] font-mono tabular-nums"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* 修正発生率 (auto-calculated) */}
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">修正発生率</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell
                  key={m.ym}
                  className={cn(
                    "text-center font-mono tabular-nums whitespace-nowrap",
                    m.deliveries > 0 && m.revisionRate > 20 && "bg-destructive/10 text-destructive font-semibold"
                  )}
                >
                  {m.deliveries > 0 ? `${m.revisionRate.toFixed(1)}%` : "-"}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

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
            placeholder="品質に関する質問を入力..."
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
          <p>・案件数 = project_plテーブルの当月レコード数（売上&gt;0）※顧客指標と同一データソース</p>
          <p>・納期遵守率 = 納期遵守数 ÷ 案件数 × 100（基準: 95%以上が目標）</p>
          <p>・修正発生率 = 修正発生数 ÷ 案件数 × 100（基準: 20%以下が目標）</p>
          <p>・通期平均 = 会計年度（5月〜当月）の各月の率の単純平均</p>
          <p className="text-muted-foreground/70 italic">※将来的にCheckGo AIと連携後は自動取得に切り替え予定。現在は手動入力。</p>
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
        {isPositive ? <TrendingUp className="h-4 w-4 text-chart-green" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className={`text-lg font-bold font-mono tabular-nums ${isPositive ? "text-chart-green" : "text-destructive"}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function DiffCard({ label, value, positiveIsGood }: { label: string; value: number; positiveIsGood: boolean }) {
  const isGood = positiveIsGood ? value >= 0 : value <= 0;
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {isGood ? <TrendingUp className="h-4 w-4 text-chart-green" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className={`text-lg font-bold font-mono tabular-nums ${isGood ? "text-chart-green" : "text-destructive"}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(1)}pt
        </span>
      </div>
    </div>
  );
}

export default Quality;
