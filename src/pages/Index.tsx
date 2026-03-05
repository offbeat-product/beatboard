import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { DashboardKpiCard } from "@/components/DashboardKpiCard";
import { KpiCardSkeleton, ChartSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { getMonthLabel } from "@/lib/fiscalYear";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const Index = () => {
  usePageTitle("ダッシュボード");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const d = useDashboardData();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const [logicOpen, setLogicOpen] = useState(false);

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2></div>
        </div>
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <ChartSkeleton />
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const hasData = d.monthlyTotals.some((m) => m.revenue > 0);
  const cumulativeRate = d.annualTarget > 0 ? (d.cumulativeRevenue / d.annualTarget) * 100 : 0;

  // Revenue + Gross Profit chart data
  const revenueChartData = d.monthlyTotals.map((m) => ({
    name: getMonthLabel(m.ym),
    売上: toDisplayValue(m.revenue),
    粗利: toDisplayValue(m.grossProfit),
    目標: toDisplayValue(m.target),
  }));

  const allRevChartValues = revenueChartData.flatMap((c) => [c.売上, c.粗利, c.目標]).filter(Boolean);
  const revMaxVal = Math.max(...allRevChartValues, 1);
  const revYMax = Math.ceil(revMaxVal * 1.2 / (10 ** Math.floor(Math.log10(revMaxVal)))) * (10 ** Math.floor(Math.log10(revMaxVal)));

  // GPH chart data (dual lines)
  const gphChartData = d.monthlyGPH.map((m) => ({
    name: getMonthLabel(m.ym),
    粗利工数単価: Math.round(m.gph),
    案件粗利工数単価: Math.round(m.projectGph),
  }));

  const gphMax = Math.max(...gphChartData.map((c) => Math.max(c.粗利工数単価, c.案件粗利工数単価)), d.targetGPH, d.targetProjectGPH, 1);
  const gphYMax = Math.ceil(gphMax * 1.2 / 1000) * 1000;

  const growthArrow = (val: number) => ({
    text: `${Math.abs(val).toFixed(1)}%`,
    direction: val >= 0 ? "up" as const : "down" as const,
    positive: val >= 0,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <div className="text-right">
          <p className="text-sm font-medium">2026年3月</p>
          <p className="text-xs text-muted-foreground">{d.fyLabel} 第{d.monthsElapsed}月</p>
        </div>
      </div>

      {/* Row 1: Revenue */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">売上</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の売上" value={formatAmount(d.prevRevenue)} delay={0} />
          <DashboardKpiCard label="今月の売上" value={formatAmount(d.currentRevenue)} target={formatAmount(d.currentTarget)} progress={d.currentTarget > 0 ? (d.currentRevenue / d.currentTarget) * 100 : undefined} delay={50} />
          <DashboardKpiCard label="前月比成長率" value={`${d.revenueMomChange >= 0 ? "+" : ""}${d.revenueMomChange.toFixed(1)}%`} change={growthArrow(d.revenueMomChange)} delay={100} />
          <DashboardKpiCard
            label={`累計売上（${d.fyLabel}）`}
            value={formatAmount(d.cumulativeRevenue)}
            target={formatAmount(d.annualTarget)}
            progress={cumulativeRate}
            subtext={`${d.monthsElapsed}/12ヶ月経過`}
            delay={150}
          />
        </div>
      </div>

      {/* Row 2: Gross Profit */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">粗利</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の粗利" value={formatAmount(d.prevGrossProfit)} delay={200} />
          <DashboardKpiCard label="今月の粗利" value={formatAmount(d.currentGrossProfit)} target={formatAmount(d.currentGrossProfitTarget)} progress={d.currentGrossProfitTarget > 0 ? (d.currentGrossProfit / d.currentGrossProfitTarget) * 100 : undefined} delay={250} />
          <DashboardKpiCard label="前月比成長率" value={`${d.grossProfitMomChange >= 0 ? "+" : ""}${d.grossProfitMomChange.toFixed(1)}%`} change={growthArrow(d.grossProfitMomChange)} delay={300} />
          <DashboardKpiCard label={`累計粗利（${d.fyLabel}）`} value={formatAmount(d.cumulativeGrossProfit)} target={formatAmount(d.annualGrossProfitTarget)} progress={d.annualGrossProfitTarget > 0 ? (d.cumulativeGrossProfit / d.annualGrossProfitTarget) * 100 : undefined} subtext={`${d.monthsElapsed}/12ヶ月経過`} delay={350} />
        </div>
      </div>

      {/* Row 3: GPH (Total Labor Hours) */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">粗利工数単価（総労働時間）</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の粗利工数単価" value={`¥${Math.round(d.prevGPH).toLocaleString()}`} delay={400} />
          <DashboardKpiCard label="今月の粗利工数単価" value={`¥${Math.round(d.currentGPH).toLocaleString()}`} target={`目標 ¥${d.targetGPH.toLocaleString()}`} progress={d.targetGPH > 0 ? (d.currentGPH / d.targetGPH) * 100 : undefined} delay={450} />
          <DashboardKpiCard label="前月比成長率" value={`${d.gphMomChange >= 0 ? "+" : ""}${d.gphMomChange.toFixed(1)}%`} change={growthArrow(d.gphMomChange)} delay={500} />
          <DashboardKpiCard label="通期平均粗利工数単価" value={`¥${Math.round(d.avgGPH).toLocaleString()}`} target={`目標 ¥${d.targetGPH.toLocaleString()}`} progress={d.targetGPH > 0 ? (d.avgGPH / d.targetGPH) * 100 : undefined} delay={550} />
        </div>
      </div>

      {/* Row 4: Project GPH (Project Hours) */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">案件粗利工数単価（案件工数）</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiCard label="前月の案件粗利工数単価" value={`¥${Math.round(d.prevProjectGPH).toLocaleString()}`} delay={600} />
          <DashboardKpiCard label="今月の案件粗利工数単価" value={`¥${Math.round(d.currentProjectGPH).toLocaleString()}`} target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`} progress={d.targetProjectGPH > 0 ? (d.currentProjectGPH / d.targetProjectGPH) * 100 : undefined} delay={650} />
          <DashboardKpiCard label="前月比成長率" value={`${d.projectGphMomChange >= 0 ? "+" : ""}${d.projectGphMomChange.toFixed(1)}%`} change={growthArrow(d.projectGphMomChange)} delay={700} />
          <DashboardKpiCard label="通期平均案件粗利工数単価" value={`¥${Math.round(d.avgProjectGPH).toLocaleString()}`} target={`目標 ¥${d.targetProjectGPH.toLocaleString()}`} progress={d.targetProjectGPH > 0 ? (d.avgProjectGPH / d.targetProjectGPH) * 100 : undefined} delay={750} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue + Gross Profit Chart */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-4">月次売上・粗利推移</h3>
          {!hasData ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, revYMax]}
                  tickFormatter={(v) => v.toLocaleString()}
                  label={{ value: unitSuffix, position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                  formatter={(value: number, name: string) => [`${value.toLocaleString()}${unitSuffix}`, name]}
                />
                <Bar dataKey="売上" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="粗利" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="目標" stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* GPH Chart (dual lines) */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <h3 className="text-sm font-semibold mb-4">粗利工数単価・案件粗利工数単価推移</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={gphChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, gphYMax]}
                tickFormatter={(v) => `¥${v.toLocaleString()}`}
                label={{ value: "円", position: "insideTopLeft", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, backgroundColor: "hsl(var(--card))" }}
                formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
              />
              <Legend fontSize={12} />
              <ReferenceLine y={d.targetGPH} stroke="hsl(var(--chart-4))" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標 ¥${d.targetGPH.toLocaleString()}`, position: "right", fontSize: 10, fill: "hsl(var(--chart-4))" }} />
              <ReferenceLine y={d.targetProjectGPH} stroke="hsl(var(--chart-2))" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標 ¥${d.targetProjectGPH.toLocaleString()}`, position: "right", fontSize: 10, fill: "hsl(var(--chart-2))" }} />
              <Line type="monotone" dataKey="粗利工数単価" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-4))" }} />
              <Line type="monotone" dataKey="案件粗利工数単価" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "hsl(var(--chart-2))" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts */}
      {d.alerts.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
          <h3 className="text-sm font-semibold mb-3">アラート</h3>
          <div className="flex flex-wrap gap-3">
            {d.alerts.map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.href)}
                className="text-left flex items-start gap-2 group hover:bg-secondary/50 rounded-md p-2 transition-colors border border-border"
              >
                <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${alert.type === "danger" ? "bg-chart-red" : "bg-chart-yellow"}`} />
                <span className="text-xs leading-relaxed text-foreground group-hover:text-primary transition-colors">{alert.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calculation Logic (collapsible) */}
      <Collapsible open={logicOpen} onOpenChange={setLogicOpen}>
        <div className="bg-card rounded-lg shadow-sm">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-lg">
            <h3 className="text-sm font-semibold">指標の計算ロジック</h3>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", logicOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p>・<strong>売上</strong> = monthly_salesテーブルのrevenue（Board計上日基準、受注確定+受注済）</p>
              <p>・<strong>粗利</strong> = 売上 - 案件原価 - 発注原価（Board計上データより）</p>
              <p>・<strong>粗利率</strong> = 粗利 ÷ 売上 × 100</p>
              <p>・<strong>粗利工数単価（総労働時間）</strong> = 月間粗利 ÷ 月間総労働時間（正社員×160h + パート時間合計）。目標¥21,552</p>
              <p>・<strong>案件単価（案件工数）</strong> = 月間粗利 ÷ 月間案件工数時間（総労働時間 - 社内業務時間）。目標¥25,000</p>
              <p>・<strong>社内業務時間</strong> = 正社員1人あたり40h/月 + パート1人あたり20h/月</p>
              <p>・<strong>前月比成長率</strong> = (当月値 - 前月値) ÷ 前月値 × 100</p>
              <p>・<strong>累計売上</strong> = 会計年度（5月〜当月）のrevenue合計</p>
              <p>・<strong>累計粗利</strong> = 会計年度（5月〜当月）のgross_profit合計</p>
              <p>・<strong>通期平均粗利工数単価</strong> = 会計年度（5月〜当月）の各月粗利工数単価の単純平均</p>
              <p>・<strong>通期平均案件単価</strong> = 会計年度（5月〜当月）の各月案件単価の単純平均</p>
              <p>・<strong>顧客集中度（上位1社）</strong> = 売上1位顧客の売上 ÷ 全顧客売上合計 × 100</p>
              <p>・<strong>顧客集中度（上位3社）</strong> = 売上上位3社合計 ÷ 全顧客売上合計 × 100</p>
              <p>・<strong>営業利益率</strong> = 営業利益 ÷ 売上 × 100（営業利益 = 粗利 - 販管費、販管費はfreee_monthly_plテーブルのsga_total）</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default Index;
