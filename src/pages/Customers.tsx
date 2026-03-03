import { Users } from "lucide-react";

const customers = [
  { name: "株式会社アルファ", category: "映像制作", revenue: 1200, projects: 8 },
  { name: "ベータ株式会社", category: "Web制作", revenue: 980, projects: 12 },
  { name: "ガンマデザイン", category: "グラフィック", revenue: 750, projects: 6 },
  { name: "デルタメディア", category: "映像制作", revenue: 680, projects: 4 },
  { name: "イプシロン Inc.", category: "Web制作", revenue: 520, projects: 9 },
];

const Customers = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">顧客分析</h2>
      <p className="text-muted-foreground text-sm mt-1">顧客別の売上・案件数</p>
    </div>

    <div className="bg-card rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary">
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">顧客名</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">カテゴリ</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">売上（万円）</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">案件数</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
              <td className="px-5 py-3.5 text-sm font-medium">{c.name}</td>
              <td className="px-5 py-3.5 text-sm">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                  {c.category}
                </span>
              </td>
              <td className="px-5 py-3.5 text-sm font-mono-num text-right">¥{c.revenue.toLocaleString()}</td>
              <td className="px-5 py-3.5 text-sm font-mono-num text-right">{c.projects}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default Customers;
