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
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Normalize client name by removing legal entity suffixes/prefixes for matching
function normalizeClientName(name: string): string {
  return name
    .replace(/^株式会社/g, "")
    .replace(/株式会社$/g, "")
    .replace(/^有限会社/g, "")
    .replace(/有限会社$/g, "")
    .replace(/^合同会社/g, "")
    .replace(/合同会社$/g, "")
    .replace(/^一般社団法人/g, "")
    .replace(/^（株）/g, "")
    .replace(/^[\(（]株[\)）]/g, "")
    .trim();
}

// Create a case-insensitive key for matching
function matchKey(name: string): string {
  return normalizeClientName(name).toLowerCase().replace(/\s+/g, "");
}

// Check if a quality_monthly row looks like junk data (not a real client name)
function isJunkClientEntry(clientId: string | null, clientName: string | null): boolean {
  const name = clientName ?? clientId ?? "";
  if (!name || name === "__total__") return true;
  // Pure numbers, percentages, very short
  if (/^\d+(\.\d+)?%?$/.test(name.trim())) return true;
  // Project-like entries (start with 【 or contain detailed project descriptions)
  if (name.startsWith("【") || name.startsWith("「")) return true;
  // Entries containing long descriptions with underscores
  if (name.includes("_") && name.length > 30) return true;
  return false;
}

const FISCAL_MONTHS = getFiscalYearMonths(2026);

type TabType = "onTimeRate" | "revisionRate" | "deliveries";
type SortDirection = "desc" | "asc";

interface MonthlyQuality {
  totalDeliveries: number;
  onTime: number;
  revisions: number;
}

interface ClientQualityRow {
  clientId: string;
  clientName: string;
  hasQualityData: boolean;
  monthly: Record<string, MonthlyQuality>;
  totals: { totalDeliveries: number; onTime: number; revisions: number };
  avgOnTimeRate: number;
  avgRevisionRate: number;
}

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

  return (
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
  );
}

