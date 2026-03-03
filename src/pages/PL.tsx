import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const plData = [
  { name: "7月", 売上: 4200, 原価: 2300, 販管費: 1200 },
  { name: "8月", 売上: 3800, 原価: 2100, 販管費: 1100 },
  { name: "9月", 売上: 5100, 原価: 2700, 販管費: 1300 },
  { name: "10月", 売上: 4700, 原価: 2500, 販管費: 1200 },
  { name: "11月", 売上: 5500, 原価: 2800, 販管費: 1400 },
  { name: "12月", 売上: 6200, 原価: 3100, 販管費: 1500 },
];

const metrics = [
  { label: "売上高", value: "¥6,200万", sub: "前月比 +12.7%" },
  { label: "売上原価", value: "¥3,100万", sub: "原価率 50.0%" },
  { label: "粗利", value: "¥3,100万", sub: "粗利率 50.0%" },
  { label: "販管費", value: "¥1,500万", sub: "販管費率 24.2%" },
  { label: "営業利益", value: "¥1,600万", sub: "営業利益率 25.8%" },
];

const PL = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">損益・生産性</h2>
      <p className="text-muted-foreground text-sm mt-1">損益計算書と生産性指標</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {metrics.map((m, i) => (
        <div key={i} className="bg-card rounded-lg shadow-sm p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
          <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
          <p className="text-lg font-bold font-mono-num">{m.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
        </div>
      ))}
    </div>

    <div className="bg-card rounded-lg shadow-sm p-5">
      <h3 className="text-sm font-semibold mb-4">月別損益推移</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={plData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/100}億`} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(220, 13%, 91%)", fontSize: 12 }}
            formatter={(value: number) => [`¥${value}万`, undefined]}
          />
          <Bar dataKey="売上" fill="hsl(14, 78%, 54%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="原価" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="販管費" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default PL;
