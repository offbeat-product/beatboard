import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, SgaCategory, DEFAULT_SGA_CATEGORIES, fmtNum, SGA_CATEGORY_TOOLTIPS } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { cn } from "@/lib/utils";
import { Plus, Trash2, RotateCcw, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabSgaPlan({ months, settings, update }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();
  const [newCatName, setNewCatName] = useState("");
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const categories = settings.sga_categories.length > 0 ? settings.sga_categories : DEFAULT_SGA_CATEGORIES;

  // --- Derive monthly SGA budget from monthly business plan ---
  const getWeightedGpRate = (ym: string): number => {
    const crp = settings.client_revenue_plan || [];
    let totalRev = 0;
    let weightedGp = 0;
    for (const row of crp) {
      const rev = row.monthly_revenue[ym] || 0;
      if (rev > 0) {
        const rate = row.gross_profit_rate ?? settings.gross_profit_rate;
        totalRev += rev;
        weightedGp += rev * (rate / 100);
      }
    }
    if (totalRev <= 0) return settings.gross_profit_rate;
    return (weightedGp / totalRev) * 100;
  };

  const getMonthlySgaBudget = (ym: string, monthIdx: number): number => {
    const dist = settings.monthly_revenue_distribution ?? [];
    const rev = settings.distribution_mode === "equal"
      ? settings.annual_revenue_target / (months.length || 12)
      : (dist[monthIdx] || 0);
    const gpRate = getWeightedGpRate(ym);
    const gpPlan = rev * (gpRate / 100);
    const opPlan = rev * (settings.operating_profit_rate / 100);
    return gpPlan - opPlan;
  };

  const annualSgaBudget = months.reduce((s, ym, i) => s + getMonthlySgaBudget(ym, i), 0);

  // Category cell value: monthly SGA budget × allocation rate, or override
  const getCell = (ym: string, monthIdx: number, catId: string): { value: number; isOverride: boolean } => {
    const override = settings.monthly_sga_overrides?.[ym]?.[catId];
    if (override !== undefined && override !== null) {
      return { value: override, isOverride: true };
    }
    const rate = settings.sga_allocation_rates?.[catId] ?? 0;
    const budget = getMonthlySgaBudget(ym, monthIdx);
    return { value: budget * (rate / 100), isOverride: false };
  };

  // Allocation rates sum
  const ratesSum = categories.reduce((s, cat) => s + (settings.sga_allocation_rates?.[cat.id] ?? 0), 0);
  const ratesValid = Math.abs(ratesSum - 100) < 0.1;

  const setOverride = (ym: string, catId: string, value: number) => {
    const next = { ...settings.monthly_sga_overrides };
    if (!next[ym]) next[ym] = {};
    next[ym] = { ...next[ym], [catId]: value };
    update("monthly_sga_overrides", next);
  };

  const clearOverride = (ym: string, catId: string) => {
    const next = { ...settings.monthly_sga_overrides };
    if (next[ym]) {
      const { [catId]: _, ...rest } = next[ym];
      next[ym] = rest;
      if (Object.keys(next[ym]).length === 0) delete next[ym];
    }
    update("monthly_sga_overrides", next);
  };

  const getMonthTotal = (ym: string, monthIdx: number): number =>
    categories.reduce((s, cat) => s + getCell(ym, monthIdx, cat.id).value, 0);

  const getCategoryAnnualTotal = (catId: string): number =>
    months.reduce((s, ym, i) => s + getCell(ym, i, catId).value, 0);

  const grandTotal = months.reduce((s, ym, i) => s + getMonthTotal(ym, i), 0);

  const updateRate = (catId: string, rate: number) => {
    const next = { ...settings.sga_allocation_rates, [catId]: rate };
    update("sga_allocation_rates", next);
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: SgaCategory = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      order: categories.length + 1,
    };
    update("sga_categories", [...categories, newCat]);
    update("sga_allocation_rates", { ...settings.sga_allocation_rates, [newCat.id]: 0 });
    setNewCatName("");
  };

  const removeCategory = (catId: string) => {
    update("sga_categories", categories.filter(c => c.id !== catId));
    const { [catId]: _, ...restRates } = settings.sga_allocation_rates;
    update("sga_allocation_rates", restRates);
    const nextOv = { ...settings.monthly_sga_overrides };
    for (const ym of Object.keys(nextOv)) {
      if (nextOv[ym]?.[catId] !== undefined) {
        const { [catId]: __, ...rest } = nextOv[ym];
        nextOv[ym] = rest;
      }
    }
    update("monthly_sga_overrides", nextOv);
  };

  const fmtC = (v: number) => fmtNum(v, unit);
  const parseInput = (v: string): number => parseInt(v.replace(/,/g, "")) || 0;
  const cellKey = (ym: string, catId: string) => `${ym}__${catId}`;

  return (
    <div className="space-y-8">
      {/* Annual SGA budget summary + allocation rates */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="販管費予算・配分比率" description="月次事業計画（粗利 − 営業利益）から年間販管費予算を自動算出し、各カテゴリへの配分比率を設定します。" />

        {/* Budget summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">年間販管費予算（自動算出）</p>
            <p className="text-lg font-bold">{fmtC(annualSgaBudget)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">= 年間粗利計画 − 年間営業利益計画</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">月平均販管費予算</p>
            <p className="text-lg font-bold">{fmtC(annualSgaBudget / Math.max(months.length, 1))}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">カテゴリ配分後合計</p>
            <p className={cn("text-lg font-bold", Math.abs(grandTotal - annualSgaBudget) > 1 ? "text-amber-600" : "")}>{fmtC(grandTotal)}</p>
            {Math.abs(grandTotal - annualSgaBudget) > 1 && (
              <p className="text-[10px] text-amber-600 mt-0.5">手動上書きにより予算と差異があります</p>
            )}
          </div>
        </div>

        <p className="text-xs font-medium mb-2">
          配分比率合計: <span className={cn(ratesValid ? "text-green-600" : "text-destructive", "font-semibold")}>{ratesSum.toFixed(1)}%</span>
          {!ratesValid && <span className="text-destructive ml-1 text-[10px]">（合計100%にしてください）</span>}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium truncate">{cat.name} (%)</label>
                {SGA_CATEGORY_TOOLTIPS[cat.id] && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        {SGA_CATEGORY_TOOLTIPS[cat.id]}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                type="number"
                value={settings.sga_allocation_rates?.[cat.id] ?? 0}
                onChange={(e) => updateRate(cat.id, parseFloat(e.target.value) || 0)}
                className="mt-1 h-8 text-xs focus-visible:ring-[hsl(217,91%,60%)]"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                年間: {fmtC(annualSgaBudget * ((settings.sga_allocation_rates?.[cat.id] ?? 0) / 100))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly SGA matrix */}
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="販管費月次計画" description="月次の販管費予算（粗利−営業利益）× 配分比率で自動算出されます。セルをクリックして個別に上書きできます。" />
        </div>

        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] text-xs">カテゴリ</TableHead>
                <TableHead className="sticky left-[160px] bg-card z-10 min-w-[50px] text-xs">配分</TableHead>
                {months.map(m => (
                  <TableHead key={m} className={cn("text-center text-xs min-w-[120px]", m === currentMonth && "bg-primary/5")}>
                    {getMonthLabel(m)}
                  </TableHead>
                ))}
                <TableHead className="text-center text-xs min-w-[110px] bg-muted/50">年間合計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Monthly SGA budget row */}
              <TableRow className="bg-primary/5 font-medium">
                <TableCell className="sticky left-0 bg-primary/5 z-10 font-semibold border-r text-xs border-l-4 border-l-primary">月次販管費予算</TableCell>
                <TableCell className="sticky left-[160px] bg-primary/5 z-10 border-r text-xs text-center text-muted-foreground">—</TableCell>
                {months.map((ym, i) => (
                  <TableCell key={ym} className={cn("text-right font-medium", ym === currentMonth && "bg-primary/10")}>
                    {fmtC(getMonthlySgaBudget(ym, i))}
                  </TableCell>
                ))}
                <TableCell className="text-right bg-muted/30 font-bold">{fmtC(annualSgaBudget)}</TableCell>
              </TableRow>

              {categories.map((cat) => (
                <TableRow key={cat.id} className="hover:bg-muted/30">
                  <TableCell className="sticky left-0 bg-card z-10 font-medium border-r text-xs">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{cat.name}</span>
                      {SGA_CATEGORY_TOOLTIPS[cat.id] && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[240px] text-xs">
                              {SGA_CATEGORY_TOOLTIPS[cat.id]}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeCategory(cat.id)} title="カテゴリを削除">
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="sticky left-[160px] bg-card z-10 border-r text-xs text-center text-muted-foreground">
                    {(settings.sga_allocation_rates?.[cat.id] ?? 0).toFixed(0)}%
                  </TableCell>
                  {months.map((ym, mi) => {
                    const cell = getCell(ym, mi, cat.id);
                    const key = cellKey(ym, cat.id);
                    const isEditing = editingCell === key;

                    return (
                      <TableCell key={ym} className={cn("p-1", ym === currentMonth && "bg-primary/5")}>
                        {isEditing ? (
                          <Input
                            type="text"
                            defaultValue={cell.value > 0 ? Math.round(cell.value).toLocaleString() : ""}
                            autoFocus
                            onBlur={(e) => {
                              const v = parseInput(e.target.value);
                              if (v > 0) setOverride(ym, cat.id, v);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            placeholder="0"
                            className="h-7 text-xs text-right w-[100px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 cursor-pointer rounded px-1.5 py-1 min-h-[28px] hover:bg-muted/50",
                              !cell.isOverride && "text-muted-foreground"
                            )}
                            onClick={() => setEditingCell(key)}
                          >
                            <span className="text-xs">{cell.value > 0 ? Math.round(cell.value).toLocaleString() : "—"}</span>
                            <Badge variant={cell.isOverride ? "default" : "secondary"} className="text-[7px] px-1 py-0 h-3.5 shrink-0">
                              {cell.isOverride ? "手動" : "自動"}
                            </Badge>
                            {cell.isOverride && (
                              <button
                                onClick={(e) => { e.stopPropagation(); clearOverride(ym, cat.id); }}
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
                                title="自動値に戻す"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right bg-muted/30 font-medium">{fmtC(getCategoryAnnualTotal(cat.id))}</TableCell>
                </TableRow>
              ))}

              {/* Month totals */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="sticky left-0 bg-muted/50 z-10 font-semibold border-r border-l-4 border-l-primary">配分後合計</TableCell>
                <TableCell className="sticky left-[160px] bg-muted/50 z-10 border-r" />
                {months.map((ym, i) => (
                  <TableCell key={ym} className={cn("text-right font-semibold", ym === currentMonth && "bg-primary/5")}>
                    {fmtC(getMonthTotal(ym, i))}
                  </TableCell>
                ))}
                <TableCell className="text-right bg-muted/30 font-bold">{fmtC(grandTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Add category */}
        <div className="px-5 py-3 border-t flex items-center gap-2">
          <Input
            type="text"
            placeholder="新しいカテゴリ名を入力..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="h-8 text-xs max-w-[250px] focus-visible:ring-[hsl(217,91%,60%)]"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <Button variant="outline" size="sm" onClick={addCategory} disabled={!newCatName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />カテゴリ追加
          </Button>
        </div>
      </section>
    </div>
  );
}
