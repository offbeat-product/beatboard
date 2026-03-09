import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID, getFiscalYearMonths, getMonthLabel } from "@/lib/fiscalYear";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileUp, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FISCAL_MONTHS = getFiscalYearMonths(2026);

interface ParsedRecord {
  projectName: string;
  clientName: string;
  onTime: boolean;
  hasRevision: boolean;
}

interface ClientAggregation {
  client_name: string;
  total_deliveries: number;
  on_time_deliveries: number;
  revision_count: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseQualityCsv(csvText: string): ParsedRecord[] {
  const lines = csvText.split("\n");

  // Find header row containing "案件名" and "顧客名"
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("案件名") && lines[i].includes("顧客名")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const records: ParsedRecord[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 4) continue;

    // Use columns from the end to handle variable leading columns
    const revision = cols[cols.length - 1]?.trim();
    const onTimeStr = cols[cols.length - 2]?.trim();
    const clientName = cols[cols.length - 3]?.trim();
    const projectName = cols[cols.length - 4]?.trim() || "";

    if (!clientName || clientName === "顧客名") continue;

    const isOnTime = onTimeStr === "OK" || onTimeStr === "ok";
    const hasRevision = revision === "あり" || revision === "アリ" || revision === "有";

    records.push({
      projectName,
      clientName,
      onTime: isOnTime,
      hasRevision,
    });
  }

  return records;
}

function aggregateByClient(records: ParsedRecord[]): ClientAggregation[] {
  const byClient: Record<string, ClientAggregation> = {};
  for (const r of records) {
    if (!byClient[r.clientName]) {
      byClient[r.clientName] = {
        client_name: r.clientName,
        total_deliveries: 0,
        on_time_deliveries: 0,
        revision_count: 0,
      };
    }
    byClient[r.clientName].total_deliveries++;
    if (r.onTime) byClient[r.clientName].on_time_deliveries++;
    if (r.hasRevision) byClient[r.clientName].revision_count++;
  }
  return Object.values(byClient).sort((a, b) => b.total_deliveries - a.total_deliveries);
}

function detectYearMonthFromFilename(fileName: string): string | null {
  // The filename pattern: 【202604期】..._-_202509.csv
  // The trailing YYYYMM before .csv is the actual target month
  // Try to match the last YYYYMM pattern (closest to extension)
  const matches = [...fileName.matchAll(/(20\d{2})(0[1-9]|1[0-2])/g)];
  if (matches.length > 0) {
    // Use the LAST match (e.g. "202509" from "【202604期】..._-_202509.csv")
    const last = matches[matches.length - 1];
    return `${last[1]}-${last[2]}`;
  }
  return null;
}

function detectYearMonthFromContent(csvText: string): string | null {
  // Look for patterns like "2025年9月" or "2025年09月" in the CSV content
  const match = csvText.match(/(20\d{2})年(0?[1-9]|1[0-2])月/);
  if (match) {
    const month = match[2].padStart(2, "0");
    return `${match[1]}-${month}`;
  }
  return null;
}