// ── Main Component ──
export function ClientQualityTable() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("deliveries"); // Default to deliveries (案件数)
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc"); // Default high to low

  // Fetch ALL quality_monthly data for the org
  const qualityQuery = useQuery({
    queryKey: ["quality_monthly", "client_quality_table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_monthly")
        .select("*")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      console.log("[ClientQualityTable] quality_monthly fetched:", data?.length, "rows");
      return data;
    },
  });

  // Fetch clients from the clients table (Board master) to get display names
  const clientsMasterQuery = useQuery({
    queryKey: ["clients", "master_for_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, name_disp")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all unique clients from project_pl for the fiscal year
  const clientsQuery = useQuery({
    queryKey: ["project_pl", "client_list_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("client_id, client_name")
        .eq("org_id", ORG_ID)
        .gte("year_month", "2025-05")
        .lte("year_month", "2026-04");
      if (error) throw error;
      // Deduplicate by client_id
      const map = new Map<string, string>();
      for (const r of data) {
        const cid = String(r.client_id ?? "");
        if (cid && r.client_name && !map.has(cid)) {
          map.set(cid, r.client_name);
        }
      }
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  const clientsMaster = clientsMasterQuery.data ?? [];
  const allClients = clientsQuery.data ?? [];
  const qualityData = qualityQuery.data ?? [];

  // Build a map: client_id -> display name (name_disp from Board master)
  const clientDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsMaster) {
      const displayName = c.name_disp || c.name || "";
      if (displayName) {
        map.set(String(c.id), displayName);
      }
    }
    return map;
  }, [clientsMaster]);

  // Build reverse map: matchKey(name) -> canonical Board name
  // This handles case differences, spacing, and 株式会社 prefix/suffix variants
  const nameToDisplayName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsMaster) {
      const displayName = c.name_disp || c.name || "";
      if (!displayName) continue;
      const key = matchKey(displayName);
      // First entry wins (canonical Board name)
      if (!map.has(key)) {
        map.set(key, displayName);
      }
    }
    return map;
  }, [clientsMaster]);

  // Helper to resolve any name to its Board canonical name
  const resolveDisplayName = useCallback((rawName: string): string => {
    const key = matchKey(rawName);
    return nameToDisplayName.get(key) ?? normalizeClientName(rawName);
  }, [nameToDisplayName]);


  // Build quality lookup: Map<canonicalDisplayName, Map<yearMonth, MonthlyQuality>>
  const qualityLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, MonthlyQuality>>();
    for (const row of qualityData) {
      // Filter out junk entries and __total__ rows
      if (isJunkClientEntry(row.client_id, row.client_name)) continue;
      
      const rawName = row.client_name ?? row.client_id ?? "";
      if (!rawName) continue;
      
      // Resolve to canonical Board display name
      const displayName = resolveDisplayName(rawName);
      if (!displayName) continue;
      
      if (!lookup.has(displayName)) lookup.set(displayName, new Map());
      const monthMap = lookup.get(displayName)!;
      const existing = monthMap.get(row.year_month);
      
      if (existing) {
        monthMap.set(row.year_month, {
          totalDeliveries: existing.totalDeliveries + (row.total_deliveries ?? 0),
          onTime: existing.onTime + (row.on_time_deliveries ?? 0),
          revisions: existing.revisions + (row.revision_count ?? 0),
        });
      } else {
        monthMap.set(row.year_month, {
          totalDeliveries: row.total_deliveries ?? 0,
          onTime: row.on_time_deliveries ?? 0,
          revisions: row.revision_count ?? 0,
        });
      }
    }
    return lookup;
  }, [qualityData, resolveDisplayName]);

  // Build rows: group by Board display name
  const rows: ClientQualityRow[] = useMemo(() => {
    const result: ClientQualityRow[] = [];
    const processedDisplayNames = new Set<string>();

    // 1. Group project_pl clients by canonical Board display name
    // Use matchKey to group clients with same normalized name (e.g. "CLEAR INNOVATION株式会社" vs "CLEAR INNOVATION 株式会社")
    const clientsByMatchKey = new Map<string, { id: string; name: string; displayName: string }[]>();
    const matchKeyToDisplayName = new Map<string, string>();
    for (const client of allClients) {
      const displayName = clientDisplayNameMap.get(client.id) ?? resolveDisplayName(client.name);
      const key = matchKey(displayName);
      
      if (!clientsByMatchKey.has(key)) {
        clientsByMatchKey.set(key, []);
        matchKeyToDisplayName.set(key, displayName);
      }
      clientsByMatchKey.get(key)!.push({ ...client, displayName });
    }

    // 2. Process each display name group
    for (const [key, clients] of clientsByMatchKey.entries()) {
      const displayName = matchKeyToDisplayName.get(key) ?? clients[0].displayName;
      processedDisplayNames.add(displayName);
      // Also add the matchKey so quality-only lookup works
      const qualityByKey = qualityLookup.get(displayName) ?? new Map<string, MonthlyQuality>();
      // Also try matchKey-based lookup from qualityLookup
      let monthlyData = qualityByKey;
      if (monthlyData.size === 0) {
        // Try to find by matchKey across all qualityLookup entries
        for (const [qName, qMap] of qualityLookup.entries()) {
          if (matchKey(qName) === key) {
            monthlyData = qMap;
            processedDisplayNames.add(qName);
            break;
          }
        }
      }

      let totalDel = 0, totalOnTime = 0, totalRev = 0;
      const monthly: Record<string, MonthlyQuality> = {};
      for (const ym of FISCAL_MONTHS) {
        const m = monthlyData.get(ym);
        if (m) {
          monthly[ym] = m;
          totalDel += m.totalDeliveries;
          totalOnTime += m.onTime;
          totalRev += m.revisions;
        }
      }

      result.push({
        clientId: clients[0].id,
        clientName: displayName,
        hasQualityData: totalDel > 0,
        monthly,
        totals: { totalDeliveries: totalDel, onTime: totalOnTime, revisions: totalRev },
        avgOnTimeRate: totalDel > 0 ? (totalOnTime / totalDel) * 100 : -1,
        avgRevisionRate: totalDel > 0 ? (totalRev / totalDel) * 100 : -1,
      });
    }

    // 3. Quality-only clients not in project_pl
    const processedMatchKeys = new Set([...processedDisplayNames].map(n => matchKey(n)));
    for (const [displayName, monthlyMap] of qualityLookup.entries()) {
      const key = matchKey(displayName);
      if (processedMatchKeys.has(key)) continue;
      processedMatchKeys.add(key);

      let totalDel = 0, totalOnTime = 0, totalRev = 0;
      const monthly: Record<string, MonthlyQuality> = {};
      for (const ym of FISCAL_MONTHS) {
        const m = monthlyMap.get(ym);
        if (m) {
          monthly[ym] = m;
          totalDel += m.totalDeliveries;
          totalOnTime += m.onTime;
          totalRev += m.revisions;
        }
      }
      if (totalDel === 0) continue;

      result.push({
        clientId: displayName,
        clientName: displayName,
        hasQualityData: true,
        monthly,
        totals: { totalDeliveries: totalDel, onTime: totalOnTime, revisions: totalRev },
        avgOnTimeRate: totalDel > 0 ? (totalOnTime / totalDel) * 100 : -1,
        avgRevisionRate: totalDel > 0 ? (totalRev / totalDel) * 100 : -1,
      });
    }

    return result;
  }, [allClients, qualityLookup, clientDisplayNameMap, resolveDisplayName]);

  // Sort based on active tab and sort direction; clients without data go to bottom
  const sortedRows = useMemo(() => {
    const withData = rows.filter((r) => r.hasQualityData);
    const withoutData = rows.filter((r) => !r.hasQualityData);

    const multiplier = sortDirection === "desc" ? 1 : -1;

    if (activeTab === "onTimeRate") {
      withData.sort((a, b) => multiplier * (b.avgOnTimeRate - a.avgOnTimeRate));
    } else if (activeTab === "revisionRate") {
      // For revision rate, lower is better, so flip the default
      withData.sort((a, b) => multiplier * (a.avgRevisionRate - b.avgRevisionRate));
    } else {
      withData.sort((a, b) => multiplier * (b.totals.totalDeliveries - a.totals.totalDeliveries));
    }

    withoutData.sort((a, b) => a.clientName.localeCompare(b.clientName));
    return [...withData, ...withoutData];
  }, [rows, activeTab, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  // Grand totals (only from rows with data)
  const grandTotals = useMemo(() => {
    const monthly: Record<string, MonthlyQuality> = {};
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

  const isLoading = qualityQuery.isLoading || clientsQuery.isLoading || clientsMasterQuery.isLoading;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

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
              <TabsTrigger value="deliveries" className="text-xs px-3 h-7">案件数</TabsTrigger>
              <TabsTrigger value="onTimeRate" className="text-xs px-3 h-7">納期遵守率</TabsTrigger>
              <TabsTrigger value="revisionRate" className="text-xs px-3 h-7">修正発生率</TabsTrigger>
            </TabsList>
          </Tabs>
          <QualityInputModal clientNames={allClients} onSave={refetch} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">顧客名</TableHead>
            {FISCAL_MONTHS.map((ym) => (
              <TableHead key={ym} className="text-right whitespace-nowrap min-w-[80px]">{getMonthLabel(ym)}</TableHead>
            ))}
            {/* 3 summary columns always visible */}
            <TableHead className="text-right font-bold whitespace-nowrap min-w-[80px]">
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab("deliveries"); toggleSortDirection(); }} className="h-auto p-1 text-xs font-bold hover:bg-muted/50">
                案件数
                {activeTab === "deliveries" && (sortDirection === "desc" ? <ArrowDown className="ml-0.5 h-3 w-3" /> : <ArrowUp className="ml-0.5 h-3 w-3" />)}
              </Button>
            </TableHead>
            <TableHead className="text-right font-bold whitespace-nowrap min-w-[80px]">
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab("onTimeRate"); toggleSortDirection(); }} className="h-auto p-1 text-xs font-bold hover:bg-muted/50">
                納期遵守率
                {activeTab === "onTimeRate" && (sortDirection === "desc" ? <ArrowDown className="ml-0.5 h-3 w-3" /> : <ArrowUp className="ml-0.5 h-3 w-3" />)}
              </Button>
            </TableHead>
            <TableHead className="text-right font-bold whitespace-nowrap min-w-[80px]">
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab("revisionRate"); toggleSortDirection(); }} className="h-auto p-1 text-xs font-bold hover:bg-muted/50">
                修正発生率
                {activeTab === "revisionRate" && (sortDirection === "desc" ? <ArrowDown className="ml-0.5 h-3 w-3" /> : <ArrowUp className="ml-0.5 h-3 w-3" />)}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.clientId}>
              <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                <span className="text-xs font-medium truncate max-w-[140px] inline-block">{row.clientName}</span>
              </TableCell>
              {FISCAL_MONTHS.map((ym) => {
                const m = row.monthly[ym];
                if (!m) {
                  return <TableCell key={ym} className="text-right text-xs text-muted-foreground">—</TableCell>;
                }
                const del = m.totalDeliveries;
                const ot = m.onTime;
                const rev = m.revisions;

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
              {/* Always show all 3 summary columns */}
              <TableCell className="text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap">
                {row.hasQualityData ? `${row.totals.totalDeliveries}件` : "—"}
              </TableCell>
              <TableCell className={cn(
                "text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap",
                row.totals.totalDeliveries > 0 && onTimeColor(row.totals.onTime, row.totals.totalDeliveries),
              )}>
                {row.hasQualityData ? formatRate(row.totals.onTime, row.totals.totalDeliveries) : "—"}
              </TableCell>
              <TableCell className={cn(
                "text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap",
                row.totals.totalDeliveries > 0 && revisionColor(row.totals.revisions, row.totals.totalDeliveries),
              )}>
                {row.hasQualityData ? formatRate(row.totals.revisions, row.totals.totalDeliveries) : "—"}
              </TableCell>
            </TableRow>
          ))}

          {/* Grand totals row */}
          <TableRow className="border-t-2 border-border font-semibold">
            <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] font-semibold text-xs">全体</TableCell>
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
            <TableCell className="text-right font-mono tabular-nums text-xs font-bold whitespace-nowrap">
              {grandTotals.totalDel > 0 ? `${grandTotals.totalDel}件` : "—"}
            </TableCell>
            <TableCell className={cn(
              "text-right font-mono tabular-nums text-xs font-bold whitespace-nowrap",
              onTimeColor(grandTotals.totalOnTime, grandTotals.totalDel),
            )}>
              {formatRate(grandTotals.totalOnTime, grandTotals.totalDel)}
            </TableCell>
            <TableCell className={cn(
              "text-right font-mono tabular-nums text-xs font-bold whitespace-nowrap",
              revisionColor(grandTotals.totalRev, grandTotals.totalDel),
            )}>
              {formatRate(grandTotals.totalRev, grandTotals.totalDel)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
