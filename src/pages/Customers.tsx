import { useState, useMemo } from "react";
import { useCustomersData } from "@/hooks/useCustomersData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { ArrowUpDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type SortKey = "name" | "pct" | "revenue" | "status";

const Customers = () => {
  usePageTitle("顧客分析");
  const d = useCustomersData();
  const queryClient = useQueryClient();
  const { formatAmount, toDisplayValue, unitSuffix } = useCurrencyUnit();
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const list = [...d.clientTable];
    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? "";
      let vb: string | number = b[sortKey] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [d.clientTable, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">顧客分析</h2>
        <KpiCardSkeleton count={2} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
        </div>
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (d.isError) {
    return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;
  }

  const hasData = d.clientTable.length > 0;
  const isTop1Over = d.top1Pct > d.targetTop1;
  const isTop3Over = d.top3Pct > d.targetTop3;

  // Pie data with display values
  const pieDisplayData = d.pieData.map((p) => ({
    ...p,
    displayValue: toDisplayValue(p.value),
  }));

  // Stacked bar data with display values
  const barDisplayData = d.monthlyByClient.map((entry) => {
    const converted: Record<string, number | string> = { name: entry.name };
    d.clientNames.forEach((n) => {
      converted[n] = toDisplayValue((entry[n] as number) ?? 0);
    });
    converted["top1"] = entry["top1"];
    converted["top3"] = entry["top3"];
    return converted;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">顧客分析</h2>

      {/* Concentration KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConcentrationCard label="上位1社集中度" value={d.top1Pct} target={d.targetTop1} isOver={isTop1Over} targetLabel={`目標 ${d.targetTop1}%以下`} />
        <ConcentrationCard label="上位3社集中度" value={d.top3Pct} target={d.targetTop3} isOver={isTop3Over} targetLabel={`目標 ${d.targetTop3}%以下`} />
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
              <h3 className="text-sm font-semibold mb-4">顧客別売上構成（{d.latestMonth}）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieDisplayData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="displayValue" paddingAngle={2} label={({ name, pct }) => `${name} ${pct.toFixed(1)}%`} labelLine={false} fontSize={11}>
                    {pieDisplayData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()}${unitSuffix}`, "売上"]} />
                  <text x="50%" y="48%" textAnchor="middle" className="fill-muted-foreground text-xs">売上合計</text>
                  <text x="50%" y="56%" textAnchor="middle" className="fill-foreground text-sm font-semibold">{formatAmount(d.totalCurrentRevenue)}</text>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <h3 className="text-sm font-semibold mb-4">顧客集中度推移</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={d.monthlyByClient}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`]} />
                  <ReferenceLine y={d.targetTop1} stroke="#9CA3AF" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標${d.targetTop1}%`, position: "right", fontSize: 10, fill: "#9CA3AF" }} />
                  <ReferenceLine y={d.targetTop3} stroke="#9CA3AF" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `目標${d.targetTop3}%`, position: "right", fontSize: 10, fill: "#9CA3AF" }} />
                  <Line type="monotone" dataKey="top1" name="上位1社" stroke="#E85B2D" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="top3" name="上位3社" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <h3 className="text-sm font-semibold mb-4">顧客別月次売上推移</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barDisplayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} label={{ value: unitSuffix, position: "insideTopLeft", offset: -5, fontSize: 11, fill: "#9CA3AF" }} />
                <Tooltip formatter={(v: number, name: string) => [`${v.toLocaleString()}${unitSuffix}`, name]} />
                <Legend />
                {d.clientNames.map((name) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={d.clientColors[name]} radius={0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Client Table */}
          <div className="bg-card rounded-lg shadow-sm animate-fade-in overflow-x-auto" style={{ animationDelay: "300ms" }}>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <SortableHead label="顧客名" sortKey="name" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortableHead label="売上" sortKey="revenue" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                  <SortableHead label="構成比" sortKey="pct" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                  <SortableHead label="ステータス" sortKey="status" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right font-mono-num">{formatAmount(c.revenue)}</TableCell>
                    <TableCell className="text-right font-mono-num">{c.pct.toFixed(1)}%</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${c.status === "active" ? "text-chart-green" : "text-muted-foreground"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-chart-green" : "bg-muted-foreground"}`} />
                        {c.status === "active" ? "契約中" : c.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Sub-components ── */
function ConcentrationCard({ label, value, target, isOver, targetLabel }: {
  label: string; value: number; target: number; isOver: boolean; targetLabel: string;
}) {
  return (
    <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold font-mono-num ${isOver ? "text-destructive" : "text-chart-green"}`}>{value.toFixed(1)}%</span>
        <span className="text-xs text-muted-foreground">{targetLabel}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-chart-green" style={{ left: `${target}%` }} />
      </div>
    </div>
  );
}

function SortableHead({ label, sortKey, current, asc, onSort, className = "" }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void; className?: string;
}) {
  return (
    <TableHead className={className}>
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${current === sortKey ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );
}

export default Customers;
