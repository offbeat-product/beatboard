import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, FileBarChart } from "lucide-react";
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

const statusBadge = (status: "success" | "warning" | "danger") => {
  const map = {
    success: { label: "達成", className: "bg-green-100 text-green-700 border-green-200" },
    warning: { label: "要注意", className: "bg-amber-100 text-amber-700 border-amber-200" },
    danger: { label: "未達", className: "bg-red-100 text-red-700 border-red-200" },
  } as const;
  const m = map[status] ?? map.warning;
  return <Badge variant="outline" className={cn("text-xs", m.className)}>{m.label}</Badge>;
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
    return () => { cancelled = true; };
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
      // Asymptotic toward 95% over 90s
      const p = Math.min(95, (elapsed / 90) * 95);
      setProgress(p);
    }, 500);
    return () => clearInterval(id);
  }, [generating]);

  const handleGenerate = useCallback(async (force: boolean) => {
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
  }, [yearMonth]);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <FileBarChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">月次統合レポート</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ymLabel} ・ 最終生成: {fmtGeneratedAt(generatedAt)}
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
              <Button
                onClick={() => handleGenerate(false)}
                disabled={generating || loading}
                size="sm"
              >
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
              <span>AI が分析中...(約90秒)</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
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
          <p className="mt-4 text-sm text-muted-foreground">
            「レポートを生成」ボタンをクリックすると、AI が {ymLabel} のデータを統合分析し、
            目標・現状・ギャップ・課題・方針・解決策・次月アクションの 7 項目構造でレポートを作成します。
          </p>
        )}
      </div>

      {/* Report content */}
      {report && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-5">
          {/* Headline */}
          <div className="mb-4 pb-4 border-b border-border">
            <h2 className="text-lg font-bold">{report.headline?.title}</h2>
            {report.headline?.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{report.headline.subtitle}</p>
            )}
          </div>

          <Accordion type="multiple" defaultValue={["goal", "current", "gap"]} className="space-y-1">
            {/* 1. Goal */}
            <AccordionItem value="goal">
              <AccordionTrigger className="text-sm font-semibold">
                1. 目標(Goal)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {report.goal?.pillars?.map((p, i) => (
                    <div key={i} className="border-l-2 border-primary pl-3">
                      <p className="text-xs text-muted-foreground">{p.label}</p>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-sm text-primary font-mono">{p.metric}</p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      )}
                    </div>
                  ))}
                  {report.goal?.kpis?.map((cat, i) => (
                    <div key={i} className="mt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{cat.category}</p>
                      <ul className="text-sm space-y-1">
                        {cat.items?.map((it, j) => (
                          <li key={j} className="flex justify-between gap-2 border-b border-border/50 py-1">
                            <span>{it.name}</span>
                            <span className="font-mono text-muted-foreground">{it.target}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Current */}
            <AccordionItem value="current">
              <AccordionTrigger className="text-sm font-semibold">
                2. 現状(Current)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {report.current?.pillars?.map((p, i) => (
                    <div key={i} className="border border-border rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{p.label}</p>
                          <p className="text-sm font-medium">{p.title}</p>
                        </div>
                        {statusBadge(p.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">目標</p>
                          <p className="font-mono">{p.target_value}{p.unit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">実績</p>
                          <p className="font-mono font-semibold">{p.actual_value}{p.unit}</p>
                        </div>
                      </div>
                      {p.note && <p className="text-xs text-muted-foreground mt-2">{p.note}</p>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Gap */}
            <AccordionItem value="gap">
              <AccordionTrigger className="text-sm font-semibold">
                3. ギャップ(Gap)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {report.gap?.pillars?.map((p, i) => (
                    <div key={i} className="border border-border rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{p.title}</p>
                        {statusBadge(p.status)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">目標</p>
                          <p className="font-mono">{p.target}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">実績</p>
                          <p className="font-mono">{p.actual}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">差</p>
                          <p className="font-mono font-semibold">{p.gap}{p.gap_unit}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, p.progress_rate))}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">進捗 {p.progress_rate}%</p>
                      </div>
                      {p.note && <p className="text-xs text-muted-foreground mt-2">{p.note}</p>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Issue */}
            <AccordionItem value="issue">
              <AccordionTrigger className="text-sm font-semibold">
                4. 課題(Issue)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {report.issue?.root_causes?.map((rc, i) => (
                    <div key={i} className="border border-border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{rc.rank}</Badge>
                        <Badge variant="outline" className="text-xs">優先度: {rc.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium">{rc.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rc.description}</p>
                      {rc.impact?.length > 0 && (
                        <ul className="mt-2 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                          {rc.impact.map((im, j) => <li key={j}>{im}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Policy */}
            <AccordionItem value="policy">
              <AccordionTrigger className="text-sm font-semibold">
                5. 方針(Policy)
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{report.policy?.headline_title}</p>
                    {report.policy?.headline_subtitle && (
                      <p className="text-xs text-muted-foreground">{report.policy.headline_subtitle}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-green-200 rounded-md p-3 bg-green-50/50">
                      <p className="text-xs font-semibold text-green-700 mb-2">YES(やる)</p>
                      <ul className="text-sm space-y-1">
                        {report.policy?.yes_items?.map((it, i) => <li key={i}>・{it}</li>)}
                      </ul>
                    </div>
                    <div className="border border-red-200 rounded-md p-3 bg-red-50/50">
                      <p className="text-xs font-semibold text-red-700 mb-2">NO(やらない)</p>
                      <ul className="text-sm space-y-1">
                        {report.policy?.no_items?.map((it, i) => <li key={i}>・{it}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 6. Solution */}
            <AccordionItem value="solution">
              <AccordionTrigger className="text-sm font-semibold">
                6. 解決策(Solution)
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{report.solution?.headline_title}</p>
                    {report.solution?.headline_subtitle && (
                      <p className="text-xs text-muted-foreground">{report.solution.headline_subtitle}</p>
                    )}
                  </div>
                  {report.solution?.items?.map((it, i) => (
                    <div key={i} className="border-l-2 border-primary pl-3">
                      <p className="text-sm font-medium">{it.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{it.detail}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 7. Next Action */}
            <AccordionItem value="next_action">
              <AccordionTrigger className="text-sm font-semibold">
                7. 次月アクション(Next Action)
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{report.next_action?.headline_title}</p>
                    {report.next_action?.headline_subtitle && (
                      <p className="text-xs text-muted-foreground">{report.next_action.headline_subtitle}</p>
                    )}
                  </div>
                  {report.next_action?.top_priority && (
                    <div className="border border-primary/30 bg-primary/5 rounded-md p-3">
                      <p className="text-xs font-semibold text-primary mb-1">最優先アクション</p>
                      <p className="text-sm font-medium">{report.next_action.top_priority.title}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">担当</p>
                          <p>{report.next_action.top_priority.owner}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">期限</p>
                          <p>{report.next_action.top_priority.deadline}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">期待効果</p>
                          <p>{report.next_action.top_priority.impact}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {report.next_action?.timeline?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">タイムライン</p>
                      <ul className="text-sm space-y-1">
                        {report.next_action.timeline.map((t, i) => (
                          <li key={i} className="flex gap-2 border-b border-border/50 py-1">
                            <span className="font-mono text-muted-foreground shrink-0 w-20">{t.when}</span>
                            <span>{t.what}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}
