import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Save, XCircle, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParsedRow {
  date: string;
  member: string;
  clientName: string;
  projectNo: string;
  projectName: string;
  projectType: string;
  workType: string;
  timeStr: string;
  detail: string;
  hours: number;
}

interface ClientSummary {
  clientName: string;
  clientId: string;
  hours: number;
}

interface MemberSummary {
  name: string;
  classification: string;
  totalHours: number;
  projectHours: number;
  selfHours: number;
  utilizationRate: number;
}

interface ResourceSummary {
  fulltimeCount: number;
  fulltimeTotalHours: number;
  fulltimeProjectHours: number;
  parttimeCount: number;
  parttimeTotalHours: number;
  parttimeProjectHours: number;
  totalLaborHours: number;
  projectHours: number;
  utilizationRate: number;
}

interface MemberClientHours {
  memberName: string;
  clientName: string;
  clientId: string;
  hours: number;
}

interface PreviewData {
  months: string[];
  excludedMemberRows: number;
  excludedSelfRows: number;
  totalRows: number;
  summaryByMonth: Record<string, ClientSummary[]>;
  memberSummaryByMonth: Record<string, MemberSummary[]>;
  resourceSummaryByMonth: Record<string, ResourceSummary>;
  memberClientByMonth: Record<string, MemberClientHours[]>;
}

interface MemberClassRow {
  member_name: string;
  employment_type: string;
  start_month: string | null;
  end_month: string | null;
}

function parseHHMM(timeStr: string): number {
  const trimmed = timeStr.trim();
  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  return parseFloat(trimmed) || 0;
}

