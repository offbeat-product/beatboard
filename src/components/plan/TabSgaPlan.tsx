import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, SgaCategory, DEFAULT_SGA_CATEGORIES, fmtNum, computeAnnualSgaTotal, getSgaCellValue, SGA_CATEGORY_TOOLTIPS } from "./PlanTypes";
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
  const annualSga = computeAnnualSgaTotal(settings);

  // Allocation rates sum
  const ratesSum = categories.reduce((s, cat) => s + (settings.sga_allocation_rates?.[cat.id] ?? 0), 0);
  const ratesValid = Math.abs(ratesSum - 100) < 0.1;

  const getCell = (ym: string, catId: string) => getSgaCellValue(settings, ym, catId, annualSga);

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

  const getMonthTotal = (ym: string): number =>
    categories.reduce((s, cat) => s + getCell(ym, cat.id).value, 0);

  const getCategoryAnnualTotal = (catId: string): number =>
    months.reduce((s, ym) => s + getCell(ym, catId).value, 0);

  const grandTotal = months.reduce((s, ym) => s + getMonthTotal(ym), 0);

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
    // Initialize rate to 0
    update("sga_allocation_rates", { ...settings.sga_allocation_rates, [newCat.id]: 0 });
    setNewCatName("");
  };

  const removeCategory = (catId: string) => {
    update("sga_categories", categories.filter(c => c.id !== catId));
    const { [catId]: _, ...restRates } = settings.sga_allocation_rates;
    update("sga_allocation_rates", restRates);
    // Clean overrides
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
      {/* Annual SGA total + allocation rates overview */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="年間販管費・配分比率" description="年間販管費合計と各カテゴリへの配分比率を設定します。月別のセルは自動算出され、個別に上書きも可能です。" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium">年間販管費合計 (円)<span className="text-destructive ml-0.5">*</span></label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="text"
                value={settings.annual_sga_total > 0 ? settings.annual_sga_total.toLocaleString() : ""}
                placeholder={`自動算出: ${fmtC(computeAnnualSgaTotal({ ...settings, annual_sga_total: 0 }))}`}
                onChange={(e) => update("annual_sga_total", parseInput(e.target.value))}
                className="focus-visible:ring-[hsl(217,91%,60%)]"
              />
              {settings.annual_sga_total > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => update("annual_sga_total", 0)} title="自動算出に戻す">
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">空欄の場合: 粗利 - 営業利益 から自動算出 ({fmtC(annualSga)})</p>
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
            </div>
          ))}
        </div>
      </section>

      {/* Monthly SGA matrix */}
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="販管費月次計画" description="配分比率から自動算出されます。セルをクリックして個別に上書きできます。" />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">年間販管費合計:</span>
            <span className="text-base font-bold text-primary">{fmtC(grandTotal)}</span>
          </div>
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
                  {months.map((ym) => {
                    const cell = getCell(ym, cat.id);
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
                <TableCell className="sticky left-0 bg-muted/50 z-10 font-semibold border-r border-l-4 border-l-primary">月合計</TableCell>
                <TableCell className="sticky left-[160px] bg-muted/50 z-10 border-r" />
                {months.map((ym) => (
                  <TableCell key={ym} className={cn("text-right font-semibold", ym === currentMonth && "bg-primary/5")}>
                    {fmtC(getMonthTotal(ym))}
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
