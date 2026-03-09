import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID, getFiscalYearMonths, getMonthLabel } from "@/lib/fiscalYear";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Upload, Shield, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FISCAL_MONTHS = getFiscalYearMonths(2026);

type TabType = "onTimeRate" | "revisionRate" | "deliveries";

interface ClientQualityRow {
  clientId: string;
  clientName: string;
  monthly: Record<string, { totalDeliveries: number; onTime: number; revisions: number }>;
  totals: { totalDeliveries: number; onTime: number; revisions: number };
  avgOnTimeRate: number;
  avgRevisionRate: number;
}

// No summary cards in the new layout

// ── Input Modal ──
function QualityInputModal({
  clientNames,
  onSave,
}: {
  clientNames: { id: string; name: string }[];
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ym, setYm] = useState(FISCAL_MONTHS[FISCAL_MONTHS.length - 1]);
  const [clientId, setClientId] = useState("");
  const [totalDel, setTotalDel] = useState(0);
  const [onTime, setOnTime] = useState(0);
  const [revisions, setRevisions] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!clientId) {
      toast.error("顧客名を選択してください");
      return;
    }
    setSaving(true);
    try {
      const clientName = clientNames.find((c) => c.id === clientId)?.name ?? clientId;
      const { error } = await supabase.from("quality_monthly").upsert(
        {
          org_id: ORG_ID,
          year_month: ym,
          client_id: clientId,
          client_name: clientName,
          total_deliveries: totalDel,
          on_time_deliveries: onTime,
          revision_count: revisions,
        },
        { onConflict: "org_id,year_month,client_id" }
      );
      if (error) throw error;
      toast.success("保存しました");
      onSave();
      setOpen(false);
      setTotalDel(0);
      setOnTime(0);
      setRevisions(0);
      setClientId("");
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    let count = 0;
    for (const line of lines) {
      const [csvYm, csvClientName, csvTotal, csvOnTime, csvRevision] = line.split(",").map((s) => s.trim());
      if (!csvYm || !csvClientName) continue;
      const matched = clientNames.find((c) => c.name === csvClientName);
      const cid = matched?.id ?? csvClientName;
      await supabase.from("quality_monthly").upsert(
        {
          org_id: ORG_ID,
          year_month: csvYm,
          client_id: cid,
          client_name: csvClientName,
          total_deliveries: Number(csvTotal) || 0,
          on_time_deliveries: Number(csvOnTime) || 0,
          revision_count: Number(csvRevision) || 0,
        },
        { onConflict: "org_id,year_month,client_id" }
      );
      count++;
    }
    toast.success(`${count}件のデータをアップロードしました`);
    onSave();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs gap-1 h-8">
            <Plus className="h-3 w-3" /> データ入力
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>品質データ入力</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">年月</Label>
              <Select value={ym} onValueChange={setYm}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FISCAL_MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">顧客名</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {clientNames.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">納品数</Label>
                <Input type="number" min={0} value={totalDel} onChange={(e) => setTotalDel(Number(e.target.value))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">納期遵守数</Label>
                <Input type="number" min={0} value={onTime} onChange={(e) => setOnTime(Number(e.target.value))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">修正発生数</Label>
                <Input type="number" min={0} value={revisions} onChange={(e) => setRevisions(Number(e.target.value))} className="h-9" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" className="text-xs gap-1 h-8" onClick={() => fileInputRef.current?.click()}>
        <Upload className="h-3 w-3" /> CSV
      </Button>
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
    </div>
  );
}

// ── Main Component ──
export function ClientQualityTable() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("onTimeRate");

  // Fetch quality_monthly for all fiscal months
  const qualityQuery = useQuery({
    queryKey: ["quality_monthly", "client_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_monthly")
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", FISCAL_MONTHS);
      if (error) throw error;
      return data;
    },
  });

  // Fetch project_pl client names for the dropdown
  const clientNamesQuery = useQuery({
    queryKey: ["project_pl", "client_names_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("client_id, client_name")
        .eq("org_id", ORG_ID)
        .in("year_month", FISCAL_MONTHS)
        .gt("revenue", 0);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of data) {
        const cid = String(r.client_id ?? "");
        if (cid && !map.has(cid)) map.set(cid, r.client_name ?? cid);
      }
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  const clientNames = clientNamesQuery.data ?? [];

  // Build rows from quality_monthly (exclude __total__ rows)
  const rows: ClientQualityRow[] = useMemo(() => {
    if (!qualityQuery.data) return [];
    const clientMap = new Map<string, ClientQualityRow>();

    for (const row of qualityQuery.data) {
      if (row.client_id === "__total__") continue;
      const cid = row.client_id ?? "未分類";
      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          clientId: cid,
          clientName: row.client_name ?? "未分類",
          monthly: {},
          totals: { totalDeliveries: 0, onTime: 0, revisions: 0 },
          avgOnTimeRate: 0,
          avgRevisionRate: 0,
        });
      }
      const entry = clientMap.get(cid)!;
      entry.monthly[row.year_month] = {
        totalDeliveries: row.total_deliveries ?? 0,
        onTime: row.on_time_deliveries ?? 0,
        revisions: row.revision_count ?? 0,
      };
    }

    return Array.from(clientMap.values()).map((r) => {
      let totalDel = 0, totalOnTime = 0, totalRev = 0;
      for (const ym of FISCAL_MONTHS) {
        const m = r.monthly[ym];
        if (m) {
          totalDel += m.totalDeliveries;
          totalOnTime += m.onTime;
          totalRev += m.revisions;
        }
      }
      r.totals = { totalDeliveries: totalDel, onTime: totalOnTime, revisions: totalRev };
      r.avgOnTimeRate = totalDel > 0 ? (totalOnTime / totalDel) * 100 : 0;
      r.avgRevisionRate = totalDel > 0 ? (totalRev / totalDel) * 100 : 0;
      return r;
    });
  }, [qualityQuery.data]);

  // Sort based on active tab
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    if (activeTab === "onTimeRate") sorted.sort((a, b) => b.avgOnTimeRate - a.avgOnTimeRate);
    else if (activeTab === "revisionRate") sorted.sort((a, b) => a.avgRevisionRate - b.avgRevisionRate);
    else sorted.sort((a, b) => b.totals.totalDeliveries - a.totals.totalDeliveries);
    return sorted;
  }, [rows, activeTab]);

  // Totals
  const grandTotals = useMemo(() => {
    const monthly: Record<string, { totalDeliveries: number; onTime: number; revisions: number }> = {};
    for (const ym of FISCAL_MONTHS) {
      let del = 0, ot = 0, rev = 0;
      for (const r of rows) {
        const m = r.monthly[ym];
        if (m) { del += m.totalDeliveries; ot += m.onTime; rev += m.revisions; }
      }
      monthly[ym] = { totalDeliveries: del, onTime: ot, revisions: rev };
    }
    const totalDel = rows.reduce((s, r) => s + r.totals.totalDeliveries, 0);
    const totalOnTime = rows.reduce((s, r) => s + r.totals.onTime, 0);
    const totalRev = rows.reduce((s, r) => s + r.totals.revisions, 0);
    return { monthly, totalDel, totalOnTime, totalRev };
  }, [rows]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["quality_monthly"] });
  }, [queryClient]);

  const isLoading = qualityQuery.isLoading || clientNamesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  // Badges
  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold mr-1.5">1</span>;
    if (index === 1) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold mr-1.5">2</span>;
    if (index === 2) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold mr-1.5">3</span>;
    if (index <= 4) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold mr-1.5">{index + 1}</span>;
    return null;
  };

  const getWorstBadge = (row: ClientQualityRow) => {
    if (row.totals.totalDeliveries === 0) return null;
    // For onTimeRate tab: worst = lowest on-time rate
    // For revisionRate tab: worst = highest revision rate
    const clientsWithData = rows.filter((r) => r.totals.totalDeliveries > 0);
    if (activeTab === "onTimeRate") {
      const sorted = [...clientsWithData].sort((a, b) => a.avgOnTimeRate - b.avgOnTimeRate);
      const worstIdx = sorted.findIndex((r) => r.clientId === row.clientId);
      if (worstIdx < 3) return <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded ml-1">要改善</span>;
    } else if (activeTab === "revisionRate") {
      const sorted = [...clientsWithData].sort((a, b) => b.avgRevisionRate - a.avgRevisionRate);
      const worstIdx = sorted.findIndex((r) => r.clientId === row.clientId);
      if (worstIdx < 3) return <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded ml-1">要改善</span>;
    }
    return null;
  };

  const onTimeColor = (onTime: number, total: number) => {
    if (total <= 0) return "";
    return (onTime / total) * 100 < 95 ? "text-destructive bg-destructive/5" : "";
  };

  const revisionColor = (rev: number, total: number) => {
    if (total <= 0) return "";
    return (rev / total) * 100 > 20 ? "text-destructive bg-destructive/5" : "";
  };

  const formatRate = (num: number, den: number) => {
    if (den <= 0) return "—";
    return `${((num / den) * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold">顧客別品質管理</h3>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            <TabsList className="h-8">
              <TabsTrigger value="onTimeRate" className="text-xs px-3 h-7">納期遵守率</TabsTrigger>
              <TabsTrigger value="revisionRate" className="text-xs px-3 h-7">修正発生率</TabsTrigger>
              <TabsTrigger value="deliveries" className="text-xs px-3 h-7">案件数</TabsTrigger>
            </TabsList>
          </Tabs>
          <QualityInputModal clientNames={clientNames} onSave={refetch} />
        </div>
      </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">顧客名</TableHead>
              {FISCAL_MONTHS.map((ym) => (
                <TableHead key={ym} className="text-right whitespace-nowrap min-w-[80px]">{getMonthLabel(ym)}</TableHead>
              ))}
              <TableHead className="text-right font-bold whitespace-nowrap min-w-[100px]">通期平均</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, idx) => (
              <TableRow key={row.clientId}>
                <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                  <div className="flex items-center">
                    {getRankBadge(idx)}
                    <span className="text-xs font-medium truncate max-w-[100px]">{row.clientName}</span>
                    {getWorstBadge(row)}
                  </div>
                </TableCell>
                {FISCAL_MONTHS.map((ym) => {
                  const m = row.monthly[ym];
                  const del = m?.totalDeliveries ?? 0;
                  const ot = m?.onTime ?? 0;
                  const rev = m?.revisions ?? 0;

                  if (activeTab === "onTimeRate") {
                    return (
                      <TableCell key={ym} className={cn("text-right font-mono tabular-nums text-xs whitespace-nowrap", onTimeColor(ot, del))}>
                        {formatRate(ot, del)}
                      </TableCell>
                    );
                  }
                  if (activeTab === "revisionRate") {
                    return (
                      <TableCell key={ym} className={cn("text-right font-mono tabular-nums text-xs whitespace-nowrap", revisionColor(rev, del))}>
                        {formatRate(rev, del)}
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={ym} className="text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      {del > 0 ? `${del}件` : "—"}
                    </TableCell>
                  );
                })}
                {/* Total/Average column */}
                <TableCell className={cn(
                  "text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap",
                  activeTab === "onTimeRate" && onTimeColor(row.totals.onTime, row.totals.totalDeliveries),
                  activeTab === "revisionRate" && revisionColor(row.totals.revisions, row.totals.totalDeliveries),
                )}>
                  {activeTab === "onTimeRate" ? formatRate(row.totals.onTime, row.totals.totalDeliveries)
                    : activeTab === "revisionRate" ? formatRate(row.totals.revisions, row.totals.totalDeliveries)
                    : row.totals.totalDeliveries > 0 ? `${row.totals.totalDeliveries}件` : "—"}
                </TableCell>
              </TableRow>
            ))}

            {/* Grand totals row */}
            <TableRow className="border-t-2 border-border font-semibold">
              <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] font-semibold">全体</TableCell>
              {FISCAL_MONTHS.map((ym) => {
                const m = grandTotals.monthly[ym];
                const del = m?.totalDeliveries ?? 0;
                const ot = m?.onTime ?? 0;
                const rev = m?.revisions ?? 0;
                return (
                  <TableCell key={ym} className={cn(
                    "text-right font-mono tabular-nums text-xs whitespace-nowrap",
                    activeTab === "onTimeRate" && onTimeColor(ot, del),
                    activeTab === "revisionRate" && revisionColor(rev, del),
                  )}>
                    {activeTab === "onTimeRate" ? formatRate(ot, del)
                      : activeTab === "revisionRate" ? formatRate(rev, del)
                      : del > 0 ? `${del}件` : "—"}
                  </TableCell>
                );
              })}
              <TableCell className={cn(
                "text-right font-mono tabular-nums text-xs font-bold whitespace-nowrap",
                activeTab === "onTimeRate" && onTimeColor(grandTotals.totalOnTime, grandTotals.totalDel),
                activeTab === "revisionRate" && revisionColor(grandTotals.totalRev, grandTotals.totalDel),
              )}>
                {activeTab === "onTimeRate" ? formatRate(grandTotals.totalOnTime, grandTotals.totalDel)
                  : activeTab === "revisionRate" ? formatRate(grandTotals.totalRev, grandTotals.totalDel)
                  : grandTotals.totalDel > 0 ? `${grandTotals.totalDel}件` : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
    </div>
  );
}
