import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, SgaCategory, DEFAULT_SGA_CATEGORIES, fmtNum } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Copy } from "lucide-react";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabSgaPlan({ months, settings, update }: Props) {
  const { unit } = useCurrencyUnit();
  const currentMonth = getCurrentMonth();
  const [newCatName, setNewCatName] = useState("");

  const categories = settings.sga_categories.length > 0 ? settings.sga_categories : DEFAULT_SGA_CATEGORIES;

  const getCellValue = (ym: string, catId: string): number => {
    return settings.monthly_sga[ym]?.[catId] || 0;
  };

  const setCellValue = (ym: string, catId: string, value: number) => {
    const next = { ...settings.monthly_sga };
    if (!next[ym]) next[ym] = {};
    next[ym] = { ...next[ym], [catId]: value };
    update("monthly_sga", next);
  };

  const getMonthTotal = (ym: string): number => {
    return categories.reduce((s, cat) => s + getCellValue(ym, cat.id), 0);
  };

  const getCategoryAnnualTotal = (catId: string): number => {
    return months.reduce((s, ym) => s + getCellValue(ym, catId), 0);
  };

  const grandTotal = months.reduce((s, ym) => s + getMonthTotal(ym), 0);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: SgaCategory = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      order: categories.length + 1,
    };
    update("sga_categories", [...categories, newCat]);
    setNewCatName("");
  };

  const removeCategory = (catId: string) => {
    update("sga_categories", categories.filter(c => c.id !== catId));
    // Also remove from monthly_sga
    const next = { ...settings.monthly_sga };
    for (const ym of Object.keys(next)) {
      if (next[ym]?.[catId] !== undefined) {
        const { [catId]: _, ...rest } = next[ym];
        next[ym] = rest;
      }
    }
    update("monthly_sga", next);
  };

  const applyToAllMonths = (catId: string) => {
    const firstMonth = months[0];
    const val = getCellValue(firstMonth, catId);
    const next = { ...settings.monthly_sga };
    for (const ym of months) {
      if (!next[ym]) next[ym] = {};
      next[ym] = { ...next[ym], [catId]: val };
    }
    update("monthly_sga", next);
  };

  const fmtC = (v: number) => fmtNum(v, unit);

  const parseInput = (v: string): number => {
    return parseInt(v.replace(/,/g, "")) || 0;
  };

  return (
    <div className="space-y-8">
      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4">
          <SectionHeading title="販管費計画" description="カテゴリ別・月別の販管費計画を入力します。年間合計は自動計算されます。" />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">年間販管費合計:</span>
            <span className="text-base font-bold text-primary">{fmtC(grandTotal)}</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">自動計算</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[200px] text-xs">カテゴリ</TableHead>
                <TableHead className="sticky left-[200px] bg-card z-10 min-w-[40px] text-xs"></TableHead>
                {months.map(m => (
                  <TableHead key={m} className={cn("text-center text-xs min-w-[100px]", m === currentMonth && "bg-primary/5")}>
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
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeCategory(cat.id)} title="カテゴリを削除">
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="sticky left-[200px] bg-card z-10 border-r p-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => applyToAllMonths(cat.id)} title="最初の月の値を全月にコピー">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TableCell>
                  {months.map((ym) => (
                    <TableCell key={ym} className={cn("p-1", ym === currentMonth && "bg-primary/5")}>
                      <Input
                        type="text"
                        value={getCellValue(ym, cat.id) > 0 ? getCellValue(ym, cat.id).toLocaleString() : ""}
                        onChange={(e) => setCellValue(ym, cat.id, parseInput(e.target.value))}
                        placeholder="0"
                        className="h-7 text-xs text-right w-[90px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right bg-muted/30 font-medium">{fmtC(getCategoryAnnualTotal(cat.id))}</TableCell>
                </TableRow>
              ))}

              {/* Month totals */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="sticky left-0 bg-muted/50 z-10 font-semibold border-r border-l-4 border-l-primary">月合計</TableCell>
                <TableCell className="sticky left-[200px] bg-muted/50 z-10 border-r" />
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
