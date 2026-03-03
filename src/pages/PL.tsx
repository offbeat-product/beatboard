import { usePLData } from "@/hooks/usePLData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (v: number) => `¥${(v / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const PL = () => {
  usePageTitle("損益・生産性");
  const queryClient = useQueryClient();
  const {
    isLoading, isError, currentData, targetGrossMargin, targetGPH,
    opMarginChange, grossMarginChange, gphChange,
    chartData, gphChartData, monthlyPL, totals,
  } = usePLData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">損益・生産性</h2>
        <KpiCardSkeleton count={3} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3"><ChartSkeleton /></div>
          <div className="lg:col-span-2"><ChartSkeleton /></div>
        </div>
        <TableSkeleton cols={8} />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const hasData = monthlyPL.some((m) => m.revenue > 0);
  const opMarginRate = currentData?.operatingMarginRate ?? 0;
  const grossMarginRate = currentData?.grossMarginRate ?? 0;
  const gph = currentData?.gph ?? 0;

  const kpis = [
    { label: "営業利益率", value: fmtPct(opMarginRate), change: opMarginChange, changeLabel: `${opMarginChange >= 0 ? "▲" : "▼"} ${Math.abs(opMarginChange).toFixed(1)}pt` },
    { label: "粗利率", value: fmtPct(grossMarginRate), target: `目標 ${fmtPct(targetGrossMargin)}`, change: grossMarginChange, changeLabel: `${grossMarginChange >= 0 ? "▲" : "▼"} ${Math.abs(grossMarginChange).toFixed(1)}pt` },
    { label: "粗利工数単価", value: `¥${Math.round(gph).toLocaleString()}`, target: `目標 ¥${targetGPH.toLocaleString()}`, change: gphChange, changeLabel: `${gphChange >= 0 ? "▲" : "▼"} ¥${Math.abs(Math.round(gphChange)).toLocaleString()}` },
  ];

  const gphAreaData = gphChartData.map(d => ({
    ...d,
    above: d.粗利工数単価 >= d.目標 ? d.粗利工数単価 : d.目標,
    below: d.粗利工数単価 < d.目標 ? d.粗利工数単価 : d.目標,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">損益・生産性</h2>
        <p className="text-muted-foreground text-sm mt-1">損益計算書と生産性指標</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold font-mono-num">{k.value}</p>
            <div className="flex items-center gap-2 mt-1">
              {k.target && <span className="text-xs text-muted-foreground">{k.target}</span>}
              <span className={`text-xs font-medium flex items-center gap-0.5 ${k.change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {k.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.changeLabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-card rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4">月次損益推移</h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}万`} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="売上原価" stackId="a" fill="#E5E7EB" />
                  <Bar yAxisId="left" dataKey="販管費" stackId="a" fill="#9CA3AF" />
                  <Bar yAxisId="left" dataKey="営業利益" stackId="a" fill="#E85B2D" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="粗利率" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-2 bg-card rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4">粗利工数単価推移</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={gphAreaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                  <ReferenceLine y={targetGPH} stroke="#10B981" strokeDasharray="6 3" strokeWidth={2} label={{ value: `目標 ¥${targetGPH.toLocaleString()}`, position: "right", fontSize: 11, fill: "#10B981" }} />
                  <defs>
                    <linearGradient id="gphGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#10B981" stopOpacity={0.05} />
                      <stop offset="50%" stopColor="#EF4444" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="粗利工数単価" stroke="#E85B2D" strokeWidth={2} fill="url(#gphGrad)" dot={{ r: 3, fill: "#E85B2D" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly PL Table */}
          <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-4">月次損益テーブル</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>年月</TableHead>
                  <TableHead className="text-right">売上</TableHead>
                  <TableHead className="text-right">売上原価</TableHead>
                  <TableHead className="text-right">粗利</TableHead>
                  <TableHead className="text-right">粗利率</TableHead>
                  <TableHead className="text-right">販管費</TableHead>
                  <TableHead className="text-right">営業利益</TableHead>
                  <TableHead className="text-right">営業利益率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyPL.map(m => {
                  const negOP = m.operatingProfit < 0;
                  const lowGM = m.grossMarginRate <= 60;
                  return (
                    <TableRow key={m.ym} className={negOP ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmt(m.revenue)}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmt(m.cost)}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmt(m.grossProfit)}</TableCell>
                      <TableCell className={`text-right font-mono-num ${lowGM ? "text-destructive font-semibold" : ""}`}>{fmtPct(m.grossMarginRate)}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmt(m.sga)}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmt(m.operatingProfit)}</TableCell>
                      <TableCell className="text-right font-mono-num">{fmtPct(m.operatingMarginRate)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell>合計</TableCell>
                  <TableCell className="text-right font-mono-num">{fmt(totals.revenue)}</TableCell>
                  <TableCell className="text-right font-mono-num">{fmt(totals.cost)}</TableCell>
                  <TableCell className="text-right font-mono-num">{fmt(totals.grossProfit)}</TableCell>
                  <TableCell className="text-right font-mono-num">{totals.revenue > 0 ? fmtPct((totals.grossProfit / totals.revenue) * 100) : "—"}</TableCell>
                  <TableCell className="text-right font-mono-num">{fmt(totals.sga)}</TableCell>
                  <TableCell className="text-right font-mono-num">{fmt(totals.operatingProfit)}</TableCell>
                  <TableCell className="text-right font-mono-num">{totals.revenue > 0 ? fmtPct((totals.operatingProfit / totals.revenue) * 100) : "—"}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default PL;
