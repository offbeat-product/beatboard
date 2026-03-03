import { Bot, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";

const insights = [
  {
    icon: TrendingUp,
    title: "売上成長の加速",
    description: "直近3ヶ月で売上が平均15%成長しています。映像制作の需要が特に高く、制作キャパシティの拡大を検討することで、さらなる成長が見込めます。",
    type: "positive" as const,
  },
  {
    icon: Lightbulb,
    title: "Web制作の単価改善余地",
    description: "Web制作の案件単価が前年比で5%低下しています。付加価値の高いUX/UIコンサルティングをバンドルすることで、単価を20%改善できる可能性があります。",
    type: "neutral" as const,
  },
  {
    icon: AlertTriangle,
    title: "顧客集中リスク",
    description: "上位3社で全売上の62%を占めています。新規顧客の開拓や中小案件の獲得を通じて、顧客ポートフォリオの分散を推奨します。",
    type: "warning" as const,
  },
];

const AIAdvisor = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">AIアドバイザー</h2>
      <p className="text-muted-foreground text-sm mt-1">AIが生成した経営改善提案</p>
    </div>

    <div className="space-y-4">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="bg-card rounded-lg shadow-sm p-5 animate-fade-in flex gap-4"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className={`h-10 w-10 rounded-sm flex items-center justify-center shrink-0 ${
            insight.type === "positive" ? "bg-green-50 text-chart-green" :
            insight.type === "warning" ? "bg-amber-50 text-chart-yellow" :
            "bg-accent text-accent-foreground"
          }`}>
            <insight.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-1">{insight.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-card rounded-lg shadow-sm p-5 border-l-4 border-primary">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">AIサマリー</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        全体として、貴社の経営状況は健全です。売上・粗利ともに改善トレンドにあり、生産性も向上しています。
        短期的には顧客集中リスクへの対応、中期的にはWeb制作の高付加価値化が経営の安定化に貢献するでしょう。
      </p>
    </div>
  </div>
);

export default AIAdvisor;
