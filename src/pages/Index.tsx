import { TrendingUp, Users, DollarSign, Zap } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { BarChart3 } from "lucide-react";

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground text-sm mt-1">経営指標の概要</p>
      </div>

      {/* KPI Cards - empty state */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="月間売上" value="—" icon={DollarSign} delay={0} />
        <KpiCard title="粗利率" value="—" icon={TrendingUp} delay={100} />
        <KpiCard title="アクティブ顧客" value="—" icon={Users} delay={200} />
        <KpiCard title="一人当たり売上" value="—" icon={Zap} delay={300} />
      </div>

      {/* Charts - empty state */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EmptyChart title="月別売上・粗利推移" delay={200} />
        <EmptyChart title="顧客構成" delay={300} />
        <div className="lg:col-span-2">
          <EmptyChart title="生産性推移（一人当たり売上）" delay={400} />
        </div>
      </div>
    </div>
  );
};

function EmptyChart({ title, delay = 0 }: { title: string; delay?: number }) {
  return (
    <div
      className="bg-card rounded-lg shadow-sm p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
        <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">データがまだありません</p>
      </div>
    </div>
  );
}

export default Index;
