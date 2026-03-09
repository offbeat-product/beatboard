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

    const systemPrompt = "あなたはOff Beat株式会社の経営コンサルタントです。クリエイティブ制作会社の月次データを分析し、経営改善の提案を行ってください。回答はMarkdown形式で、見出しや箇条書きを適切に使用してください。";

    let userPrompt: string;

    if (type === "analysis") {
      userPrompt = `以下は${data.yearMonth}の経営データです。数値評価と課題分析を行ってください。

【経営指標】
売上: ${data.revenue}円（目標: ${data.revenueTarget}円、達成率: ${data.revenueAchievementRate}%）
粗利: ${data.grossProfit}円（粗利率: ${data.grossProfitRate}%、目標: 70%）
営業利益: ${data.operatingProfit}円（営業利益率: ${data.operatingProfitRate}%、目標: 20%）
販管費: ${data.sgaTotal}円

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
修正発生率: ${data.revisionRate}%（目標: 20%以下）

以下の構成で分析してください:
1. 数値評価（各指標の目標に対する達成状況を評価）
2. 課題の特定（目標未達の指標とその重要度）
3. 課題の原因分析（なぜ目標に届いていないのか、データから読み取れる仮説）`;
    } else if (type === "action") {
      userPrompt = `先ほどの分析結果を踏まえ、以下を提案してください:

前回の分析内容:
${data.analysisContent}

1. 解決策（各課題に対する具体的な解決アプローチ）
2. 来月の優先アクション（優先度の高い順に3〜5つ）
3. KPI改善のシナリオ（このアクションを実行した場合の来月の想定改善幅）

Off Beat株式会社は正社員2名+パート3名の小規模チームで、AI活用による効率化を推進しています。実行可能性を考慮した提案をしてください。`;
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
