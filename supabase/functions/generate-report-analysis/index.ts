import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (type === "analysis") {
      systemPrompt = `あなたはOff Beat株式会社の経営アドバイザーです。
以下の月次データを分析し、数値評価・課題分析レポートを生成してください。

【レポート構成】
1. 総合評価（A/B/C/D の4段階 + 一言コメント）
2. 経営指標の評価（売上・粗利の目標達成度、前月比の分析）
3. 財務指標の評価（キャッシュフロー状況、運転資金の安全性、債務超過の状況）
4. 生産性指標の評価（工数単価の推移、リソース効率）
5. 顧客指標の評価（顧客集中リスク、顧客別収益性）
6. 品質指標の評価（納期遵守率、修正率の傾向）
7. 重要課題TOP3（優先度順）

【注意事項】
- 数値は具体的に引用すること
- 前月比・目標比で改善/悪化を明示すること
- Off Beatは社員6名の小規模クリエイティブ制作会社であることを考慮すること
- 年間売上目標7,500万円（上半期3,000万、下半期4,500万）を基準に評価すること
- 回答はMarkdown形式で、見出しや箇条書きを適切に使用してください。`;

      userPrompt = `以下は${data.yearMonth}の経営データです。数値評価と課題分析を行ってください。

【経営指標】
売上: ${data.revenue}円（目標: ${data.revenueTarget}円、達成率: ${data.revenueAchievementRate}%）
粗利: ${data.grossProfit}円（粗利率: ${data.grossProfitRate}%、目標: 70%）
営業利益: ${data.operatingProfit}円（営業利益率: ${data.operatingProfitRate}%、目標: 20%）
販管費: ${data.sgaTotal}円

【財務指標】
入金額: ${data.incomeAmount}円
出金額: ${data.expenseAmount}円
収支差額: ${data.cashFlowDiff}円
現預金残高: ${data.cashAndDeposits}円（前月比増減: ${data.cashMom}円）
売掛金残高: ${data.accountsReceivable}円
買掛金残高: ${data.accountsPayable}円
売掛回転日数: ${data.arTurnoverDays}日
買掛回転日数: ${data.apTurnoverDays}日
資産合計: ${data.totalAssets}円
負債合計: ${data.totalLiabilities}円
純資産: ${data.netAssets}円
自己資本比率: ${data.equityRatio}%
借入金残高: ${data.borrowings}円

【生産性指標】
総労働時間: ${data.totalLaborHours}h
案件工数: ${data.projectHours}h
粗利工数単価: ${data.grossProfitPerHour}円（目標: ¥21,552）
案件粗利工数単価: ${data.grossProfitPerProjectHour}円（目標: ¥25,000）

【顧客指標】
顧客数: ${data.clientCount}社
顧客単価: ${data.clientAvg}円
案件数: ${data.projectCount}件
案件単価: ${data.projectAvg}円

【品質指標】
案件数: ${data.qualityCount}件
納期遵守率: ${data.onTimeRate}%（目標: 95%）
修正発生率: ${data.revisionRate}%（目標: 20%以下）`;

    } else if (type === "action") {
      systemPrompt = `あなたはOff Beat株式会社の経営アドバイザーです。
先ほどの数値評価・課題分析の結果を踏まえ、来月の具体的なアクションプランを生成してください。

【レポート構成】
1. 最優先アクション（1つ、具体的なタスクレベルで）
2. 経営改善アクション（2-3個）
3. 財務改善アクション（2-3個）
4. 生産性改善アクション（2-3個）
5. 顧客改善アクション（2-3個、顧客集中リスクの分散・新規開拓・既存深耕など）
6. 品質改善アクション（2-3個、納期遵守率・修正率の改善施策など）
7. 来月の重点KPI（3-5つ、具体的な数値目標付き）

【注意事項】
- 6名の小規模チームで実行可能な施策に限定すること
- 抽象的な提案ではなく、誰が・何を・いつまでにやるか明示すること
- AIツール（CheckGo AI、BeatBoard）の活用も含めること
- 回答はMarkdown形式で、見出しや箇条書きを適切に使用してください。`;

      userPrompt = `先ほどの分析結果を踏まえ、来月のアクションプランを提案してください。

前回の分析内容:
${data.analysisContent}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "レート制限を超えました。しばらくしてからお試しください。" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "クレジットが不足しています。" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-report-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
