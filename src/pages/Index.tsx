import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { DashboardKpiCard } from "@/components/DashboardKpiCard";
import { KpiCardSkeleton, ChartSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";

const MONTH_LABELS: Record<string, string> = {
  "01": "1月", "02": "2月", "03": "3月", "04": "4月", "05": "5月", "06": "6月",
  "07": "7月", "08": "8月", "09": "9月", "10": "10月", "11": "11月", "12": "12月",
};

function formatMan(v: number) {
  return `¥${Math.round(v / 10000).toLocaleString()}万`;
}

const Index = () => {
  usePageTitle("ダッシュボード");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const d = useDashboardData();

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2></div>
        </div>
        <KpiCardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-4"><ChartSkeleton /></div>
          <div className="lg:col-span-1"><ChartSkeleton height={200} /></div>
        </div>
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const chartData = d.monthlyTotals.map((m) => ({
    name: MONTH_LABELS[m.ym.slice(5)] ?? m.ym,
    売上実績: Math.round(m.revenue / 10000),
    目標: Math.round(m.target / 10000),
  }));

  const hasData = d.monthlyTotals.some((m) => m.revenue > 0);
  const achievementRate = d.currentTarget > 0 ? (d.currentRevenue / d.currentTarget) * 100 : 0;
  const cumulativeRate = d.annualTarget > 0 ? (d.cumulativeRevenue / d.annualTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">2026年3月</p>
          <p className="text-xs text-muted-foreground">データ更新: 2026/03/03 08:00</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="今月の売上"
          value={formatMan(d.currentRevenue)}
          target={formatMan(d.currentTarget)}
          progress={achievementRate}
          change={{
            text: `${Math.abs(d.momChange).toFixed(1)}%`,
            direction: d.momChange >= 0 ? "up" : "down",
            positive: d.momChange >= 0,
          }}
          delay={0}
        />
        <DashboardKpiCard
          label="累計売上（2025年度）"
          value={formatMan(d.cumulativeRevenue)}
          target={formatMan(d.annualTarget)}
          progress={cumulativeRate}
          subtext={`${d.monthsElapsed}/12ヶ月経過`}
          delay={100}
        />
        <DashboardKpiCard
          label="粗利率"
          value={`${d.grossMarginRate.toFixed(1)}%`}
          target={`目標 ${d.targetGrossMargin.toFixed(1)}%`}
          change={{
            text: `${Math.abs(d.marginChange).toFixed(1)}pt`,
            direction: d.marginChange >= 0 ? "up" : "down",
            positive: d.marginChange >= 0,
          }}
          delay={200}
        />
        <DashboardKpiCard
          label="粗利工数単価"
          value={`¥${Math.round(d.grossProfitPerHour).toLocaleString()}`}
          target={`目標 ¥${d.targetGPH.toLocaleString()}`}
          change={{
            text: `¥${Math.abs(Math.round(d.gphChange)).toLocaleString()}`,
            direction: d.gphChange >= 0 ? "up" : "down",
            positive: d.gphChange >= 0,
          }}
          delay={300}
        />
      </div>

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-4 bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-4">月次売上推移</h3>
          {!hasData ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 12000]}
                  ticks={[0, 2000, 4000, 6000, 8000, 10000]}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(220, 13%, 91%)", fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    `¥${value.toLocaleString()}万`,
                    name,
                  ]}
                />
                <Bar
                  dataKey="売上実績"
                  fill="hsl(14, 78%, 54%)"
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="目標"
                  stroke="#9CA3AF"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alerts */}
        <div className="lg:col-span-1 bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <h3 className="text-sm font-semibold mb-4">アラート</h3>
          <div className="space-y-3">
            {d.alerts.length === 0 && (
              <p className="text-xs text-muted-foreground">アラートはありません</p>
            )}
            {d.alerts.map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.href)}
                className="w-full text-left flex items-start gap-2 group hover:bg-secondary/50 rounded-sm p-2 -mx-2 transition-colors"
              >
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                    alert.type === "danger" ? "bg-chart-red" : "bg-chart-yellow"
                  }`}
                />
                <span className="text-xs leading-relaxed text-foreground group-hover:text-primary transition-colors">
                  {alert.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
