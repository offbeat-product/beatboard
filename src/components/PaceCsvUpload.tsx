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
import { Upload, FileUp, Eye, Save, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

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

interface PreviewData {
  targetMonth: string;
  months: string[];
  excludedMemberRows: number;
  excludedSelfRows: number;
  totalRows: number;
  summaryByMonth: Record<string, ClientSummary[]>;
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
  // Handle formats like "2025-11-28" or "2025/11/28"
  const cleaned = dateStr.trim().replace(/\//g, "-");
  const parts = cleaned.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  return "";
}

export function PaceCsvUpload() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [rawParsed, setRawParsed] = useState<ParsedRow[]>([]);

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

  const excludedMembers = (settingsQuery.data ?? "井手 大貴")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const clientMap = clientMapQuery.data ?? new Map<string, string>();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    // Handle BOM
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

    // Skip header
    const dataLines = lines.slice(1);
    const parsed: ParsedRow[] = [];

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 8) continue;
      const [date, member, clientName, projectNo, projectName, projectType, workType, timeStr, ...detailParts] = cols;
      const hours = parseHHMM(timeStr);
      parsed.push({
        date, member, clientName, projectNo, projectName,
        projectType, workType, timeStr, detail: detailParts.join(","), hours,
      });
    }

    setRawParsed(parsed);

    // Count exclusions
    const excludedMemberRows = parsed.filter((r) =>
      excludedMembers.some((name) => r.member.includes(name))
    ).length;

    const selfCompanyPatterns = ["Off Beat株式会社（自社）", "Off Beat株式会社(自社)", ""];
    const excludedSelfRows = parsed.filter((r) =>
      selfCompanyPatterns.includes(r.clientName) || !r.clientName
    ).length;

    // Filter valid rows
    const validRows = parsed.filter((r) => {
      if (excludedMembers.some((name) => r.member.includes(name))) return false;
      if (selfCompanyPatterns.includes(r.clientName) || !r.clientName) return false;
      return true;
    });

    // Group by year_month, then by clientName
    const byMonth: Record<string, Record<string, number>> = {};
    for (const r of validRows) {
      const ym = getYearMonth(r.date);
      if (!ym) continue;
      if (!byMonth[ym]) byMonth[ym] = {};
      byMonth[ym][r.clientName] = (byMonth[ym][r.clientName] ?? 0) + r.hours;
    }

    const months = Object.keys(byMonth).sort();
    const summaryByMonth: Record<string, ClientSummary[]> = {};
    for (const ym of months) {
      summaryByMonth[ym] = Object.entries(byMonth[ym])
        .map(([clientName, hours]) => ({
          clientName,
          clientId: clientMap.get(clientName) ?? clientName,
          hours: Math.round(hours * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours);
    }

    setPreview({
      targetMonth: months[0] ?? "",
      months,
      excludedMemberRows,
      excludedSelfRows,
      totalRows: parsed.length,
      summaryByMonth,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [excludedMembers, clientMap]);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    try {
      for (const ym of preview.months) {
        const summaries = preview.summaryByMonth[ym];
        for (const s of summaries) {
          await (supabase.from("client_monthly_hours" as any) as any).upsert(
            {
              org_id: ORG_ID,
              year_month: ym,
              client_id: s.clientId,
              client_name: s.clientName,
              hours: s.hours,
            },
            { onConflict: "org_id,year_month,client_id" }
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["client_monthly_hours"] });
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Pace CSVアップロード
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" /> CSVファイルを選択
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              PaceからエクスポートしたCSVファイル（UTF-8）を選択してください
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">対象月</p>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {preview.months.map((ym) => {
                      const m = parseInt(ym.split("-")[1]);
                      return `${m}月`;
                    }).join(", ")}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">総行数</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.totalRows}件</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-muted-foreground" /> 除外（メンバー）
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.excludedMemberRows}件</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {excludedMembers.join(", ")}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-muted-foreground" /> 除外（自社業務）
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums">{preview.excludedSelfRows}件</p>
                </div>
              </div>

              {/* Summary tables per month */}
              {preview.months.map((ym) => {
                const summaries = preview.summaryByMonth[ym];
                const monthNum = parseInt(ym.split("-")[1]);
                return (
                  <div key={ym} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-secondary px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">{monthNum}月 ({ym})</span>
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
                );
              })}

              {/* Save button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                  キャンセル
                </Button>
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