export function QualityCsvUpload() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedYm, setSelectedYm] = useState(FISCAL_MONTHS[FISCAL_MONTHS.length - 1]);
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [aggregated, setAggregated] = useState<ClientAggregation[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  // Fetch client name → id mapping from project_pl
  const clientMapQuery = useQuery({
    queryKey: ["project_pl", "client_map_quality_csv"],
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

  const clientMap = clientMapQuery.data ?? new Map<string, string>();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Auto-detect year_month from filename (use last YYYYMM in filename)
    const detectedFromName = detectYearMonthFromFilename(file.name);
    let autoDetected = false;
    if (detectedFromName && FISCAL_MONTHS.includes(detectedFromName)) {
      setSelectedYm(detectedFromName);
      autoDetected = true;
    }

    // Try UTF-8 first, fallback to Shift-JIS if garbled
    let text = await file.text();
    if (text.includes("\ufffd") || text.includes("�")) {
      const buffer = await file.arrayBuffer();
      text = new TextDecoder("shift-jis").decode(buffer);
    }

    const parsed = parseQualityCsv(text);
    if (parsed.length === 0) {
      toast.error("CSVからデータをパースできませんでした。フォーマットを確認してください。");
      return;
    }

    setRecords(parsed);
    // Auto-preview
    const agg = aggregateByClient(parsed);
    setAggregated(agg);
    setPreviewed(true);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handlePreview = useCallback(() => {
    const agg = aggregateByClient(records);
    setAggregated(agg);
    setPreviewed(true);
  }, [records]);

  const handleSave = useCallback(async () => {
    if (aggregated.length === 0) return;
    setSaving(true);
    try {
      for (const row of aggregated) {
        const clientId = clientMap.get(row.client_name) ?? row.client_name;
        const { error } = await supabase.from("quality_monthly").upsert(
          {
            org_id: ORG_ID,
            year_month: selectedYm,
            client_id: clientId,
            client_name: row.client_name,
            total_deliveries: row.total_deliveries,
            on_time_deliveries: row.on_time_deliveries,
            revision_count: row.revision_count,
          },
          { onConflict: "org_id,year_month,client_id" }
        );
        if (error) throw error;
      }

      // Also update the __total__ aggregated row
      const totalDel = aggregated.reduce((s, r) => s + r.total_deliveries, 0);
      const totalOnTime = aggregated.reduce((s, r) => s + r.on_time_deliveries, 0);
      const totalRev = aggregated.reduce((s, r) => s + r.revision_count, 0);
      await supabase.from("quality_monthly").upsert(
        {
          org_id: ORG_ID,
          year_month: selectedYm,
          client_id: "__total__",
          client_name: "合計",
          total_deliveries: totalDel,
          on_time_deliveries: totalOnTime,
          revision_count: totalRev,
        },
        { onConflict: "org_id,year_month,client_id" }
      );

      queryClient.invalidateQueries({ queryKey: ["quality_monthly"] });
      queryClient.invalidateQueries({ queryKey: ["project_pl"] });
      toast.success("品質データを保存しました");
      setRecords([]);
      setAggregated([]);
      setPreviewed(false);
      setFileName("");
      setOpen(false);
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }, [aggregated, selectedYm, clientMap, queryClient]);

  const totalDeliveries = records.length;
  const totalOnTime = records.filter((r) => r.onTime).length;
  const totalRevisions = records.filter((r) => r.hasRevision).length;
  const onTimeRate = totalDeliveries > 0 ? (totalOnTime / totalDeliveries) * 100 : 0;
  const revisionRate = totalDeliveries > 0 ? (totalRevisions / totalDeliveries) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRecords([]); setAggregated([]); setPreviewed(false); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
          <Upload className="h-3.5 w-3.5" /> 品質CSVアップロード
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> 品質CSVアップロード
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> CSVファイルを選択
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              品質管理CSVファイルを選択してください
            </p>
            {fileName && (
              <p className="text-xs text-foreground mt-1 font-medium">{fileName}</p>
            )}
          </div>

          {/* Year-month selector */}
          {records.length > 0 && (
            <div className="flex items-center gap-3">
              <Label className="text-xs whitespace-nowrap">対象年月</Label>
              <Select value={selectedYm} onValueChange={setSelectedYm}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handlePreview} className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> プレビュー
              </Button>
            </div>
          )}

          {/* Preview */}
          {previewed && aggregated.length > 0 && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">対象月</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{getMonthLabel(selectedYm)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">総案件数</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{totalDeliveries}件</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">納期遵守率</p>
                  <p className={cn("text-sm font-bold font-mono tabular-nums", onTimeRate < 95 && "text-destructive")}>
                    {onTimeRate.toFixed(1)}%（{totalOnTime}/{totalDeliveries}）
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">修正発生率</p>
                  <p className={cn("text-sm font-bold font-mono tabular-nums", revisionRate > 20 && "text-destructive")}>
                    {revisionRate.toFixed(1)}%（{totalRevisions}/{totalDeliveries}）
                  </p>
                </div>
              </div>

              {/* Client aggregation table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">顧客名</TableHead>
                      <TableHead className="text-xs text-right">案件数</TableHead>
                      <TableHead className="text-xs text-right">納期遵守</TableHead>
                      <TableHead className="text-xs text-right">遵守率</TableHead>
                      <TableHead className="text-xs text-right">修正発生</TableHead>
                      <TableHead className="text-xs text-right">発生率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregated.map((row) => {
                      const otRate = row.total_deliveries > 0
                        ? (row.on_time_deliveries / row.total_deliveries) * 100 : 0;
                      const revRate = row.total_deliveries > 0
                        ? (row.revision_count / row.total_deliveries) * 100 : 0;
                      return (
                        <TableRow key={row.client_name}>
                          <TableCell className="text-xs font-medium">{row.client_name}</TableCell>
                          <TableCell className="text-xs text-right font-mono tabular-nums">{row.total_deliveries}件</TableCell>
                          <TableCell className="text-xs text-right font-mono tabular-nums">{row.on_time_deliveries}件</TableCell>
                          <TableCell className={cn(
                            "text-xs text-right font-mono tabular-nums",
                            otRate < 95 && "text-destructive font-semibold"
                          )}>
                            {otRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono tabular-nums">{row.revision_count}件</TableCell>
                          <TableCell className={cn(
                            "text-xs text-right font-mono tabular-nums",
                            revRate > 20 && "text-destructive font-semibold"
                          )}>
                            {revRate.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Total row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="text-xs font-bold">合計</TableCell>
                      <TableCell className="text-xs text-right font-mono tabular-nums font-bold">{totalDeliveries}件</TableCell>
                      <TableCell className="text-xs text-right font-mono tabular-nums font-bold">{totalOnTime}件</TableCell>
                      <TableCell className="text-xs text-right font-mono tabular-nums font-bold">{onTimeRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-xs text-right font-mono tabular-nums font-bold">{totalRevisions}件</TableCell>
                      <TableCell className="text-xs text-right font-mono tabular-nums font-bold">{revisionRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" />
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
