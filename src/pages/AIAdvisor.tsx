import { useState } from "react";
import { Bot, Send, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── Dummy Reports ── */
const weeklyReports = [
  {
    id: "w1",
    date: "2026/03/03 09:00",
    title: "第9週 週次レポート",
    summary:
      "売上は目標に対して-8.3%のペースです。後半に向けて伝票が集中する傾向があるため、現時点では許容範囲ですが、来週以降の推移に注意が必要です。",
    body: `● 今週のサマリー
売上は目標に対して-8.3%のペースです。後半に向けて伝票が集中する傾向があるため、現時点では許容範囲ですが、来週以降の推移に注意が必要です。

● 注目指標
・顧客集中度が依然として高く、上位1社比率が43.1%です。新規顧客の獲得が急務です。
・粗利工数単価は前月比で改善傾向。案件単価の引き上げが効いています。

● 今週のアクション提案
1. レバレジーズに次四半期の発注見込みをヒアリング
2. 紹介経由でアプローチ中の2社にフォローアップ
3. CyberZのアップセル余地を検討（現在月額39万円）`,
  },
  {
    id: "w2",
    date: "2026/02/24 09:00",
    title: "第8週 週次レポート",
    summary:
      "売上は目標比+2.1%で推移。粗利率が前週比で0.8pt改善し、生産性向上が数値に表れ始めています。",
    body: `● 今週のサマリー
売上は目標比+2.1%で推移。粗利率が前週比で0.8pt改善し、生産性向上が数値に表れ始めています。

● 注目指標
・粗利率65.8%で目標63%を上回る水準を維持。
・新規リード2件獲得。紹介経由が好調。

● 今週のアクション提案
1. 新規リード2件への初回提案資料を準備
2. IRIS案件の追加発注について確認`,
  },
];

const monthlyReports = [
  {
    id: "m1",
    date: "2026/03/01 09:00",
    title: "2026年2月 月次レポート",
    summary:
      "2月の売上は625万円で目標比-3.2%。粗利率は65.0%と改善傾向ですが、顧客集中度の高さが引き続き課題です。",
    body: `● 月次サマリー
2月の売上は625万円で目標比-3.2%。粗利率は65.0%と改善傾向ですが、顧客集中度の高さが引き続き課題です。

● 主要KPI
・営業利益率: 15.3%（前月比+2.1pt）
・粗利工数単価: ¥18,781（目標¥22,000）
・上位1社比率: 43.1%（目標25%以下）

● 来月への提言
1. 新規顧客獲得に向けたリード創出施策の強化
2. 粗利工数単価の改善に向けた案件ポートフォリオの見直し`,
  },
];

/* ── Dummy Chat ── */
type ChatMessage = {
  role: "user" | "ai";
  content: string;
};

const initialChat: ChatMessage[] = [
  { role: "user", content: "顧客集中度を下げるにはどうすればいい？" },
  {
    role: "ai",
    content: `現在の上位1社比率は43.1%で、目標25%には大きなギャップがあります。アプローチは2つあります。

1. **新規顧客の獲得**: 月額50万円以上の新規を2社獲得できれば、上位1社比率を35%程度まで下げられます。

2. **既存顧客のアップセル**: CyberZ（現在39万円）やIRIS（65万円）の発注量を増やすことで、相対的に集中度が下がります。

まずは紹介経由の新規アプローチを優先することをお勧めします。`,
  },
];

/* ── Report Card ── */
function ReportCard({
  report,
}: {
  report: (typeof weeklyReports)[0];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="w-full text-left bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 space-y-2 border border-border"
    >
      <p className="text-xs text-muted-foreground">{report.date}</p>
      <h4 className="text-sm font-semibold">{report.title}</h4>
      {expanded ? (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {report.body}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {report.summary}
        </p>
      )}
    </button>
  );
}

/* ── Page ── */
const AIAdvisor = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [input, setInput] = useState("");

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      {
        role: "ai",
        content:
          "ただいま分析中です。この機能は近日中に実装予定です。",
      },
    ]);
    setInput("");
  };

  return (
    <div className="space-y-6 h-[calc(100vh-3rem)]">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AIアドバイザー</h2>
        <p className="text-muted-foreground text-sm mt-1">
          AIが生成したレポートとチャットによる経営相談
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[2fr_3fr] gap-6 h-[calc(100%-5rem)]">
        {/* ── Left: Reports ── */}
        <div className="flex flex-col bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <Tabs defaultValue="weekly" className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="weekly" className="flex-1">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  週次レポート
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  月次レポート
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="weekly" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full px-4 pb-4 pt-3">
                <div className="space-y-3">
                  {weeklyReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="monthly" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full px-4 pb-4 pt-3">
                <div className="space-y-3">
                  {monthlyReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Right: Chat ── */}
        <div className="flex flex-col bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-sm bg-accent flex items-center justify-center">
                <Bot className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AIアドバイザー</h3>
                <p className="text-xs text-muted-foreground">
                  経営データに基づいて分析・提案します
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-4">
              {messages.map((msg, i) =>
                msg.role === "ai" ? (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="h-7 w-7 rounded-sm bg-accent flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-accent-foreground" />
                    </div>
                    <div className="bg-secondary rounded-lg px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 max-w-[85%]">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="例: 今月の売上は目標に届きそう？"
                className="min-h-[44px] max-h-32 resize-none text-sm"
                rows={1}
              />
              <Button
                onClick={handleSend}
                size="icon"
                className="shrink-0 h-[44px] w-[44px]"
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisor;
