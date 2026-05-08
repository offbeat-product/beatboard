import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID, getFiscalYearMonths, getCurrentMonth, getFiscalEndYear } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, RotateCcw, Trophy, Award, Medal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtMonthShort = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}/${Number(m)}月`;
};

type TabType = "gph" | "grossProfit" | "hours";

interface ClientRow {
  clientId: string;
  clientName: string;
  monthlyGrossProfit: Record<string, number>;
  monthlyHours: Record<string, number>;
  totalGrossProfit: number;
  totalHours: number;
  avgGph: number;
}

export function ClientGphTable({ months }: { months?: string[] } = {}) {
  const DISPLAY_MONTHS = months && months.length > 0 ? months : getFiscalYearMonths(getFiscalEndYear(getCurrentMonth()));
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrencyUnit();
  const [activeTab, setActiveTab] = useState<TabType>("gph");
  const [hoursEdits, setHoursEdits] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">("default");
  const [sortColumn, setSortColumn] = useState<string>("avg"); // "avg" or a year_month like "2026-03"

  // Fetch project_pl for Nov-Apr
  const projectPlQuery = useQuery({
    queryKey: ["project_pl", "client_gph"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("year_month, client_id, client_name, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", DISPLAY_MONTHS);
      if (error) throw error;
      return data;
    },
  });

  // Fetch client_monthly_hours
  const hoursQuery = useQuery({
    queryKey: ["client_monthly_hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_monthly_hours" as any)
        .select("*")
        .eq("org_id", ORG_ID)
        .in("year_month", DISPLAY_MONTHS);
      if (error) throw error;
      return data as any[];
    },
  });

  // Build client list from project_pl (revenue > 0 clients)
  const clients = useMemo(() => {
    if (!projectPlQuery.data) return [];
    const clientMap = new Map<string, { name: string; monthlyGP: Record<string, number> }>();
    for (const row of projectPlQuery.data) {
      const cid = String(row.client_id ?? "");
      if (!cid) continue;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, { name: row.client_name ?? cid, monthlyGP: {} });
      }
      const entry = clientMap.get(cid)!;
      entry.monthlyGP[row.year_month] = (entry.monthlyGP[row.year_month] ?? 0) + Number(row.gross_profit ?? 0);
    }
    // Filter to those with any positive GP
    return Array.from(clientMap.entries())
      .filter(([, v]) => Object.values(v.monthlyGP).some((gp) => gp > 0))
      .map(([id, v]) => ({ id, name: v.name, monthlyGP: v.monthlyGP }));
  }, [projectPlQuery.data]);

  // Build saved hours map
  const savedHoursMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    if (!hoursQuery.data) return map;
    for (const row of hoursQuery.data) {
      const cid = String(row.client_id);
      if (!map[cid]) map[cid] = {};
      map[cid][row.year_month] = Number(row.hours ?? 0);
    }
    return map;
  }, [hoursQuery.data]);

  // Initialize edits from saved data
  useEffect(() => {
    if (hoursQuery.data && !initialized) {
      setHoursEdits({ ...savedHoursMap });
      setInitialized(true);
    }
  }, [hoursQuery.data, initialized, savedHoursMap]);

  // Build rows
  const rows: ClientRow[] = useMemo(() => {
    return clients.map((c) => {
      const monthlyGrossProfit = c.monthlyGP;
      const monthlyHours: Record<string, number> = {};
      for (const ym of DISPLAY_MONTHS) {
        monthlyHours[ym] = hoursEdits[c.id]?.[ym] ?? savedHoursMap[c.id]?.[ym] ?? 0;
      }
      const totalGrossProfit = DISPLAY_MONTHS.reduce((s, ym) => s + (monthlyGrossProfit[ym] ?? 0), 0);
      const totalHours = DISPLAY_MONTHS.reduce((s, ym) => s + (monthlyHours[ym] ?? 0), 0);
      const avgGph = totalHours > 0 ? totalGrossProfit / totalHours : 0;
      return { clientId: c.id, clientName: c.name, monthlyGrossProfit, monthlyHours, totalGrossProfit, totalHours, avgGph };
    }).filter((row) => {
      const hasAnyGph = DISPLAY_MONTHS.some((ym) => (row.monthlyHours[ym] ?? 0) > 0);
      return hasAnyGph;
    }).sort((a, b) => {
      if (sortOrder === "default") return b.avgGph - a.avgGph;
      const getVal = (r: ClientRow) => {
        if (sortColumn === "avg") return r.avgGph;
        const gp = r.monthlyGrossProfit[sortColumn] ?? 0;
        const h = r.monthlyHours[sortColumn] ?? 0;
        return h > 0 ? gp / h : 0;
      };
      const diff = getVal(a) - getVal(b);
      return sortOrder === "desc" ? -diff : diff;
    });
  }, [clients, hoursEdits, savedHoursMap, sortOrder, sortColumn]);

  // Totals
  const totals = useMemo(() => {
    const monthlyGP: Record<string, number> = {};
    const monthlyH: Record<string, number> = {};
    for (const ym of DISPLAY_MONTHS) {
      monthlyGP[ym] = rows.reduce((s, r) => s + (r.monthlyGrossProfit[ym] ?? 0), 0);
      monthlyH[ym] = rows.reduce((s, r) => s + (r.monthlyHours[ym] ?? 0), 0);
    }
    const totalGP = rows.reduce((s, r) => s + r.totalGrossProfit, 0);
    const totalH = rows.reduce((s, r) => s + r.totalHours, 0);
    return { monthlyGP, monthlyH, totalGP, totalH, avgGph: totalH > 0 ? totalGP / totalH : 0 };
  }, [rows]);

  const updateHours = useCallback((clientId: string, ym: string, value: number) => {
    setHoursEdits((prev) => ({
      ...prev,
      [clientId]: { ...prev[clientId], [ym]: value },
    }));
  }, []);

  const resetHours = useCallback(() => {
    setHoursEdits({ ...savedHoursMap });
    toast.success("変更をリセットしました");
  }, [savedHoursMap]);

  const saveHours = useCallback(async () => {
    setSaving(true);
    try {
      for (const [clientId, months] of Object.entries(hoursEdits)) {
        const clientName = clients.find((c) => c.id === clientId)?.name ?? clientId;
        for (const [ym, hours] of Object.entries(months)) {
          await (supabase.from("client_monthly_hours" as any) as any).upsert({
            org_id: ORG_ID,
            year_month: ym,
            client_id: clientId,
            client_name: clientName,
            hours,
          }, { onConflict: "org_id,year_month,client_id" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["client_monthly_hours"] });
      toast.success("工数データを保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [hoursEdits, clients, queryClient]);

  const isLoading = projectPlQuery.isLoading || hoursQuery.isLoading;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold mr-1.5">1</span>;
    if (index === 1) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold mr-1.5">2</span>;
    if (index === 2) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold mr-1.5">3</span>;
    if (index <= 4) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold mr-1.5">{index + 1}</span>;
    return null;
  };

  const gphCell = (gp: number, hours: number) => {
    if (hours <= 0) return "—";
    const gph = gp / hours;
    return `¥${Math.round(gph).toLocaleString()}`;
  };

  const gphColor = (gp: number, hours: number) => {
    if (hours <= 0) return "";
    return gp / hours < 25000 ? "text-destructive bg-destructive/5" : "";
  };

  return (
    <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold">顧客別案件工数単価</h3>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            <TabsList className="h-8">
              <TabsTrigger value="gph" className="text-xs px-3 h-7">粗利工数単価</TabsTrigger>
              <TabsTrigger value="grossProfit" className="text-xs px-3 h-7">粗利</TabsTrigger>
              <TabsTrigger value="hours" className="text-xs px-3 h-7">工数</TabsTrigger>
            </TabsList>
          </Tabs>
          {activeTab === "gph" && sortOrder !== "default" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSortOrder("default"); setSortColumn("avg"); }}
              className="text-xs gap-1 h-8 border-primary text-primary"
            >
              <RotateCcw className="h-3 w-3" /> ソート解除
            </Button>
          )}
          {activeTab === "hours" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetHours} className="text-xs gap-1 h-8">
                <RotateCcw className="h-3 w-3" /> リセット
              </Button>
              <Button size="sm" onClick={saveHours} disabled={saving} className="text-xs gap-1 h-8">
                <Save className="h-3 w-3" /> {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">顧客名</TableHead>
            {DISPLAY_MONTHS.map((ym) => (
              <TableHead
                key={ym}
                className={cn(
                  "text-right whitespace-nowrap min-w-[100px]",
                  activeTab === "gph" && "cursor-pointer select-none hover:bg-muted/50 transition-colors",
                  sortColumn === ym && sortOrder !== "default" && "text-primary"
                )}
                onClick={() => {
                  if (activeTab !== "gph") return;
                  if (sortColumn === ym) {
                    setSortOrder((prev) => prev === "desc" ? "asc" : prev === "asc" ? "default" : "desc");
                    if (sortOrder === "asc") setSortColumn("avg");
                  } else {
                    setSortColumn(ym);
                    setSortOrder("desc");
                  }
                }}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  {MONTH_LABELS[ym]}
                  {activeTab === "gph" && sortColumn === ym && sortOrder === "desc" && <ArrowDown className="h-3 w-3" />}
                  {activeTab === "gph" && sortColumn === ym && sortOrder === "asc" && <ArrowUp className="h-3 w-3" />}
                </span>
              </TableHead>
            ))}
            <TableHead
              className={cn(
                "text-right font-bold whitespace-nowrap min-w-[100px]",
                activeTab === "gph" && "cursor-pointer select-none hover:bg-muted/50 transition-colors",
                sortColumn === "avg" && sortOrder !== "default" && "text-primary"
              )}
              onClick={() => {
                if (activeTab !== "gph") return;
                if (sortColumn === "avg") {
                  setSortOrder((prev) => prev === "desc" ? "asc" : prev === "asc" ? "default" : "desc");
                } else {
                  setSortColumn("avg");
                  setSortOrder("desc");
                }
              }}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                通期平均
                {activeTab === "gph" && sortColumn === "avg" && sortOrder === "desc" && <ArrowDown className="h-3 w-3" />}
                {activeTab === "gph" && sortColumn === "avg" && sortOrder === "asc" && <ArrowUp className="h-3 w-3" />}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.clientId}>
              <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                <div className="flex items-center">
                  {getRankBadge(idx)}
                  <span className="text-xs font-medium truncate max-w-[120px]">{row.clientName}</span>
                </div>
              </TableCell>
              {DISPLAY_MONTHS.map((ym) => {
                const gp = row.monthlyGrossProfit[ym] ?? 0;
                const h = row.monthlyHours[ym] ?? 0;

                if (activeTab === "gph") {
                  return (
                    <TableCell key={ym} className={cn("text-right font-mono-num text-xs whitespace-nowrap", gphColor(gp, h))}>
                      {gphCell(gp, h)}
                    </TableCell>
                  );
                }
                if (activeTab === "grossProfit") {
                  return (
                    <TableCell key={ym} className="text-right font-mono-num text-xs whitespace-nowrap">
                      {gp > 0 ? formatAmount(gp) : "—"}
                    </TableCell>
                  );
                }
                // hours tab - editable
                return (
                  <TableCell key={ym} className="p-1">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={hoursEdits[row.clientId]?.[ym] ?? savedHoursMap[row.clientId]?.[ym] ?? ""}
                      onChange={(e) => updateHours(row.clientId, ym, Number(e.target.value))}
                      className="h-8 text-xs text-right w-full min-w-[70px] font-mono-num"
                      placeholder="—"
                    />
                  </TableCell>
                );
              })}
              {/* Total / Average column */}
              <TableCell className={cn("text-right font-mono-num text-xs font-semibold whitespace-nowrap", activeTab === "gph" && gphColor(row.totalGrossProfit, row.totalHours))}>
                {activeTab === "gph" ? gphCell(row.totalGrossProfit, row.totalHours)
                  : activeTab === "grossProfit" ? (row.totalGrossProfit > 0 ? formatAmount(row.totalGrossProfit) : "—")
                  : `${row.totalHours.toFixed(1)}h`}
              </TableCell>
            </TableRow>
          ))}

          {/* Totals row */}
          <TableRow className="border-t-2 border-border font-semibold">
            <TableCell className="sticky left-0 bg-card z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] font-semibold">合計</TableCell>
            {DISPLAY_MONTHS.map((ym) => {
              const gp = totals.monthlyGP[ym] ?? 0;
              const h = totals.monthlyH[ym] ?? 0;
              return (
                <TableCell key={ym} className={cn("text-right font-mono-num text-xs whitespace-nowrap", activeTab === "gph" && gphColor(gp, h))}>
                  {activeTab === "gph" ? gphCell(gp, h)
                    : activeTab === "grossProfit" ? formatAmount(gp)
                    : `${h.toFixed(1)}h`}
                </TableCell>
              );
            })}
            <TableCell className={cn("text-right font-mono-num text-xs font-bold whitespace-nowrap", activeTab === "gph" && gphColor(totals.totalGP, totals.totalH))}>
              {activeTab === "gph" ? gphCell(totals.totalGP, totals.totalH)
                : activeTab === "grossProfit" ? formatAmount(totals.totalGP)
                : `${totals.totalH.toFixed(1)}h`}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
