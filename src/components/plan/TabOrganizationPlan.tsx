import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, DEFAULT_SGA_CATEGORIES } from "./PlanTypes";
import { getMonthLabel } from "@/lib/fiscalYear";
import { cn } from "@/lib/utils";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabOrganizationPlan({ months, settings, update }: Props) {
  const categories = settings.sga_categories.length > 0 ? settings.sga_categories : DEFAULT_SGA_CATEGORIES;
  const ratesSum = categories.reduce((s, cat) => s + (settings.sga_allocation_rates?.[cat.id] ?? 0), 0);
  const ratesValid = Math.abs(ratesSum - 100) < 0.1;

  const updateRate = (catId: string, rate: number) => {
    const next = { ...settings.sga_allocation_rates, [catId]: rate };
    update("sga_allocation_rates", next);
  };

  return (
    <div className="space-y-8">
      {/* 販管費配分 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="販管費配分率" description="販管費合計に対する各カテゴリの配分比率を設定します（販管費計画タブのカテゴリと連動）" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <div>
            <label className="text-xs font-medium">人件費率 (対粗利%)<span className="text-destructive ml-0.5">*</span></label>
            <Input type="number" value={settings.personnel_cost_rate} onChange={(e) => update("personnel_cost_rate", parseFloat(e.target.value) || 0)} className="mt-1 focus-visible:ring-[hsl(217,91%,60%)]" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          販管費カテゴリ配分 (合計100%): <span className={cn(ratesValid ? "text-green-600" : "text-destructive", "font-semibold")}>{ratesSum.toFixed(1)}%</span>
          {!ratesValid && <span className="text-destructive ml-1 text-[10px]">（販管費計画タブでカテゴリを追加・調整してください）</span>}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <div key={cat.id}>
              <label className="text-xs font-medium truncate block">{cat.name} (%)</label>
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

      {/* 人員計画 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="人員計画" description="月別の正社員・パート人数と労働時間を設定します" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 text-xs">月</TableHead>
                <TableHead className="text-xs text-center">正社員数</TableHead>
                <TableHead className="text-xs text-center">パート数</TableHead>
                <TableHead className="text-xs text-center">正社員h/月</TableHead>
                <TableHead className="text-xs text-center">パート合計h/月</TableHead>
                <TableHead className="text-xs text-center bg-muted/50">合計h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.staffing_plan.map((row, i) => {
                const totalH = row.fullTimeCount * row.fullTimeHours + row.partTimeTotalHours;
                return (
                  <TableRow key={row.month} className="hover:bg-muted/30">
                    <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">{getMonthLabel(row.month)}</TableCell>
                    {(["fullTimeCount", "partTimeCount", "fullTimeHours", "partTimeTotalHours"] as const).map((f) => (
                      <TableCell key={f} className="p-1">
                        <Input
                          type="number"
                          value={row[f]}
                          onChange={(e) => {
                            const newPlan = [...settings.staffing_plan];
                            newPlan[i] = { ...newPlan[i], [f]: parseFloat(e.target.value) || 0 };
                            update("staffing_plan", newPlan);
                          }}
                          className="h-7 text-xs text-center w-20 mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-xs bg-muted/30 font-medium">{totalH.toLocaleString()}h</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
