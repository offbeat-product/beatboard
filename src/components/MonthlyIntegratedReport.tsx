import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  FileBarChart,
  Target,
  Activity,
  TrendingDown,
  AlertTriangle,
  Compass,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Zap,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { ORG_ID } from "@/lib/fiscalYear";
import { PptxDownloadButton } from "@/components/PptxDownloadButton";
import type { MonthlyReportData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  yearMonth: string;
  ymLabel: string;
}

const fmtGeneratedAt = (iso: string | null): string => {
  if (!iso) return "未生成";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "未生成";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}年${mo}月${day}日 ${h}:${min}`;
};

const STATUS_MAP = {
  success: {
    label: "達成",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
    ring: "border-emerald-200",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    Icon: CheckCircle2,
  },
  warning: {
    label: "要注意",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
    ring: "border-amber-200",
    soft: "bg-amber-50",
    text: "text-amber-700",
    Icon: AlertTriangle,
  },
  danger: {
    label: "未達",
    badge: "bg-red-100 text-red-700 border-red-200",
    bar: "bg-red-500",
    ring: "border-red-200",
    soft: "bg-red-50",
    text: "text-red-700",
    Icon: XCircle,
  },
} as const;

type StatusKey = keyof typeof STATUS_MAP;

const SectionHeader = ({
  step,
  title,
  subtitle,
  Icon,
  accent = "primary",
}: {
  step: number;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "emerald" | "amber" | "red" | "indigo" | "violet" | "sky";
}) => {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-violet-100 text-violet-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", accentMap[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
            STEP {String(step).padStart(2, "0")}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <h3 className="text-lg font-bold mt-0.5">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
};

export function MonthlyIntegratedReport({ yearMonth, ymLabel }: Props) {
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Load cached report
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReport(null);
    setGeneratedAt(null);
    (async () => {
      const { data } = await supabase
        .from("report_cache")
        .select("report_content, generated_at")
        .eq("org_id", ORG_ID)
        .eq("year_month", yearMonth)
        .eq("report_type", "monthly_integrated")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.report_content) {
        try {
          setReport(JSON.parse(data.report_content) as MonthlyReportData);
          setGeneratedAt(data.generated_at);
        } catch (e) {
          console.error("Failed to parse report JSON:", e);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [yearMonth]);

  // Progress simulation during generation (~90s)
  useEffect(() => {
    if (!generating) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const p = Math.min(95, (elapsed / 90) * 95);
      setProgress(p);
    }, 500);
    return () => clearInterval(id);
  }, [generating]);

  const handleGenerate = useCallback(
    async (force: boolean) => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-monthly-report", {
          body: { year_month: yearMonth, org_id: ORG_ID, force },
        });
        if (error) throw error;
        if (!data) throw new Error("レスポンスが空です");
        const parsed = (typeof data === "string" ? JSON.parse(data) : data) as MonthlyReportData;
        setReport(parsed);
        setGeneratedAt(new Date().toISOString());
        setProgress(100);
        toast.success("月次統合レポートを生成しました");
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "レポート生成に失敗しました";
        toast.error(msg);
      } finally {
        setGenerating(false);
      }
    },
    [yearMonth]
  );

  // ===== Executive Summary metrics =====
  const summary = (() => {
    if (!report?.current?.pillars) return null;
    const pillars = report.current.pillars;
    const total = pillars.length;
    const success = pillars.filter((p) => p.status === "success").length;
    const warning = pillars.filter((p) => p.status === "warning").length;
    const danger = pillars.filter((p) => p.status === "danger").length;
    const achievementRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, warning, danger, achievementRate };
  })();

  return (
    <div className="space-y-5">
      {/* ============ HEADER CARD ============ */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                <FileBarChart className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] font-semibold tracking-wider">
                    AI 統合分析
                  </Badge>
                  <span className="text-xs text-muted-foreground">{ymLabel}</span>
                </div>
                <h2 className="text-xl font-bold">月次統合レポート</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  目標 → 現状 → ギャップ → 課題 → 方針 → 解決策 → 次月アクション の7段階で経営状況を統合分析
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  最終生成: <span className="font-mono">{fmtGeneratedAt(generatedAt)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {report ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(true)}
                    disabled={generating || loading}
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                    )}
                    再生成
                  </Button>
                  <PptxDownloadButton reportData={report} disabled={generating} />
                </>
              ) : (
                <Button onClick={() => handleGenerate(false)} disabled={generating || loading}>
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1.5" />
                  )}
                  レポートを生成
                </Button>
              )}
            </div>
          </div>

          {/* Generating progress */}
          {generating && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI が分析中...(約90秒)
                </span>
                <span className="font-mono font-semibold">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {loading && !generating && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              読み込み中...
            </div>
          )}

          {!loading && !generating && !report && (
            <div className="mt-5 p-4 rounded-lg bg-muted/30 border border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                <Sparkles className="inline h-4 w-4 text-primary mr-1.5" />
                「レポートを生成」をクリックすると、AI が <span className="font-semibold text-foreground">{ymLabel}</span> のデータを統合分析し、
                目標・現状・ギャップ・課題・方針・解決策・次月アクションの7項目構造でレポートを作成します。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============ REPORT CONTENT ============ */}
      {report && (
        <>
          {/* Headline */}
          {report.headline?.title && (
            <div className="rounded-xl border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent p-5">
              <p className="text-[10px] font-bold tracking-widest text-primary mb-1">HEADLINE</p>
              <h2 className="text-2xl font-bold leading-tight">{report.headline.title}</h2>
              {report.headline.subtitle && (
                <p className="text-sm text-muted-foreground mt-2">{report.headline.subtitle}</p>
              )}
            </div>
          )}

          {/* Executive Summary */}
          {summary && summary.total > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">EXECUTIVE SUMMARY</p>
                  <h3 className="text-base font-bold">サマリー</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {summary.total} 指標
                </Badge>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-4 bg-gradient-to-br from-primary/5 to-card">
                  <p className="text-xs text-muted-foreground">総合達成率</p>
                  <p className="text-3xl font-bold font-mono mt-1">
                    {summary.achievementRate}
                    <span className="text-base text-muted-foreground">%</span>
                  </p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70"
                      style={{ width: `${summary.achievementRate}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <p className="text-xs font-semibold">達成</p>
                  </div>
                  <p className="text-3xl font-bold font-mono mt-1 text-emerald-700">{summary.success}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">目標達成済み</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <p className="text-xs font-semibold">要注意</p>
                  </div>
                  <p className="text-3xl font-bold font-mono mt-1 text-amber-700">{summary.warning}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">注視が必要</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-center gap-1.5 text-red-700">
                    <XCircle className="h-3.5 w-3.5" />
                    <p className="text-xs font-semibold">未達</p>
                  </div>
                  <p className="text-3xl font-bold font-mono mt-1 text-red-700">{summary.danger}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">改善が必要</p>
                </div>
              </div>
            </div>
          )}

          {/* 1. GOAL */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={1}
              title="目標 (Goal)"
              subtitle="達成すべきゴールと主要KPI"
              Icon={Target}
              accent="primary"
            />
            <div className="space-y-4">
              {report.goal?.pillars && report.goal.pillars.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.goal.pillars.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border p-4 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-md transition-shadow"
                    >
                      <p className="text-[10px] font-bold tracking-wider text-primary">{p.label}</p>
                      <p className="text-sm font-semibold mt-1">{p.title}</p>
                      <p className="text-xl font-bold font-mono text-foreground mt-2">{p.metric}</p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{p.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {report.goal?.kpis?.map((cat, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                    {cat.category}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {cat.items?.map((it, j) => (
                      <div
                        key={j}
                        className="flex justify-between items-center gap-2 border-b border-border/40 py-2 text-sm"
                      >
                        <span className="text-foreground">{it.name}</span>
                        <span className="font-mono font-semibold text-primary">{it.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. CURRENT */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={2}
              title="現状 (Current)"
              subtitle="目標に対する現在の実績"
              Icon={Activity}
              accent="sky"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {report.current?.pillars?.map((p, i) => {
                const s = STATUS_MAP[(p.status as StatusKey) ?? "warning"];
                return (
                  <div
                    key={i}
                    className={cn("rounded-lg border-2 p-4 transition-shadow hover:shadow-md", s.ring, s.soft)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground">{p.label}</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{p.title}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", s.badge)}>
                        <s.Icon className="h-3 w-3 mr-1" />
                        {s.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-card/60 p-2">
                        <p className="text-[10px] text-muted-foreground">目標</p>
                        <p className="font-mono text-sm font-semibold">
                          {p.target_value}
                          <span className="text-xs text-muted-foreground ml-0.5">{p.unit}</span>
                        </p>
                      </div>
                      <div className="rounded-md bg-card p-2 border border-border">
                        <p className="text-[10px] text-muted-foreground">実績</p>
                        <p className={cn("font-mono text-sm font-bold", s.text)}>
                          {p.actual_value}
                          <span className="text-xs text-muted-foreground ml-0.5">{p.unit}</span>
                        </p>
                      </div>
                    </div>
                    {p.note && <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{p.note}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. GAP */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={3}
              title="ギャップ (Gap)"
              subtitle="目標と実績の差分・進捗率"
              Icon={TrendingDown}
              accent="amber"
            />
            <div className="space-y-3">
              {report.gap?.pillars?.map((p, i) => {
                const s = STATUS_MAP[(p.status as StatusKey) ?? "warning"];
                const pct = Math.min(100, Math.max(0, p.progress_rate ?? 0));
                return (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-sm font-semibold">{p.title}</p>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", s.badge)}>
                        {s.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">目標</p>
                        <p className="font-mono text-sm font-semibold">{p.target}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">実績</p>
                        <p className="font-mono text-sm font-semibold">{p.actual}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">差分</p>
                        <p className={cn("font-mono text-sm font-bold", s.text)}>
                          {p.gap}
                          <span className="text-xs text-muted-foreground ml-0.5">{p.gap_unit}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>進捗率</span>
                        <span className="font-mono font-semibold">{p.progress_rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all", s.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {p.note && <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{p.note}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. ISSUE */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={4}
              title="課題 (Issue)"
              subtitle="優先度順の根本原因"
              Icon={AlertTriangle}
              accent="red"
            />
            <div className="space-y-3">
              {report.issue?.root_causes?.map((rc, i) => {
                const priorityColor =
                  rc.priority === "高" || rc.priority === "high"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : rc.priority === "中" || rc.priority === "medium"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200";
                return (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                        {rc.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold">{rc.title}</p>
                          <Badge variant="outline" className={cn("text-[10px]", priorityColor)}>
                            優先度: {rc.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rc.description}</p>
                        {rc.impact?.length > 0 && (
                          <div className="mt-3 rounded-md bg-muted/30 p-3">
                            <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1.5">
                              影響範囲
                            </p>
                            <ul className="space-y-1">
                              {rc.impact.map((im, j) => (
                                <li key={j} className="text-xs text-foreground flex items-start gap-1.5">
                                  <ArrowRight className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                  <span>{im}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. POLICY */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={5}
              title="方針 (Policy)"
              subtitle="やる・やらないの意思決定"
              Icon={Compass}
              accent="indigo"
            />
            <div className="space-y-4">
              {report.policy?.headline_title && (
                <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-4">
                  <p className="text-sm font-bold text-indigo-900">{report.policy.headline_title}</p>
                  {report.policy.headline_subtitle && (
                    <p className="text-xs text-indigo-700/80 mt-1">{report.policy.headline_subtitle}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700">YES — やる</p>
                  </div>
                  <ul className="space-y-2">
                    {report.policy?.yes_items?.map((it, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border-2 border-red-200 bg-red-50/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <XCircle className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold text-red-700">NO — やらない</p>
                  </div>
                  <ul className="space-y-2">
                    {report.policy?.no_items?.map((it, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-red-600 font-bold mt-0.5">✕</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 6. SOLUTION */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={6}
              title="解決策 (Solution)"
              subtitle="課題に対する具体的アプローチ"
              Icon={Lightbulb}
              accent="violet"
            />
            <div className="space-y-3">
              {report.solution?.headline_title && (
                <div className="rounded-lg bg-violet-50/50 border border-violet-100 p-4 mb-2">
                  <p className="text-sm font-bold text-violet-900">{report.solution.headline_title}</p>
                  {report.solution.headline_subtitle && (
                    <p className="text-xs text-violet-700/80 mt-1">{report.solution.headline_subtitle}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.solution?.items?.map((it, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{it.title}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{it.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 7. NEXT ACTION */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader
              step={7}
              title="次月アクション (Next Action)"
              subtitle="優先度・担当・期限"
              Icon={Zap}
              accent="primary"
            />
            <div className="space-y-4">
              {report.next_action?.headline_title && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-bold text-foreground">{report.next_action.headline_title}</p>
                  {report.next_action.headline_subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{report.next_action.headline_subtitle}</p>
                  )}
                </div>
              )}

              {report.next_action?.top_priority && (
                <div className="rounded-xl border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest rounded-bl-lg">
                    最優先
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="h-5 w-5 text-primary" />
                    <p className="text-xs font-bold tracking-wider text-primary">TOP PRIORITY ACTION</p>
                  </div>
                  <p className="text-base font-bold mb-4">{report.next_action.top_priority.title}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-md bg-card border border-border p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <User className="h-3 w-3" />
                        <p className="text-[10px] font-bold tracking-wider">担当</p>
                      </div>
                      <p className="text-sm font-semibold">{report.next_action.top_priority.owner}</p>
                    </div>
                    <div className="rounded-md bg-card border border-border p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        <p className="text-[10px] font-bold tracking-wider">期限</p>
                      </div>
                      <p className="text-sm font-semibold font-mono">{report.next_action.top_priority.deadline}</p>
                    </div>
                    <div className="rounded-md bg-card border border-border p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Zap className="h-3 w-3" />
                        <p className="text-[10px] font-bold tracking-wider">期待効果</p>
                      </div>
                      <p className="text-sm font-semibold">{report.next_action.top_priority.impact}</p>
                    </div>
                  </div>
                </div>
              )}

              {report.next_action?.timeline?.length > 0 && (
                <div>
                  <p className="text-xs font-bold tracking-wider text-muted-foreground mb-3">アクションタイムライン</p>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-3">
                      {report.next_action.timeline.map((t, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card shadow" />
                          <div className="rounded-lg border border-border bg-card p-3 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                                {t.when}
                              </Badge>
                              <p className="text-sm flex-1">{t.what}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
