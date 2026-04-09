import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeading } from "./SectionHeading";
import { PlanSettings, StaffingRow, fmtNum } from "./PlanTypes";
import { getMonthLabel, getCurrentMonth } from "@/lib/fiscalYear";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { cn } from "@/lib/utils";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

type StaffField = "fullTimeCount" | "partTimeCount" | "fullTimeHours" | "partTimeTotalHours" | "fullTimeLaborCost" | "partTimeLaborCost";

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

  const getAnnualAvg = (field: StaffField): number =>
    plan.length > 0 ? plan.reduce((s, row) => s + ((row as any)[field] || 0), 0) / plan.length : 0;

  const getTotalHours = (i: number): number => {
    const row = plan[i];
    return row ? row.fullTimeCount * row.fullTimeHours + row.partTimeTotalHours : 0;
  };

  const getProjectHours = (i: number): number => {
    return Math.round(getTotalHours(i) * 0.75);
  };

  return (
    <div className="space-y-8">
      {/* 人員計画 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="人員計画" description="月別の正社員・パート人数と労働時間を設定します" />
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs">項目</TableHead>
                {months.map((m) => (
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
                        value={(plan[i] as any)?.[sr.field] ?? 0}
                        onChange={(e) => updateCell(i, sr.field, parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center w-[70px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-xs bg-muted/30 font-medium">
                    {getAnnualAvg(sr.field).toFixed(0)}{sr.unit}
                  </TableCell>
                </TableRow>
              ))}
              {/* Computed: Total hours */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">合計労働時間</TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("text-center text-xs font-medium", m === currentMonth && "bg-primary/5")}>
                    {getTotalHours(i).toLocaleString()}h
                  </TableCell>
                ))}
                <TableCell className="text-center text-xs bg-muted/30 font-bold">
                  {months.reduce((s, _, i) => s + getTotalHours(i), 0).toLocaleString()}h
                </TableCell>
              </TableRow>
              {/* Computed: Project hours (80% of total) */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">
                  案件工数
                  <span className="block text-[9px] text-muted-foreground">合計労働時間の75%</span>
                </TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("text-center text-xs font-medium", m === currentMonth && "bg-primary/5")}>
                    {getProjectHours(i).toLocaleString()}h
                  </TableCell>
                ))}
                <TableCell className="text-center text-xs bg-muted/30 font-bold">
                  {months.reduce((s, _, i) => s + getProjectHours(i), 0).toLocaleString()}h
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
        <SectionHeading title="生産性計画" description="人員計画と売上目標から生産性指標を自動計算します" />
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px] text-xs">指標</TableHead>
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

              {/* 月次粗利目標 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">月次粗利目標</TableCell>
                {months.map((m, i) => {
                  const rev = getMonthlyRevenue(i);
                  const gpRate = getWeightedGpRate(m);
                  const gp = rev * (gpRate / 100);
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {fmtC(gp)}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {fmtC(months.reduce((s, m, i) => s + getMonthlyRevenue(i) * (getWeightedGpRate(m) / 100), 0))}
                </TableCell>
              </TableRow>

              {/* 総労働工数 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">総労働工数</TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                    {getTotalHours(i) > 0 ? `${getTotalHours(i).toLocaleString()}h` : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {months.reduce((s, _, i) => s + getTotalHours(i), 0).toLocaleString()}h
                </TableCell>
              </TableRow>

              {/* 粗利工数単価（粗利÷総労働工数） */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                  粗利工数単価（GPH）
                  <span className="block text-[9px] text-muted-foreground">粗利÷総労働工数 / 目標: ¥{settings.gp_per_hour_target.toLocaleString()}</span>
                </TableCell>
                {months.map((m, i) => {
                  const totalHours = getTotalHours(i);
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
                    const totalHours = months.reduce((s, _, i) => s + getTotalHours(i), 0);
                    const totalGp = months.reduce((s, m, i) => s + getMonthlyRevenue(i) * (getWeightedGpRate(m) / 100), 0);
                    return totalHours > 0 ? `¥${Math.round(totalGp / totalHours).toLocaleString()}` : "—";
                  })()}
                </TableCell>
              </TableRow>

              {/* 案件工数 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">案件工数</TableCell>
                {months.map((m, i) => {
                  const ph = getProjectHours(i);
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {ph > 0 ? `${ph.toLocaleString()}h` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {months.reduce((s, _, i) => s + getProjectHours(i), 0).toLocaleString()}h
                </TableCell>
              </TableRow>

              {/* 案件粗利工数単価（粗利÷案件工数） */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                  案件粗利工数単価
                  <span className="block text-[9px] text-muted-foreground">粗利÷案件工数 / 目標: ¥{settings.gp_per_project_hour_target.toLocaleString()}</span>
                </TableCell>
                {months.map((m, i) => {
                  const ph = getProjectHours(i);
                  const rev = getMonthlyRevenue(i);
                  const gpRate = getWeightedGpRate(m);
                  const gp = rev * (gpRate / 100);
                  const gpph = ph > 0 ? gp / ph : 0;
                  const isBelow = gpph > 0 && gpph < settings.gp_per_project_hour_target;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5", isBelow && "text-destructive")}>
                      {gpph > 0 ? `¥${Math.round(gpph).toLocaleString()}` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {(() => {
                    const totalPh = months.reduce((s, _, i) => s + getProjectHours(i), 0);
                    const totalGp = months.reduce((s, m, i) => s + getMonthlyRevenue(i) * (getWeightedGpRate(m) / 100), 0);
                    return totalPh > 0 ? `¥${Math.round(totalGp / totalPh).toLocaleString()}` : "—";
                  })()}
                </TableCell>
              </TableRow>

              {/* 案件稼働率 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                  案件稼働率
                  <span className="block text-[9px] text-muted-foreground">案件工数÷総労働工数</span>
                </TableCell>
                {months.map((m, i) => {
                  const totalH = getTotalHours(i);
                  const projH = getProjectHours(i);
                  const rate = totalH > 0 ? (projH / totalH) * 100 : 0;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {totalH > 0 ? `${rate.toFixed(1)}%` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {(() => {
                    const totalH = months.reduce((s, _, i) => s + getTotalHours(i), 0);
                    const totalP = months.reduce((s, _, i) => s + getProjectHours(i), 0);
                    return totalH > 0 ? `${((totalP / totalH) * 100).toFixed(1)}%` : "—";
                  })()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
      {/* 人件費計画 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="人件費計画" description="<SectionHeading title="人件費計画" description="人件費予算は販管費予算の30%で設定（役員除外）" />" />
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px] text-xs">項目</TableHead>
                {months.map((m) => (
                  <TableHead key={m} className={cn("text-center text-xs min-w-[90px]", m === currentMonth && "bg-primary/5")}>
                    {getMonthLabel(m)}
                  </TableHead>
                ))}
                <TableHead className="text-center text-xs min-w-[90px] bg-muted/50">通期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 人件費予算（販管費の30%） */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                  人件費予算
                  <span className="block text-[9px] text-muted-foreground">販管費予算の30%</span>
                </TableCell>
                {months.map((m, i) => {
                  const rev = getMonthlyRevenue(i);
                  const gpRate = getWeightedGpRate(m);
                  const gp = rev * (gpRate / 100);
                  const op = rev * (settings.operating_profit_rate / 100);
                  const sga = gp - op;
                  const budget = sga * 0.3;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs", m === currentMonth && "bg-primary/5")}>
                      {fmtC(budget)}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {fmtC(months.reduce((s, m, i) => {
                    const rev = getMonthlyRevenue(i);
                    const gp = rev * (getWeightedGpRate(m) / 100);
                    const op = rev * (settings.operating_profit_rate / 100);
                    return s + (gp - op) * 0.3;
                  }, 0))}
                </TableCell>
              </TableRow>

              {/* 正社員人件費 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">正社員人件費</TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("p-1", m === currentMonth && "bg-primary/5")}>
                    <Input
                      type="number"
                      value={(plan[i] as any)?.fullTimeLaborCost ?? 0}
                      onChange={(e) => updateCell(i, "fullTimeLaborCost", parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs text-center w-[80px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                    />
                  </TableCell>
                ))}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {fmtC(plan.reduce((s, row) => s + (row.fullTimeLaborCost || 0), 0))}
                </TableCell>
              </TableRow>

              {/* パート人件費 */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">パート人件費</TableCell>
                {months.map((m, i) => (
                  <TableCell key={m} className={cn("p-1", m === currentMonth && "bg-primary/5")}>
                    <Input
                      type="number"
                      value={(plan[i] as any)?.partTimeLaborCost ?? 0}
                      onChange={(e) => updateCell(i, "partTimeLaborCost", parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs text-center w-[80px] mx-auto focus-visible:ring-[hsl(217,91%,60%)]"
                    />
                  </TableCell>
                ))}
                <TableCell className="text-right text-xs bg-muted/30 font-medium">
                  {fmtC(plan.reduce((s, row) => s + (row.partTimeLaborCost || 0), 0))}
                </TableCell>
              </TableRow>

              {/* 人件費合計 */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">人件費合計</TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const total = row ? (row.fullTimeLaborCost || 0) + (row.partTimeLaborCost || 0) : 0;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs font-medium", m === currentMonth && "bg-primary/5")}>
                      {fmtC(total)}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-bold">
                  {fmtC(plan.reduce((s, row) => s + (row.fullTimeLaborCost || 0) + (row.partTimeLaborCost || 0), 0))}
                </TableCell>
              </TableRow>

              {/* 人件費率 */}
              <TableRow className="bg-muted/20">
                <TableCell className="sticky left-0 bg-muted/20 z-10 text-xs font-medium">
                  人件費率
                  <span className="block text-[9px] text-muted-foreground">人件費合計÷販管費予算</span>
                </TableCell>
                {months.map((m, i) => {
                  const row = plan[i];
                  const laborTotal = row ? (row.fullTimeLaborCost || 0) + (row.partTimeLaborCost || 0) : 0;
                  const rev = getMonthlyRevenue(i);
                  const gp = rev * (getWeightedGpRate(m) / 100);
                  const op = rev * (settings.operating_profit_rate / 100);
                  const sga = gp - op;
                  const rate = sga > 0 ? (laborTotal / sga) * 100 : 0;
                  const isOver = rate > 30;
                  return (
                    <TableCell key={m} className={cn("text-right text-xs font-medium", m === currentMonth && "bg-primary/5", isOver && "text-destructive")}>
                      {laborTotal > 0 ? `${rate.toFixed(1)}%` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-xs bg-muted/30 font-bold">
                  {(() => {
                    const totalLabor = plan.reduce((s, row) => s + (row.fullTimeLaborCost || 0) + (row.partTimeLaborCost || 0), 0);
                    const totalSga = months.reduce((s, m, i) => {
                      const rev = getMonthlyRevenue(i);
                      const gp = rev * (getWeightedGpRate(m) / 100);
                      const op = rev * (settings.operating_profit_rate / 100);
                      return s + (gp - op);
                    }, 0);
                    return totalSga > 0 ? `${((totalLabor / totalSga) * 100).toFixed(1)}%` : "—";
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
