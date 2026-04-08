import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings } from "./PlanTypes";
import { getMonthLabel } from "@/lib/fiscalYear";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabOrganizationPlan({ months, settings, update }: Props) {
  return (
    <div className="space-y-8">
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
