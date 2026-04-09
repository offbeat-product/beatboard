import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, ClientRevenuePlanRow, fmtNum, distributeRevenue, PATTERN_GROWTH_MAP } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth, getFiscalYearMonths, ORG_ID } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Copy, ChevronsUpDown, ArrowUp, ArrowDown, Wand2 } from "lucide-react";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
  fiscalYear: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  existing: "既存",
  new: "新規",
  risk: "失注リスク",
};

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  existing: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  new: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  risk: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

export function ClientRevenuePlan({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();
  const [newClientName, setNewClientName] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  const rows = settings.client_revenue_plan || [];

  // Parse fiscal year end year from fiscalYear string like "2026年4月期"
  const fyEndYear = parseInt(fiscalYear);

  // Previous fiscal year months for computing averages
  const prevMonths = useMemo(() => getFiscalYearMonths(fyEndYear - 1), [fyEndYear]);

  // Fetch clients list
  const clientsQuery = useQuery({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, name_disp").eq("org_id", ORG_ID);
      return data ?? [];
    },
  });

  // Fetch actuals from project_pl for current FY
  const actualsQuery = useQuery({
    queryKey: ["client_revenue_actuals", fiscalYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_pl")
        .select("year_month, client_name, client_id, revenue")
        .eq("org_id", ORG_ID)
        .in("year_month", months);
      return data ?? [];
    },
  });

  // Fetch previous year actuals for existing client auto-calc
  const prevActualsQuery = useQuery({
    queryKey: ["client_revenue_prev_actuals", fyEndYear - 1],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_pl")
        .select("year_month, client_name, client_id, revenue")
        .eq("org_id", ORG_ID)
        .in("year_month", prevMonths);
      return data ?? [];
    },
  });

  const actuals = actualsQuery.data ?? [];
  const prevActuals = prevActualsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];

  // Previous year monthly average per client
  const getPrevYearMonthlyAvg = (clientName: string): number => {
    const clientRevenues = prevActuals.filter(a => a.client_name === clientName);
    if (clientRevenues.length === 0) return 0;
    const total = clientRevenues.reduce((s, a) => s + Number(a.revenue ?? 0), 0);
    const activeMonths = new Set(clientRevenues.map(a => a.year_month)).size;
    return activeMonths > 0 ? total / activeMonths : 0;
  };

  // Previous year annual total per client
  const getPrevYearTotal = (clientName: string): number => {
    return prevActuals
      .filter(a => a.client_name === clientName)
      .reduce((s, a) => s + Number(a.revenue ?? 0), 0);
  };

  const getClientActual = (clientName: string, ym: string): number => {
    return actuals
      .filter(a => a.client_name === clientName && a.year_month === ym)
      .reduce((s, a) => s + Number(a.revenue ?? 0), 0);
  };

  const updateRows = (newRows: ClientRevenuePlanRow[]) => {
    update("client_revenue_plan", newRows);
  };

  // Monthly target from distribution pattern (fixed, read-only)
  const getMonthTarget = (ym: string, i: number): number => {
    if (settings.distribution_mode === "equal") return settings.annual_revenue_target / 12;
    return settings.monthly_revenue_distribution[i] || 0;
  };

  // Auto-calculate existing client revenue based on prev year avg + distribution pattern
  const autoCalcExistingClient = (idx: number) => {
    const row = rows[idx];
    const monthlyAvg = getPrevYearMonthlyAvg(row.client_name);
    if (monthlyAvg <= 0) return;

    const annualEstimate = monthlyAvg * 12;
    const cap = row.revenue_cap;
    const cappedAnnual = cap && cap > 0 ? Math.min(annualEstimate, cap) : annualEstimate;

    // Distribute using the same pattern as the sales plan
    const growthFactor = PATTERN_GROWTH_MAP[settings.revenue_distribution_pattern] ?? settings.revenue_growth_factor ?? 1.5;

    // Split into H1/H2 if half_year mode
    let monthlyValues: number[];
    if (settings.distribution_mode === "half_year") {
      const h1Total = cappedAnnual * 0.4;
      const h2Total = cappedAnnual * 0.6;
      const h1 = distributeRevenue(h1Total, 6, growthFactor);
      const h2 = distributeRevenue(h2Total, 6, growthFactor);
      monthlyValues = [...h1, ...h2];
    } else if (settings.distribution_mode === "equal") {
      monthlyValues = months.map(() => Math.round(cappedAnnual / 12));
    } else {
      monthlyValues = distributeRevenue(cappedAnnual, 12, growthFactor);
    }

    // Apply cap per month if set
    if (cap && cap > 0) {
      monthlyValues = monthlyValues.map(v => Math.min(v, cap));
    }

    const newMonthly: Record<string, number> = {};
    months.forEach((ym, i) => { newMonthly[ym] = monthlyValues[i] || 0; });

    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], monthly_revenue: newMonthly };
    updateRows(newRows);
  };

  const addClient = (clientId: string | null, clientName: string) => {
    const newRow: ClientRevenuePlanRow = {
      client_id: clientId,
      client_name: clientName,
      category: clientId ? "existing" : "new",
      monthly_revenue: {},
      order: rows.length + 1,
      revenue_cap: null,
    };
    updateRows([...rows, newRow]);
    setNewClientName("");
    setShowClientPicker(false);
  };

  const removeClient = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    updateRows(newRows);
  };

  const moveClient = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rows.length) return;
    const newRows = [...rows];
    [newRows[idx], newRows[newIdx]] = [newRows[newIdx], newRows[idx]];
    updateRows(newRows.map((r, i) => ({ ...r, order: i + 1 })));
  };

  const setCellValue = (idx: number, ym: string, value: number) => {
    const row = rows[idx];
    const cap = row.revenue_cap;
    const cappedValue = cap && cap > 0 ? Math.min(value, cap) : value;
    const newRows = [...rows];
    newRows[idx] = {
      ...newRows[idx],
      monthly_revenue: { ...newRows[idx].monthly_revenue, [ym]: cappedValue },
    };
    updateRows(newRows);
  };

  const setCategory = (idx: number, cat: string) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], category: cat as any };
    updateRows(newRows);
  };

  const setRevenueCap = (idx: number, cap: number | null) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], revenue_cap: cap };
    updateRows(newRows);
  };

  const applyToAllMonths = (idx: number) => {
    const firstMonth = months[0];
    let val = rows[idx].monthly_revenue[firstMonth] || 0;
    const cap = rows[idx].revenue_cap;
    if (cap && cap > 0) val = Math.min(val, cap);
    const newRows = [...rows];
    const newMonthly = { ...newRows[idx].monthly_revenue };
    for (const ym of months) newMonthly[ym] = val;
    newRows[idx] = { ...newRows[idx], monthly_revenue: newMonthly };
    updateRows(newRows);
  };

  const getMonthTotal = (ym: string): number =>
    rows.reduce((s, r) => s + (r.monthly_revenue[ym] || 0), 0);

  const getRowAnnual = (row: ClientRevenuePlanRow): number =>
    months.reduce((s, ym) => s + (row.monthly_revenue[ym] || 0), 0);

  const grandTotal = months.reduce((s, ym) => s + getMonthTotal(ym), 0);

  const annualTarget = settings.distribution_mode === "equal"
    ? settings.annual_revenue_target
    : settings.monthly_revenue_distribution.reduce((s, v) => s + v, 0);

  const fmtC = (v: number) => fmtNum(v, unit);
  const parseInput = (v: string): number => parseInt(v.replace(/,/g, "")) || 0;

  const isPastMonth = (ym: string) => ym <= currentMonth;

  // Clients not yet added
  const usedClientIds = new Set(rows.filter(r => r.client_id).map(r => r.client_id));
  const availableClients = clients.filter(c => !usedClientIds.has(String(c.id)));

  return (
    <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="px-5 py-4">
        <SectionHeading title="顧客別売上計画" description="配分パターンで設定された月次売上目標の内訳を顧客別に入力します。" />
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-sm font-medium">年間目標:</span>
          <span className="text-base font-bold text-primary">{fmtC(annualTarget)}</span>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm font-medium">顧客別合計:</span>
          <span className={cn("text-base font-bold", Math.abs(grandTotal - annualTarget) < 1 ? "text-green-600" : "text-destructive")}>{fmtC(grandTotal)}</span>
          {Math.abs(grandTotal - annualTarget) >= 1 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              差額: {fmtC(grandTotal - annualTarget)}
            </Badge>
          )}
          {Math.abs(grandTotal - annualTarget) < 1 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">一致</Badge>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[150px] text-xs">顧客名</TableHead>
              <TableHead className="sticky left-[150px] bg-card z-10 min-w-[80px] text-xs">区分</TableHead>
              <TableHead className="sticky left-[230px] bg-card z-10 min-w-[90px] text-xs">上限額</TableHead>
              <TableHead className="sticky left-[320px] bg-card z-10 min-w-[30px] text-xs"></TableHead>
              {months.map(m => (
                <TableHead key={m} className={cn("text-center text-xs min-w-[120px]", m === currentMonth && "bg-primary/5")}>
                  {getMonthLabel(m)}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs min-w-[110px] bg-muted/50">年間合計</TableHead>
              <TableHead className="text-center text-xs min-w-[100px] bg-muted/50">前期合計</TableHead>
              <TableHead className="text-center text-xs min-w-[70px] bg-muted/50">成長率</TableHead>
              <TableHead className="text-xs min-w-[110px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const prevAvg = row.category === "existing" ? getPrevYearMonthlyAvg(row.client_name) : 0;
              return (
                <TableRow key={idx} className={cn("hover:bg-muted/30", row.category === "risk" && "bg-red-50/50 dark:bg-red-950/10")}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium border-r text-xs">
                    <span className="truncate block max-w-[140px]">{row.client_name}</span>
                  </TableCell>
                  <TableCell className="sticky left-[150px] bg-card z-10 border-r p-1">
                    <Select value={row.category} onValueChange={(v) => setCategory(idx, v)}>
                      <SelectTrigger className={cn("h-6 text-[10px] w-[70px] px-1 border", CATEGORY_BADGE_STYLES[row.category])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing"><span className="text-blue-700 dark:text-blue-400">既存</span></SelectItem>
                        <SelectItem value="new"><span className="text-emerald-700 dark:text-emerald-400">新規</span></SelectItem>
                        <SelectItem value="risk"><span className="text-red-700 dark:text-red-400">失注リスク</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="sticky left-[230px] bg-card z-10 border-r p-1">
                    <Input
                      type="text"
                      value={row.revenue_cap ? row.revenue_cap.toLocaleString() : ""}
                      onChange={(e) => {
                        const v = parseInput(e.target.value);
                        setRevenueCap(idx, v > 0 ? v : null);
                      }}
                      placeholder="上限なし"
                      className="h-6 text-[10px] text-right w-[80px]"
                    />
                  </TableCell>
                  <TableCell className="sticky left-[320px] bg-card z-10 border-r p-0">
                    <div className="flex items-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => applyToAllMonths(idx)} title="最初の月の値を全月にコピー">
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      {row.category === "existing" && prevAvg > 0 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => autoCalcExistingClient(idx)} title="前期実績から自動計算">
                          <Wand2 className="h-3 w-3 text-blue-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  {months.map((ym) => {
                    const planVal = row.monthly_revenue[ym] || 0;
                    const hasActual = isPastMonth(ym);
                    const actual = hasActual ? getClientActual(row.client_name, ym) : 0;
                    const achRate = hasActual && planVal > 0 ? (actual / planVal) * 100 : 0;
                    const cap = row.revenue_cap;
                    const isAtCap = cap && cap > 0 && planVal >= cap;

                    return (
                      <TableCell key={ym} className={cn("p-1", ym === currentMonth && "bg-primary/5")}>
                        <div className="flex flex-col items-end gap-0.5">
                          <Input
                            type="text"
                            value={planVal > 0 ? planVal.toLocaleString() : ""}
                            onChange={(e) => setCellValue(idx, ym, parseInput(e.target.value))}
                            placeholder="0"
                            className={cn("h-7 text-xs text-right w-[100px]", isAtCap && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20")}
                          />
                          {hasActual && actual > 0 && (
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground px-1">
                              <span>{fmtC(actual)}</span>
                              <span className={cn(achRate >= 100 ? "text-green-600" : "text-destructive")}>
                                {achRate > 0 ? `${achRate.toFixed(0)}%` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right bg-muted/30 font-medium">
                    {fmtC(getRowAnnual(row))}
                  </TableCell>
                  <TableCell className="text-right bg-muted/30 text-xs text-muted-foreground">
                    {(() => { const pt = getPrevYearTotal(row.client_name); return pt > 0 ? fmtC(pt) : "—"; })()}
                  </TableCell>
                  <TableCell className="text-right bg-muted/30 text-xs">
                    {(() => {
                      const pt = getPrevYearTotal(row.client_name);
                      const annual = getRowAnnual(row);
                      if (pt <= 0 || annual <= 0) return <span className="text-muted-foreground">—</span>;
                      const growth = ((annual - pt) / pt) * 100;
                      return (
                        <span className={cn(growth >= 0 ? "text-green-600" : "text-destructive", "font-medium")}>
                          {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="p-1">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveClient(idx, "up")} disabled={idx === 0} title="上に移動">
                        <ArrowUp className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveClient(idx, "down")} disabled={idx === rows.length - 1} title="下に移動">
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeClient(idx)} title="削除">
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Month target row */}
            <TableRow className="bg-muted/30">
              <TableCell className="sticky left-0 bg-muted/30 z-10 text-xs text-muted-foreground border-r">月次目標</TableCell>
              <TableCell className="sticky left-[150px] bg-muted/30 z-10 border-r text-[10px] text-muted-foreground">配分</TableCell>
              <TableCell className="sticky left-[230px] bg-muted/30 z-10 border-r" />
              <TableCell className="sticky left-[320px] bg-muted/30 z-10 border-r" />
              {months.map((ym, i) => (
                <TableCell key={ym} className={cn("text-right text-xs text-muted-foreground", ym === currentMonth && "bg-primary/5")}>
                  {fmtC(getMonthTarget(ym, i))}
                </TableCell>
              ))}
              <TableCell className="text-right bg-muted/30 text-xs text-muted-foreground">{fmtC(annualTarget)}</TableCell>
              <TableCell />
            </TableRow>

            {/* Month totals */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="sticky left-0 bg-muted/50 z-10 font-semibold border-r border-l-4 border-l-primary">顧客合計</TableCell>
              <TableCell className="sticky left-[150px] bg-muted/50 z-10 border-r">—</TableCell>
              <TableCell className="sticky left-[230px] bg-muted/50 z-10 border-r" />
              <TableCell className="sticky left-[320px] bg-muted/50 z-10 border-r" />
              {months.map((ym) => (
                <TableCell key={ym} className={cn("text-right font-semibold", ym === currentMonth && "bg-primary/5")}>
                  {fmtC(getMonthTotal(ym))}
                </TableCell>
              ))}
              <TableCell className="text-right bg-muted/30 font-bold">{fmtC(grandTotal)}</TableCell>
              <TableCell />
            </TableRow>

            {/* Remaining row */}
            <TableRow>
              <TableCell className="sticky left-0 bg-card z-10 text-xs border-r">残額（未配分）</TableCell>
              <TableCell className="sticky left-[150px] bg-card z-10 border-r" />
              <TableCell className="sticky left-[230px] bg-card z-10 border-r" />
              <TableCell className="sticky left-[320px] bg-card z-10 border-r" />
              {months.map((ym, i) => {
                const target = getMonthTarget(ym, i);
                const total = getMonthTotal(ym);
                const remaining = target - total;
                return (
                  <TableCell key={ym} className={cn("text-right text-xs", ym === currentMonth && "bg-primary/5", remaining > 0 ? "text-amber-600" : remaining < 0 ? "text-destructive" : "text-green-600")}>
                    {fmtC(remaining)}
                  </TableCell>
                );
              })}
              <TableCell className={cn("text-right bg-muted/30 text-xs font-medium", annualTarget - grandTotal > 0 ? "text-amber-600" : annualTarget - grandTotal < 0 ? "text-destructive" : "text-green-600")}>
                {fmtC(annualTarget - grandTotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Add client */}
      <div className="px-5 py-3 border-t flex flex-wrap items-center gap-2">
        {showClientPicker ? (
          <>
            <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={clientSearchOpen} className="h-8 text-xs w-[220px] justify-between font-normal">
                  既存顧客を検索・選択...
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="顧客名で検索..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>該当する顧客がありません</CommandEmpty>
                    <CommandGroup>
                      {availableClients.map(c => (
                        <CommandItem
                          key={c.id}
                          value={(c.name_disp || c.name) ?? ""}
                          onSelect={() => {
                            addClient(String(c.id), (c.name_disp || c.name) ?? "");
                            setClientSearchOpen(false);
                          }}
                          className="text-xs"
                        >
                          {c.name_disp || c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">または</span>
            <Input
              type="text"
              placeholder="新規顧客名..."
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="h-8 text-xs w-[160px]"
              onKeyDown={(e) => e.key === "Enter" && newClientName.trim() && addClient(null, newClientName.trim())}
            />
            <Button variant="outline" size="sm" onClick={() => newClientName.trim() && addClient(null, newClientName.trim())} disabled={!newClientName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />追加
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowClientPicker(false)}>キャンセル</Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowClientPicker(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />顧客行を追加
          </Button>
        )}
      </div>
    </section>
  );
}
