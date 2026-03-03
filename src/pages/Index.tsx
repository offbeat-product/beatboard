import { TrendingUp, Users, DollarSign, Zap } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const monthlyRevenue = [
  { name: "7月", 売上: 4200, 粗利: 1800 },
  { name: "8月", 売上: 3800, 粗利: 1600 },
  { name: "9月", 売上: 5100, 粗利: 2300 },
  { name: "10月", 売上: 4700, 粗利: 2000 },
  { name: "11月", 売上: 5500, 粗利: 2500 },
  { name: "12月", 売上: 6200, 粗利: 2900 },
];

const customerMix = [
  { name: "映像制作", value: 40 },
  { name: "Web制作", value: 30 },
  { name: "グラフィック", value: 20 },
  { name: "その他", value: 10 },
];

const productivityTrend = [
  { name: "7月", 一人当たり売上: 140 },
  { name: "8月", 一人当たり売上: 127 },
  { name: "9月", 一人当たり売上: 170 },
  { name: "10月", 一人当たり売上: 157 },
  { name: "11月", 一人当たり売上: 183 },
  { name: "12月", 一人当たり売上: 207 },
];

const CHART_COLORS = [
  "hsl(14, 78%, 54%)",
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
];

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground text-sm mt-1">経営指標の概要</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="月間売上"
          value="¥6,200万"
          change="+12.7% 前月比"
          changeType="positive"
          icon={DollarSign}
          delay={0}
        />
        <KpiCard
          title="粗利率"
          value="46.8%"
          change="+2.1pt 前月比"
          changeType="positive"
          icon={TrendingUp}
          delay={100}
        />
        <KpiCard
          title="アクティブ顧客"
          value="24社"
          change="+3 新規"
          changeType="positive"
          icon={Users}
          delay={200}
        />
        <KpiCard
          title="一人当たり売上"
          value="¥207万"
          change="+13.1% 前月比"
          changeType="positive"
          icon={Zap}
          delay={300}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-4">月別売上・粗利推移</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/100}億`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220, 13%, 91%)", fontSize: 12 }}
                formatter={(value: number) => [`¥${value}万`, undefined]}
              />
              <Bar dataKey="売上" fill="hsl(14, 78%, 54%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="粗利" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Mix */}
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <h3 className="text-sm font-semibold mb-4">顧客構成</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={customerMix}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={11}
              >
                {customerMix.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value}%`, undefined]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Productivity */}
        <div className="bg-card rounded-lg shadow-sm p-5 lg:col-span-2 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h3 className="text-sm font-semibold mb-4">生産性推移（一人当たり売上）</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={productivityTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `¥${v}万`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220, 13%, 91%)", fontSize: 12 }}
                formatter={(value: number) => [`¥${value}万`, undefined]}
              />
              <Line
                type="monotone"
                dataKey="一人当たり売上"
                stroke="hsl(160, 84%, 39%)"
                strokeWidth={2}
                dot={{ fill: "hsl(160, 84%, 39%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Index;
