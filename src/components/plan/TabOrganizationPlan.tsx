import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, fmtNum } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { cn } from "@/lib/utils";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

type StaffField = "fullTimeCount" | "partTimeCount" | "fullTimeHours" | "partTimeTotalHours";

const STAFF_ROWS: { label: string; field: StaffField; unit: string }[] = [
  { label: "正社員数", field: "fullTimeCount", unit: "名" },
  { label: "パート数", field: "partTimeCount", unit: "名" },
  { label: "正社員h/月", field: "fullTimeHours", unit: "h" },
  { label: "パート合計h/月", field: "partTimeTotalHours", unit: "h" },
];

export function TabOrganizationPlan({ months, settings, update }: Props) {
  const currentMonth = getCurrentMonth();
  const { unit } = useCurrencyUnit();
  const plan = settings.staffing_plan;

  const updateCell = (monthIdx: number, field: StaffField, value: number) => {
    const newPlan = [...plan];
    newPlan[monthIdx] = { ...newPlan[monthIdx], [field]: value };
    update("staffing_plan", newPlan);
  };

  // Productivity calculations
  const getMonthlyRevenue = (i: number): number => {
    if (settings.distribution_mode === "equal") return settings.annual_revenue_target / 12;
    return settings.monthly_revenue_distribution[i] || 0;
  };

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

  const fmtC = (v: number) => fmtNum(v, unit);

  // Compute totals for annual column
  const getAnnualTotal = (field: StaffField): number =>
    plan.reduce((s, row) => s + (row[field] || 0), 0);

  const getAnnualAvg = (field: StaffField): number =>
    plan.length > 0 ? getAnnualTotal(field) / plan.length : 0;

  return (
    <div className="space-y-8">
      {/* 人員計画 - 横向き */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="人員計画" description="月別の正社員・パート人数と労働時間を設定します" />
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs">項目</TableHead>
                {months.map((m, i) => (
                  <TableHead key={m} className={cn("text-center text-xs min-w-[80px]", m === currentMonth && "bg-primary/5")}>
                    {getMonthLabel(m)}
                  </TableHead>
                ))}
                <TableHead className="text-center text-xs min-w-[80px] bg-muted/50">年度平均</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAFF_ROWS.map((sr) => (
                <TableRow key={sr.field} className="hover:bg-muted/30">
                  <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">{sr.label}</TableCell>
                  {months.map((m, i) => (
                    <TableCell key={m} className={cn("p-1", m === currentMonth && "bg-primary/5")}>
                      <Input
                        type="number"
                        value={plan[i]?.[sr.field] ?? 0}
                        onChange={(e) => updateCell(i, sr.field, parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center w-[70px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-xs bg-muted/30 font-medium">
                    {getAnnualAvg(sr.field).toFixed(sr.field.includes("Count") ? 0 : 0)}{sr.unit}
                  </TableCell>
                </TableRow>
              ))}
              {/* Computed: Total hours */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">合計労働時間</TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const total = row ? row.fullTimeCount * row.fullTimeHours + row.partTimeTotalHours : 0;
                  return (
                    <TableCell key={m} className={cn("text-center text-xs font-medium", m === currentMonth && "bg-primary/5")}>
                      {total.toLocaleString()}h
                    </TableCell>
                  );
                })}
                <TableCell className="text-center text-xs bg-muted/30 font-bold">
                  {plan.reduce((s, row) => s + row.fullTimeCount * row.fullTimeHours + row.partTimeTotalHours, 0).toLocaleString()}h
                </TableCell>
              </TableRow>
              {/* Total headcount */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">合計人員</TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const total = row ? row.fullTimeCount + row.partTimeCount : 0;
                  return (
                    <TableCell key={m} className={cn("text-center text-xs font-medium", m === currentMonth && "bg-primary/5")}>
                      {total}名
                    </TableCell>
                  );
                })}
                <TableCell className="text-center text-xs bg-muted/30 font-medium">
                  {(plan.reduce((s, row) => s + row.fullTimeCount + row.partTimeCount, 0) / Math.max(plan.length, 1)).toFixed(1)}名
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 生産性計画 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="生産性計画" description="人員計画と売上目標から一人当たり生産性を自動計算します" />
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] text-xs">指標</TableHead>
                {months.map((m) => (
                  <TableHead key={m} className={cn("text-center text-xs min-w-[90px]", m === currentMonth && "bg-primary/5")}>
                    {getMonthLabel(m)}
                  </TableHead>
                ))}
                <TableHead className="text-center text-xs min-w-[90px] bg-muted/50">通期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 月次売上目標 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">月次売上目標</TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                    {fmtC(getMonthlyRevenue(i))}
                  </TableCell>
                ))}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">{fmtC(settings.annual_revenue_target)}</TableCell>
              </TableRow>

              {/* 一人当たり売上 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">一人当たり売上</TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const headcount = row ? row.fullTimeCount + row.partTimeCount : 0;
                  const rev = getMonthlyRevenue(i);
                  const perPerson = headcount > 0 ? rev / headcount : 0;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {perPerson > 0 ? fmtC(perPerson) : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {(() => {
                    const avgHc = plan.reduce((s, r) => s + r.fullTimeCount + r.partTimeCount, 0) / Math.max(plan.length, 1);
                    return avgHc > 0 ? fmtC(settings.annual_revenue_target / 12 / avgHc) : "—";
                  })()}
                </TableCell>
              </TableRow>

              {/* 粗利工数単価 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                  粗利工数単価（GPH）
                  <span className="block text-[9px] text-muted-foreground">目標: ¥{settings.gp_per_hour_target.toLocaleString()}</span>
                </TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const totalHours = row ? row.fullTimeCount * row.fullTimeHours + row.partTimeTotalHours : 0;
                  const rev = getMonthlyRevenue(i);
                  const gpRate = getWeightedGpRate(m);
                  const gp = rev * (gpRate / 100);
                  const gph = totalHours > 0 ? gp / totalHours : 0;
                  const isBelow = gph > 0 && gph < settings.gp_per_hour_target;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5", isBelow && "text-destructive")}>
                      {gph > 0 ? `¥${Math.round(gph).toLocaleString()}` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {(() => {
                    const totalHours = plan.reduce((s, r) => s + r.fullTimeCount * r.fullTimeHours + r.partTimeTotalHours, 0);
                    const totalGp = months.reduce((s, m, i) => {
                      const rev = getMonthlyRevenue(i);
                      return s + rev * (getWeightedGpRate(m) / 100);
                    }, 0);
                    return totalHours > 0 ? `¥${Math.round(totalGp / totalHours).toLocaleString()}` : "—";
                  })()}
                </TableCell>
              </TableRow>

              {/* 一人当たり粗利 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">一人当たり粗利/月</TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const headcount = row ? row.fullTimeCount + row.partTimeCount : 0;
                  const rev = getMonthlyRevenue(i);
                  const gpRate = getWeightedGpRate(m);
                  const gp = rev * (gpRate / 100);
                  const perPerson = headcount > 0 ? gp / headcount : 0;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {perPerson > 0 ? fmtC(perPerson) : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {(() => {
                    const avgHc = plan.reduce((s, r) => s + r.fullTimeCount + r.partTimeCount, 0) / Math.max(plan.length, 1);
                    const totalGp = months.reduce((s, m, i) => s + getMonthlyRevenue(i) * (getWeightedGpRate(m) / 100), 0);
                    return avgHc > 0 ? fmtC(totalGp / 12 / avgHc) : "—";
                  })()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
