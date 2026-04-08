import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings } from "./PlanTypes";
import { getMonthLabel } from "@/lib/fiscalYear";
import { cn } from "@/lib/utils";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabOrganizationPlan({ months, settings, update }: Props) {
  const sgaRatesSum = settings.recruitment_rate + settings.office_rate + settings.marketing_rate + settings.it_rate + settings.professional_rate + settings.other_rate;
  const sgaRatesValid = Math.abs(sgaRatesSum - 100) < 0.1;

  return (
    <div className="space-y-8">
      {/* 販管費配分 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="販管費配分率" description="粗利に対する各費目の配分比率を設定します（月次計画の自動計算に使用）" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <div>
            <label className="text-xs font-medium">人件費率 (対粗利%)<span className="text-destructive ml-0.5">*</span></label>
            <Input type="number" value={settings.personnel_cost_rate} onChange={(e) => update("personnel_cost_rate", parseFloat(e.target.value) || 0)} className="mt-1 focus-visible:ring-[hsl(217,91%,60%)]" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">残り販管費の配分 (合計100%): <span className={cn(sgaRatesValid ? "text-green-600" : "text-destructive", "font-semibold")}>{sgaRatesSum.toFixed(1)}%</span></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {([["recruitment_rate", "採用費"], ["office_rate", "オフィス費"], ["marketing_rate", "広告宣伝"], ["it_rate", "IT"], ["professional_rate", "専門家"], ["other_rate", "その他"]] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-medium">{label} (%)</label>
              <Input type="number" value={(settings as any)[key]} onChange={(e) => update(key, parseFloat(e.target.value) || 0)} className="mt-1 h-8 text-xs focus-visible:ring-[hsl(217,91%,60%)]" />
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
