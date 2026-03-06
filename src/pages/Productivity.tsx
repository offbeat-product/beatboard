import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProductivityData, MonthlyHoursInput, MonthlyProductivityRow } from "@/hooks/useProductivityData";
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
import { ChevronDown, Bot, Send, Save, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { toast } from "sonner";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const Productivity = () => {
  usePageTitle("生産性指標");
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrencyUnit();
  const d = useProductivityData();
  const [logicOpen, setLogicOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Editable hours state: { "2025-05": { employeeTotalHours, ... }, ... }
  const [hoursMap, setHoursMap] = useState<Record<string, MonthlyHoursInput>>({});
  const [hoursInitialized, setHoursInitialized] = useState(false);

  // Re-initialize from default when data loads (including after kpi snapshots load)
  useEffect(() => {
    if (!d.isLoading && d.defaultHoursMap && Object.keys(d.defaultHoursMap).length > 0) {
      setHoursMap({ ...d.defaultHoursMap });
      setHoursInitialized(true);
    }
  }, [d.isLoading, d.defaultHoursMap]);

  // Recompute monthly data from editable hours
  const editedMonthlyData: MonthlyProductivityRow[] = useMemo(() => {
    if (!d.fiscalMonths || Object.keys(hoursMap).length === 0) return d.monthlyData;
    return d.fiscalMonths.map((ym) => {
      const hours = hoursMap[ym] ?? d.defaultHoursMap[ym];
      return d.computeMonthlyRow(ym, hours);
    });
  }, [hoursMap, d.fiscalMonths, d.defaultHoursMap, d.computeMonthlyRow, d.sales]);

  // Recompute KPI values
  const kpis = useMemo(() => {
    const currentData = editedMonthlyData.find((m) => m.ym === d.currentMonth);
    const prevData = editedMonthlyData.find((m) => m.ym === d.previousMonth);
    const currentGPH = currentData?.gph ?? 0;
    const prevGPH = prevData?.gph ?? 0;
    const gphMomChange = prevGPH > 0 ? ((currentGPH - prevGPH) / prevGPH) * 100 : 0;
    const currentProjectGPH = currentData?.projectGph ?? 0;
    const prevProjectGPH = prevData?.projectGph ?? 0;
    const projectGphMomChange = prevProjectGPH > 0 ? ((currentProjectGPH - prevProjectGPH) / prevProjectGPH) * 100 : 0;
    const activeMonths = editedMonthlyData.slice(0, d.currentIdx + 1).filter((m) => m.gph > 0);
    const avgGPH = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.gph, 0) / activeMonths.length : 0;
    const activeProjectMonths = editedMonthlyData.slice(0, d.currentIdx + 1).filter((m) => m.projectGph > 0);
    const avgProjectGPH = activeProjectMonths.length > 0 ? activeProjectMonths.reduce((s, m) => s + m.projectGph, 0) / activeProjectMonths.length : 0;
    return { currentGPH, prevGPH, gphMomChange, currentProjectGPH, prevProjectGPH, projectGphMomChange, avgGPH, avgProjectGPH };
  }, [editedMonthlyData, d.currentMonth, d.previousMonth, d.currentIdx]);

  // Chart data from edited
  const gphChartData = useMemo(() => editedMonthlyData.map((m) => ({
    name: m.label,
    粗利工数単価: Math.round(m.gph),
    案件粗利工数単価: Math.round(m.projectGph),
  })), [editedMonthlyData]);

  const perHeadChartData = useMemo(() => editedMonthlyData.map((m) => ({
    name: m.label,
    "1人あたり売上": Math.round(m.revenuePerHead),
    "1人あたり粗利": Math.round(m.grossProfitPerHead),
  })), [editedMonthlyData]);

  const updateHours = useCallback((ym: string, field: keyof MonthlyHoursInput, value: number) => {
    setHoursMap((prev) => ({
      ...prev,
      [ym]: { ...prev[ym], [field]: value },
    }));
  }, []);

  const resetHours = useCallback(() => {
    setHoursMap({ ...d.defaultHoursMap });
    toast.success("デフォルト値にリセットしました");
  }, [d.defaultHoursMap]);

  const saveHours = useCallback(async () => {
    setSaving(true);
    try {
      // Save each month's hours as kpi_snapshots
      const metrics = ["employee_total_hours", "employee_project_hours", "parttimer_total_hours", "parttimer_project_hours"] as const;
      const fieldMap: Record<string, keyof MonthlyHoursInput> = {
        employee_total_hours: "employeeTotalHours",
        employee_project_hours: "employeeProjectHours",
        parttimer_total_hours: "partTimerTotalHours",
        parttimer_project_hours: "partTimerProjectHours",
      };

      for (const ym of d.fiscalMonths) {
        const hours = hoursMap[ym];
        if (!hours) continue;
        for (const metric of metrics) {
          const value = hours[fieldMap[metric]];
          const snapshotDate = `${ym}-01`;
          // Upsert: delete then insert
          await supabase
            .from("kpi_snapshots")
            .delete()
            .eq("org_id", ORG_ID)
            .eq("metric_name", metric)
            .eq("snapshot_date", snapshotDate);
          await supabase
            .from("kpi_snapshots")
            .insert({
              org_id: ORG_ID,
              metric_name: metric,
              snapshot_date: snapshotDate,
              actual_value: value,
            });
        }
      }
      // Also save computed total_labor_hours and project_hours
      for (const m of editedMonthlyData) {
        const snapshotDate = `${m.ym}-01`;
        for (const [metric, value] of [["total_labor_hours", m.totalLaborHours], ["project_hours", m.projectHours]] as const) {
          await supabase
            .from("kpi_snapshots")
            .delete()
            .eq("org_id", ORG_ID)
            .eq("metric_name", metric)
            .eq("snapshot_date", snapshotDate);
          await supabase
            .from("kpi_snapshots")
            .insert({
              org_id: ORG_ID,
              metric_name: metric,
              snapshot_date: snapshotDate,
              actual_value: value,
            });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["kpi_snapshots"] });
      toast.success("工数データを保存しました");
    } catch (e) {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [hoursMap, editedMonthlyData, d.fiscalMonths, queryClient]);

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

  const gphMax = Math.max(
    ...gphChartData.map((c) => Math.max(c.粗利工数単価, c.案件粗利工数単価)),
    d.targetGPH,
    d.targetProjectGPH,
    1
  );
  const gphYMax = Math.ceil(gphMax * 1.2 / 1000) * 1000;

  const perHeadMax = Math.max(
    ...perHeadChartData.map((c) => Math.max(c["1人あたり売上"], c["1人あたり粗利"])),
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
          <DashboardKpiCard label="前月の粗利工数単価" value={`¥${Math.round(kpis.prevGPH).toLocaleString()}`} delay={0} />
          <DashboardKpiCard
            label="今月の粗利工数単価"
            value={`¥${Math.round(kpis.currentGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetGPH.toLocaleString()}`}
            progress={d.targetGPH > 0 ? (kpis.currentGPH / d.targetGPH) * 100 : undefined}
            delay={50}
          />
          <DashboardKpiCard
            label="前月比成長率"
            value={`${kpis.gphMomChange >= 0 ? "+" : ""}${kpis.gphMomChange.toFixed(1)}%`}
            change={growthArrow(kpis.gphMomChange)}
            delay={100}
          />
          <DashboardKpiCard
            label="通期平均粗利工数単価"
            value={`¥${Math.round(kpis.avgGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetGPH.toLocaleString()}`}
            progress={d.targetGPH > 0 ? (kpis.avgGPH / d.targetGPH) * 100 : undefined}
            delay={150}
          />
        </div>
      </div>

      {/* Row 2: Project GPH */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">案件粗利工数単価（案件工数）</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の案件粗利工数単価" value={`¥${Math.round(kpis.prevProjectGPH).toLocaleString()}`} delay={200} />
          <DashboardKpiCard
            label="今月の案件粗利工数単価"
            value={`¥${Math.round(kpis.currentProjectGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`}
            progress={d.targetProjectGPH > 0 ? (kpis.currentProjectGPH / d.targetProjectGPH) * 100 : undefined}
            delay={250}
          />
          <DashboardKpiCard
            label="前月比成長率"
            value={`${kpis.projectGphMomChange >= 0 ? "+" : ""}${kpis.projectGphMomChange.toFixed(1)}%`}
            change={growthArrow(kpis.projectGphMomChange)}
            delay={300}
          />
          <DashboardKpiCard
            label="通期平均案件粗利工数単価"
            value={`¥${Math.round(kpis.avgProjectGPH).toLocaleString()}`}
            target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`}
            progress={d.targetProjectGPH > 0 ? (kpis.avgProjectGPH / d.targetProjectGPH) * 100 : undefined}
            delay={350}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-sm font-semibold mb-4">工数単価推移</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={gphChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, gphYMax]} tickFormatter={(v) => `¥${v.toLocaleString()}`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }} formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]} />
              <Legend fontSize={12} />
              <ReferenceLine y={d.targetGPH} stroke="hsl(var(--chart-4))" strokeDasharray="6 4" strokeWidth={1.5} />
              <ReferenceLine y={d.targetProjectGPH} stroke="hsl(var(--chart-2))" strokeDasharray="6 4" strokeWidth={1.5} />
              <Line type="monotone" dataKey="粗利工数単価" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-4))" }} />
              <Line type="monotone" dataKey="案件粗利工数単価" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "hsl(var(--chart-2))" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-4">1人あたり指標推移</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={perHeadChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, perHeadYMax]} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }} formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]} />
              <Legend fontSize={12} />
              <Line type="monotone" dataKey="1人あたり売上" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              <Line type="monotone" dataKey="1人あたり粗利" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-2))" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Editable Resource Table */}
      <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">リソース内訳テーブル（工数入力）</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetHours} className="text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> リセット
            </Button>
            <Button size="sm" onClick={saveHours} disabled={saving} className="text-xs gap-1">
              <Save className="h-3 w-3" /> {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">項目</TableHead>
              {editedMonthlyData.map((m) => (
                <TableHead key={m.ym} className="text-center whitespace-nowrap min-w-[90px]">{m.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Employee counts (read-only) */}
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">正社員数</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono-num">{m.employees}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">パート数</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono-num">{m.partTimers}</TableCell>
              ))}
            </TableRow>

            {/* Editable: Employee Total Hours */}
            <TableRow className="bg-accent/30">
              <TableCell className="font-medium sticky left-0 bg-accent/30 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ 社員 総労働時間</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={hoursMap[ym]?.employeeTotalHours ?? 0}
                    onChange={(e) => updateHours(ym, "employeeTotalHours", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[70px] font-mono-num"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* Editable: Employee Project Hours */}
            <TableRow className="bg-accent/30">
              <TableCell className="font-medium sticky left-0 bg-accent/30 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ 社員 案件工数</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={hoursMap[ym]?.employeeProjectHours ?? 0}
                    onChange={(e) => updateHours(ym, "employeeProjectHours", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[70px] font-mono-num"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* Editable: Part-timer Total Hours */}
            <TableRow className="bg-accent/20">
              <TableCell className="font-medium sticky left-0 bg-accent/20 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ パート 総労働時間</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={hoursMap[ym]?.partTimerTotalHours ?? 0}
                    onChange={(e) => updateHours(ym, "partTimerTotalHours", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[70px] font-mono-num"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* Editable: Part-timer Project Hours */}
            <TableRow className="bg-accent/20">
              <TableCell className="font-medium sticky left-0 bg-accent/20 z-10 text-xs">
                <span className="text-primary font-semibold">✏️ パート 案件工数</span>
              </TableCell>
              {d.fiscalMonths.map((ym) => (
                <TableCell key={ym} className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={hoursMap[ym]?.partTimerProjectHours ?? 0}
                    onChange={(e) => updateHours(ym, "partTimerProjectHours", Number(e.target.value))}
                    className="h-8 text-xs text-center w-full min-w-[70px] font-mono-num"
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* Auto-calculated rows */}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold sticky left-0 bg-card z-10">総労働時間（合計）</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono-num font-semibold whitespace-nowrap">{m.totalLaborHours.toLocaleString()}h</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold sticky left-0 bg-card z-10">案件工数（合計）</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono-num font-semibold whitespace-nowrap">{m.projectHours.toLocaleString()}h</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件稼働率</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-center font-mono-num whitespace-nowrap", m.utilizationRate < 70 && "text-destructive font-semibold")}>
                  {fmtPct(m.utilizationRate)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">粗利</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className="text-center font-mono-num whitespace-nowrap">{formatAmount(m.grossProfit)}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">粗利工数単価</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-center font-mono-num whitespace-nowrap", m.gph < d.targetGPH && m.gph > 0 && "text-destructive font-semibold")}>
                  ¥{Math.round(m.gph).toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium sticky left-0 bg-card z-10">案件粗利工数単価</TableCell>
              {editedMonthlyData.map((m) => (
                <TableCell key={m.ym} className={cn("text-center font-mono-num whitespace-nowrap", m.projectGph < d.targetProjectGPH && m.projectGph > 0 && "text-destructive font-semibold")}>
                  ¥{Math.round(m.projectGph).toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="border-t-2 border-border bg-muted/30">
              <TableCell className="font-semibold sticky left-0 bg-muted/30 z-10">人件費予算</TableCell>
              {editedMonthlyData.map((m) => {
                const laborBudget = m.grossProfit - (m.revenue * 0.5);
                return (
                  <TableCell key={m.ym} className={cn("text-center font-mono-num whitespace-nowrap font-semibold", laborBudget < 0 && "text-destructive")}>
                    {formatAmount(Math.round(laborBudget))}
                  </TableCell>
                );
              })}
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
              <p>・<strong>総労働時間</strong> = 社員総労働時間 + パート総労働時間</p>
              <p>・<strong>案件工数</strong> = 社員案件工数 + パート案件工数</p>
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