function getYearMonth(dateStr: string): string {
  const cleaned = dateStr.trim().replace(/\//g, "-");
  const parts = cleaned.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  return "";
}

const SELF_PATTERNS = ["Off Beat株式会社（自社）", "Off Beat株式会社(自社)"];

function isSelfWork(clientName: string): boolean {
  return !clientName || SELF_PATTERNS.includes(clientName);
}

function getLastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

function isMemberActiveInMonth(mc: MemberClassRow, ym: string): boolean {
  if (mc.start_month && ym < mc.start_month) return false;
  if (mc.end_month && ym > mc.end_month) return false;
  return true;
}

export function PaceCsvUpload() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch excluded members from org settings
  const settingsQuery = useQuery({
    queryKey: ["org_settings", "excluded_members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("settings_json")
        .eq("id", ORG_ID)
        .single();
      if (data?.settings_json && typeof data.settings_json === "object") {
        const s = data.settings_json as Record<string, unknown>;
        return (s.excluded_members as string) ?? "井手 大貴";
      }
      return "井手 大貴";
    },
  });

  // Fetch member classifications
  const classQuery = useQuery({
    queryKey: ["member_classifications"],
    queryFn: async () => {
      const { data } = await (supabase.from("member_classifications" as any) as any)
        .select("*")
        .eq("org_id", ORG_ID);
      return (data as MemberClassRow[]) ?? [];
    },
  });

  // Fetch client name → id mapping from project_pl
  const clientMapQuery = useQuery({
    queryKey: ["project_pl", "client_map_pace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("client_id, client_name")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of data) {
        if (r.client_name && r.client_id) {
          map.set(r.client_name, String(r.client_id));
        }
      }
      return map;
    },
  });

  const memberClassifications = classQuery.data ?? [];
  const clientMap = clientMapQuery.data ?? new Map<string, string>();

  const getMemberType = (memberName: string, ym: string): string => {
    const mc = memberClassifications.find((c) => memberName.includes(c.member_name));
    if (!mc) return "未分類";
    if (!isMemberActiveInMonth(mc, ym)) return "非在籍";
    return mc.employment_type;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text: string;
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      text = new TextDecoder("utf-8").decode(bytes.slice(3));
    } else {
      text = new TextDecoder("utf-8").decode(bytes);
    }

    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      toast.error("CSVにデータがありません");
      return;
    }

    const dataLines = lines.slice(1);
    const parsed: ParsedRow[] = [];

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 8) continue;
      const [date, member, clientName, projectNo, projectName, projectType, workType, timeStr, ...detailParts] = cols;
      const hours = parseHHMM(timeStr);
      parsed.push({ date, member, clientName, projectNo, projectName, projectType, workType, timeStr, detail: detailParts.join(","), hours });
    }

    // Determine excluded members from CEO classification
    const ceoMembers = memberClassifications.filter((c) => c.employment_type === "CEO").map((c) => c.member_name);

    const excludedMemberRows = parsed.filter((r) =>
      ceoMembers.some((name) => r.member.includes(name))
    ).length;

    const excludedSelfRows = parsed.filter((r) => isSelfWork(r.clientName)).length;

    // Group by month
    const allMonths = new Set<string>();
    for (const r of parsed) {
      const ym = getYearMonth(r.date);
      if (ym) allMonths.add(ym);
    }
    const months = Array.from(allMonths).sort();

    // Build summaries per month
    const summaryByMonth: Record<string, ClientSummary[]> = {};
    const memberSummaryByMonth: Record<string, MemberSummary[]> = {};
    const resourceSummaryByMonth: Record<string, ResourceSummary> = {};
    const memberClientByMonth: Record<string, MemberClientHours[]> = {};

    for (const ym of months) {
      const monthRows = parsed.filter((r) => getYearMonth(r.date) === ym);

      // --- Client summary (exclude CEO and self) ---
      const clientRows = monthRows.filter((r) => {
        if (ceoMembers.some((name) => r.member.includes(name))) return false;
        if (isSelfWork(r.clientName)) return false;
        return true;
      });
      const byClient: Record<string, number> = {};
      for (const r of clientRows) {
        byClient[r.clientName] = (byClient[r.clientName] ?? 0) + r.hours;
      }
      summaryByMonth[ym] = Object.entries(byClient)
        .map(([clientName, hours]) => ({
          clientName,
          clientId: clientMap.get(clientName) ?? clientName,
          hours: Math.round(hours * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours);

      // --- Member summary (exclude CEO) ---
      const nonCeoRows = monthRows.filter((r) => !ceoMembers.some((name) => r.member.includes(name)));
      const byMember: Record<string, { total: number; project: number; self: number }> = {};
      for (const r of nonCeoRows) {
        if (!byMember[r.member]) byMember[r.member] = { total: 0, project: 0, self: 0 };
        byMember[r.member].total += r.hours;
        if (isSelfWork(r.clientName)) {
          byMember[r.member].self += r.hours;
        } else {
          byMember[r.member].project += r.hours;
        }
      }

      const memberSummaries: MemberSummary[] = Object.entries(byMember).map(([name, d]) => ({
        name,
        classification: getMemberType(name, ym),
        totalHours: Math.round(d.total * 10) / 10,
        projectHours: Math.round(d.project * 10) / 10,
        selfHours: Math.round(d.self * 10) / 10,
        utilizationRate: d.total > 0 ? Math.round((d.project / d.total) * 1000) / 10 : 0,
      }));
      memberSummaryByMonth[ym] = memberSummaries.sort((a, b) => {
        const order = ["正社員", "パート", "業務委託", "未分類", "非在籍"];
        return order.indexOf(a.classification) - order.indexOf(b.classification);
      });

      // --- Resource summary ---
      const fulltime = memberSummaries.filter((m) => m.classification === "正社員");
      const parttime = memberSummaries.filter((m) => m.classification === "パート");
      const ftTotal = fulltime.reduce((s, m) => s + m.totalHours, 0);
      const ftProject = fulltime.reduce((s, m) => s + m.projectHours, 0);
      const ptTotal = parttime.reduce((s, m) => s + m.totalHours, 0);
      const ptProject = parttime.reduce((s, m) => s + m.projectHours, 0);
      const totalAll = ftTotal + ptTotal;
      const projectAll = ftProject + ptProject;

      // --- Member × Client summary (exclude 井手 大貴, exclude self) ---
      const memberClientRows = monthRows.filter((r) => {
        if (r.member.includes("井手 大貴")) return false;
        if (isSelfWork(r.clientName)) return false;
        return true;
      });
      const byMemberClient: Record<string, number> = {};
      for (const r of memberClientRows) {
        const key = `${r.member}|||${r.clientName}`;
        byMemberClient[key] = (byMemberClient[key] ?? 0) + r.hours;
      }
      memberClientByMonth[ym] = Object.entries(byMemberClient).map(([key, hours]) => {
        const [memberName, clName] = key.split("|||");
        return {
          memberName,
          clientName: clName,
          clientId: clientMap.get(clName) ?? clName,
          hours: Math.round(hours * 10) / 10,
        };
      });

      resourceSummaryByMonth[ym] = {
        fulltimeCount: fulltime.length,
        fulltimeTotalHours: Math.round(ftTotal * 10) / 10,
        fulltimeProjectHours: Math.round(ftProject * 10) / 10,
        parttimeCount: parttime.length,
        parttimeTotalHours: Math.round(ptTotal * 10) / 10,
        parttimeProjectHours: Math.round(ptProject * 10) / 10,
        totalLaborHours: Math.round(totalAll * 10) / 10,
        projectHours: Math.round(projectAll * 10) / 10,
        utilizationRate: totalAll > 0 ? Math.round((projectAll / totalAll) * 1000) / 10 : 0,
      };
    }

    setPreview({
      months,
      excludedMemberRows,
      excludedSelfRows,
      totalRows: parsed.length,
      summaryByMonth,
      memberSummaryByMonth,
      resourceSummaryByMonth,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [memberClassifications, clientMap]);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    try {
      for (const ym of preview.months) {
        // 1. Save client_monthly_hours
        const summaries = preview.summaryByMonth[ym];
        for (const s of summaries) {
          await (supabase.from("client_monthly_hours" as any) as any).upsert(
            { org_id: ORG_ID, year_month: ym, client_id: s.clientId, client_name: s.clientName, hours: s.hours },
            { onConflict: "org_id,year_month,client_id" }
          );
        }

        // 2. Save resource metrics to kpi_snapshots
        const res = preview.resourceSummaryByMonth[ym];
        const snapshotDate = getLastDayOfMonth(ym);

        // Fetch gross_profit for GPH calculation
        const { data: salesData } = await supabase
          .from("monthly_sales")
          .select("gross_profit")
          .eq("org_id", ORG_ID)
          .eq("year_month", ym);
        const grossProfit = salesData?.reduce((s, r) => s + r.gross_profit, 0) ?? 0;

        const gphTotal = res.totalLaborHours > 0 ? grossProfit / res.totalLaborHours : 0;
        const gphProject = res.projectHours > 0 ? grossProfit / res.projectHours : 0;

        const metricsToSave: Record<string, number> = {
          fulltime_count: res.fulltimeCount,
          parttime_count: res.parttimeCount,
          fulltime_total_hours: res.fulltimeTotalHours,
          fulltime_project_hours: res.fulltimeProjectHours,
          parttime_total_hours: res.parttimeTotalHours,
          parttime_project_hours: res.parttimeProjectHours,
          total_labor_hours: res.totalLaborHours,
          project_hours: res.projectHours,
          employee_total_hours: res.fulltimeTotalHours,
          employee_project_hours: res.fulltimeProjectHours,
          parttimer_total_hours: res.parttimeTotalHours,
          parttimer_project_hours: res.parttimeProjectHours,
          gross_profit_per_hour: Math.round(gphTotal),
          gross_profit_per_project_hour: Math.round(gphProject),
        };

        for (const [metric, value] of Object.entries(metricsToSave)) {
          await supabase
            .from("kpi_snapshots")
            .delete()
            .eq("org_id", ORG_ID)
            .eq("metric_name", metric)
            .eq("snapshot_date", snapshotDate);
          await supabase
            .from("kpi_snapshots")
            .insert({ org_id: ORG_ID, metric_name: metric, snapshot_date: snapshotDate, actual_value: value });
          // Also save with -01 date for backward compat
          if (!snapshotDate.endsWith("-01")) {
            const altDate = `${ym}-01`;
            await supabase
              .from("kpi_snapshots")
              .delete()
              .eq("org_id", ORG_ID)
              .eq("metric_name", metric)
              .eq("snapshot_date", altDate);
            await supabase
              .from("kpi_snapshots")
              .insert({ org_id: ORG_ID, metric_name: metric, snapshot_date: altDate, actual_value: value });
          }
        }

        // Mark this month as having Pace data
        await supabase
          .from("kpi_snapshots")
          .delete()
          .eq("org_id", ORG_ID)
          .eq("metric_name", "pace_data_exists")
          .eq("snapshot_date", `${ym}-01`);
        await supabase
          .from("kpi_snapshots")
          .insert({ org_id: ORG_ID, metric_name: "pace_data_exists", snapshot_date: `${ym}-01`, actual_value: 1 });
      }

      queryClient.invalidateQueries({ queryKey: ["client_monthly_hours"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_snapshots"] });
      toast.success("Pace工数データを保存しました");
      setPreview(null);
      setOpen(false);
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }, [preview, queryClient]);

  const totalHoursForMonth = (summaries: ClientSummary[]) =>
    Math.round(summaries.reduce((s, c) => s + c.hours, 0) * 10) / 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
          <Upload className="h-3.5 w-3.5" /> Pace CSVアップロード
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Pace CSVアップロード
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> CSVファイルを選択
            </Button>
            <p className="text-xs text-muted-foreground mt-2">PaceからエクスポートしたCSVファイル（UTF-8）を選択してください</p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">対象月</p>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {preview.months.map((ym) => `${parseInt(ym.split("-")[1])}月`).join(", ")}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">総行数</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.totalRows}件</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> 除外（CEO）
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.excludedMemberRows}件</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> 除外（自社業務）
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.excludedSelfRows}件</p>
                </div>
              </div>

              {preview.months.map((ym) => {
                const summaries = preview.summaryByMonth[ym];
                const memberSummaries = preview.memberSummaryByMonth[ym];
                const resSummary = preview.resourceSummaryByMonth[ym];
                const monthNum = parseInt(ym.split("-")[1]);

                return (
                  <div key={ym} className="space-y-3">
                    <h4 className="text-sm font-semibold border-b border-border pb-1">{monthNum}月 ({ym})</h4>

                    {/* Member summary */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-secondary px-4 py-2 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">メンバー別集計</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">メンバー</TableHead>
                            <TableHead className="text-xs">分類</TableHead>
                            <TableHead className="text-xs text-right">総労働時間</TableHead>
                            <TableHead className="text-xs text-right">案件工数</TableHead>
                            <TableHead className="text-xs text-right">自社業務</TableHead>
                            <TableHead className="text-xs text-right">稼働率</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberSummaries.map((m) => (
                            <TableRow key={m.name}>
                              <TableCell className="text-xs">{m.name}</TableCell>
                              <TableCell className="text-xs">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  m.classification === "正社員" && "bg-primary/10 text-primary",
                                  m.classification === "パート" && "bg-chart-2/10 text-chart-2",
                                  m.classification === "未分類" && "bg-destructive/10 text-destructive",
                                )}>
                                  {m.classification}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono tabular-nums">{m.totalHours.toFixed(1)}h</TableCell>
                              <TableCell className="text-xs text-right font-mono tabular-nums">{m.projectHours.toFixed(1)}h</TableCell>
                              <TableCell className="text-xs text-right font-mono tabular-nums">{m.selfHours.toFixed(1)}h</TableCell>
                              <TableCell className="text-xs text-right font-mono tabular-nums">{m.utilizationRate.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Resource summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-semibold">正社員</p>
                        <p className="text-xs font-mono tabular-nums mt-1">
                          {resSummary.fulltimeCount}名 / 総{resSummary.fulltimeTotalHours.toFixed(1)}h / 案件{resSummary.fulltimeProjectHours.toFixed(1)}h
                        </p>
                      </div>
                      <div className="bg-chart-2/5 border border-chart-2/20 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-semibold">パート</p>
                        <p className="text-xs font-mono tabular-nums mt-1">
                          {resSummary.parttimeCount}名 / 総{resSummary.parttimeTotalHours.toFixed(1)}h / 案件{resSummary.parttimeProjectHours.toFixed(1)}h
                        </p>
                      </div>
                      <div className="bg-accent border border-border rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-semibold">合計</p>
                        <p className="text-xs font-mono tabular-nums mt-1">
                          総{resSummary.totalLaborHours.toFixed(1)}h / 案件{resSummary.projectHours.toFixed(1)}h / 稼働率{resSummary.utilizationRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Client summary */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-secondary px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold">顧客別集計</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          合計: {totalHoursForMonth(summaries)}h
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">顧客名</TableHead>
                            <TableHead className="text-xs text-right">工数</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaries.map((s) => (
                            <TableRow key={s.clientId}>
                              <TableCell className="text-xs">{s.clientName}</TableCell>
                              <TableCell className="text-xs text-right font-mono tabular-nums">{s.hours.toFixed(1)}h</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2 border-border font-semibold">
                            <TableCell className="text-xs font-semibold">合計</TableCell>
                            <TableCell className="text-xs text-right font-mono tabular-nums font-semibold">
                              {totalHoursForMonth(summaries).toFixed(1)}h
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}

              {/* Save button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>キャンセル</Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
