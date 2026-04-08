import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, ClientRevenuePlanRow, fmtNum } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth, ORG_ID } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Copy, ChevronsUpDown, Check } from "lucide-react";

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

export function ClientRevenuePlan({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();
  const [newClientName, setNewClientName] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  const rows = settings.client_revenue_plan || [];

  // Fetch clients list
  const clientsQuery = useQuery({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, name_disp").eq("org_id", ORG_ID);
      return data ?? [];
    },
  });

  // Fetch actuals from project_pl
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

  const actuals = actualsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];

  const getClientActual = (clientName: string, ym: string): number => {
    return actuals
      .filter(a => a.client_name === clientName && a.year_month === ym)
      .reduce((s, a) => s + Number(a.revenue ?? 0), 0);
  };

  const updateRows = (newRows: ClientRevenuePlanRow[]) => {
    update("client_revenue_plan", newRows);
    // SSoT: update monthly_revenue_distribution from client plan totals
    const newDist = months.map(ym =>
      newRows.reduce((s, r) => s + (r.monthly_revenue[ym] || 0), 0)
    );
    update("monthly_revenue_distribution", newDist);
    update("distribution_mode", "client_plan");
  };

  const addClient = (clientId: string | null, clientName: string) => {
    const newRow: ClientRevenuePlanRow = {
      client_id: clientId,
      client_name: clientName,
      category: clientId ? "existing" : "new",
      monthly_revenue: {},
      order: rows.length + 1,
    };
    updateRows([...rows, newRow]);
    setNewClientName("");
    setShowClientPicker(false);
  };

  const removeClient = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    updateRows(newRows);
  };

  const setCellValue = (idx: number, ym: string, value: number) => {
    const newRows = [...rows];
    newRows[idx] = {
      ...newRows[idx],
      monthly_revenue: { ...newRows[idx].monthly_revenue, [ym]: value },
    };
    updateRows(newRows);
  };

  const setCategory = (idx: number, cat: string) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], category: cat as any };
    updateRows(newRows);
  };

  const applyToAllMonths = (idx: number) => {
    const firstMonth = months[0];
    const val = rows[idx].monthly_revenue[firstMonth] || 0;
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

  const fmtC = (v: number) => fmtNum(v, unit);
  const parseInput = (v: string): number => parseInt(v.replace(/,/g, "")) || 0;

  const isPastMonth = (ym: string) => ym <= currentMonth;

  // Clients not yet added
  const usedClientIds = new Set(rows.filter(r => r.client_id).map(r => r.client_id));
  const availableClients = clients.filter(c => !usedClientIds.has(String(c.id)));

  return (
    <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="px-5 py-4">
        <SectionHeading title="顧客別売上計画" description="顧客ごとの月別売上計画を入力します。月合計が月次売上計画に自動反映されます（Single Source of Truth）。" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">年間合計:</span>
          <span className="text-base font-bold text-primary">{fmtC(grandTotal)}</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">顧客別合計 → 月次売上計画に自動反映</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[150px] text-xs">顧客名</TableHead>
              <TableHead className="sticky left-[150px] bg-card z-10 min-w-[70px] text-xs">区分</TableHead>
              <TableHead className="sticky left-[220px] bg-card z-10 min-w-[30px] text-xs"></TableHead>
              {months.map(m => (
                <TableHead key={m} className={cn("text-center text-xs min-w-[120px]", m === currentMonth && "bg-primary/5")}>
                  {getMonthLabel(m)}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs min-w-[110px] bg-muted/50">年間合計</TableHead>
              <TableHead className="text-xs min-w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx} className={cn("hover:bg-muted/30", row.category === "risk" && "bg-red-50/50 dark:bg-red-950/10")}>
                <TableCell className="sticky left-0 bg-card z-10 font-medium border-r text-xs">
                  <span className="truncate block max-w-[140px]">{row.client_name}</span>
                </TableCell>
                <TableCell className="sticky left-[150px] bg-card z-10 border-r p-1">
                  <Select value={row.category} onValueChange={(v) => setCategory(idx, v)}>
                    <SelectTrigger className="h-6 text-[10px] w-[60px] px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">既存</SelectItem>
                      <SelectItem value="new">新規</SelectItem>
                      <SelectItem value="risk">失注リスク</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="sticky left-[220px] bg-card z-10 border-r p-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => applyToAllMonths(idx)} title="最初の月の値を全月にコピー">
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
                {months.map((ym) => {
                  const planVal = row.monthly_revenue[ym] || 0;
                  const hasActual = isPastMonth(ym);
                  const actual = hasActual ? getClientActual(row.client_name, ym) : 0;
                  const achRate = hasActual && planVal > 0 ? (actual / planVal) * 100 : 0;

                  return (
                    <TableCell key={ym} className={cn("p-1", ym === currentMonth && "bg-primary/5")}>
                      <div className="flex flex-col items-end gap-0.5">
                        <Input
                          type="text"
                          value={planVal > 0 ? planVal.toLocaleString() : ""}
                          onChange={(e) => setCellValue(idx, ym, parseInput(e.target.value))}
                          placeholder="0"
                          className="h-7 text-xs text-right w-[100px] focus-visible:ring-[hsl(217,91%,60%)]"
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
                <TableCell className="text-right bg-muted/30 font-medium">{fmtC(getRowAnnual(row))}</TableCell>
                <TableCell className="p-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeClient(idx)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {/* Month totals */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="sticky left-0 bg-muted/50 z-10 font-semibold border-r border-l-4 border-l-primary">月合計</TableCell>
              <TableCell className="sticky left-[150px] bg-muted/50 z-10 border-r">—</TableCell>
              <TableCell className="sticky left-[220px] bg-muted/50 z-10 border-r" />
              {months.map((ym) => (
                <TableCell key={ym} className={cn("text-right font-semibold", ym === currentMonth && "bg-primary/5")}>
                  {fmtC(getMonthTotal(ym))}
                </TableCell>
              ))}
              <TableCell className="text-right bg-muted/30 font-bold">{fmtC(grandTotal)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Add client */}
      <div className="px-5 py-3 border-t flex flex-wrap items-center gap-2">
        {showClientPicker ? (
          <>
            <Select onValueChange={(v) => {
              const c = clients.find(c => String(c.id) === v);
              if (c) addClient(String(c.id), (c.name_disp || c.name) ?? "");
            }}>
              <SelectTrigger className="h-8 text-xs w-[200px]">
                <SelectValue placeholder="既存顧客を選択..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name_disp || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">または</span>
            <Input
              type="text"
              placeholder="新規顧客名..."
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="h-8 text-xs w-[160px] focus-visible:ring-[hsl(217,91%,60%)]"
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
