import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const REPORT_TYPE = "monthly_integrated";

// ───────── helpers ─────────
const fmtJPY = (n: number | null | undefined) => {
  const v = Number(n || 0);
  const sign = v < 0 ? "△" : "";
  const abs = Math.abs(v);
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}億円`;
  if (abs >= 10000) return `${sign}${Math.round(abs / 10000).toLocaleString()}万円`;
  return `${sign}${Math.round(abs).toLocaleString()}円`;
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const prevYm = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const stripJsonFences = (s: string) =>
  s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    const { year_month, org_id } = await req.json();
    if (!year_month || !org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "year_month と org_id は必須です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ───────── 1. キャッシュ確認 ─────────
    if (!force) {
      const { data: cache } = await supabase
        .from("report_cache")
        .select("report_content, generated_at")
        .eq("org_id", org_id)
        .eq("year_month", year_month)
        .eq("report_type", REPORT_TYPE)
        .maybeSingle();
      if (cache?.report_content) {
        try {
          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              generated_at: cache.generated_at,
              report_data: JSON.parse(cache.report_content),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch {
          // パース失敗→再生成
        }
      }
    }

    // ───────── 2. データ取得 ─────────
    const pYm = prevYm(year_month);
    const [y, m] = year_month.split("-").map(Number);
    const monthStart = `${year_month}-01`;
    const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);

    const [
      { data: freeePl },
      { data: prevFreeePl },
      { data: finance },
      { data: worklogs },
      { data: qualityMonthly },
      { data: targetsRows },
      { data: planRows },
      { data: projectPl },
    ] = await Promise.all([
      supabase.from("freee_monthly_pl").select("*").eq("year_month", year_month).maybeSingle(),
      supabase.from("freee_monthly_pl").select("*").eq("year_month", pYm).maybeSingle(),
      supabase.from("finance_monthly").select("*").eq("year_month", year_month).maybeSingle(),
      supabase
        .from("daily_worklogs")
        .select("hours, project_id")
        .gte("date", monthStart)
        .lte("date", monthEnd),
      supabase.from("quality_monthly").select("*").eq("year_month", year_month),
      supabase
        .from("targets")
        .select("*")
        .eq("year_month", year_month)
        .order("created_at", { ascending: true }), // 古い順 → Mapで上書きされ最新が残る
      supabase.from("plan_settings").select("*"),
      supabase.from("project_pl").select("client_id, client_name, revenue").eq("year_month", year_month),
    ]);

    // ───────── 経営指標 (freee_monthly_pl 優先) ─────────
    const monthlyRevenue = Number(freeePl?.revenue || 0);
    const monthlyGp = Number(freeePl?.gross_profit || 0);
    const sgaTotal = Number(freeePl?.sga_total || 0);
    const operatingProfit = Number(freeePl?.operating_profit || (monthlyGp - sgaTotal));
    const gpRate = freeePl?.gross_profit_rate != null
      ? Number(freeePl.gross_profit_rate)
      : pct(monthlyGp, monthlyRevenue);
    const opRate = pct(operatingProfit, monthlyRevenue);

    const prevRevenue = Number(prevFreeePl?.revenue || 0);
    const prevGp = Number(prevFreeePl?.gross_profit || 0);
    const prevGpRate = prevFreeePl?.gross_profit_rate != null
      ? Number(prevFreeePl.gross_profit_rate)
      : pct(prevGp, prevRevenue);

    // ───────── 工数 ─────────
    const totalHours = (worklogs || []).reduce((s, r: any) => s + Number(r.hours || 0), 0);
    const projectHours = (worklogs || [])
      .filter((r: any) => r.project_id)
      .reduce((s, r: any) => s + Number(r.hours || 0), 0);
    const utilization = pct(projectHours, totalHours);
    const ghp = totalHours > 0 ? Math.round(monthlyGp / totalHours) : 0;
    const pghp = projectHours > 0 ? Math.round(monthlyGp / projectHours) : 0;

    // ───────── 顧客集計 (project_pl から、なければ quality_monthly から取引社数のみ) ─────────
    const clientRev = new Map<string, { name: string; rev: number }>();
    (projectPl || []).forEach((r: any) => {
      const cid = String(r.client_id || "unknown");
      const cur = clientRev.get(cid) || { name: r.client_name || cid, rev: 0 };
      cur.rev += Number(r.revenue || 0);
      cur.name = r.client_name || cur.name;
      clientRev.set(cid, cur);
    });

    let activeClients = clientRev.size;
    let top5: { name: string; rev: number }[] = [...clientRev.values()].sort((a, b) => b.rev - a.rev).slice(0, 5);
    let top1Share = 0;
    let top2Share = 0;

    if (clientRev.size > 0 && monthlyRevenue > 0) {
      top1Share = pct(top5[0]?.rev || 0, monthlyRevenue);
      top2Share = pct((top5[0]?.rev || 0) + (top5[1]?.rev || 0), monthlyRevenue);
    } else {
      // フォールバック: quality_monthly から取引顧客数のみ
      const qClients = (qualityMonthly || []).filter(
        (r: any) => r.client_id && r.client_id !== "__total__",
      );
      activeClients = qClients.length;
    }

    const top5List =
      top5.length > 0
        ? top5
            .map(
              (c, i) =>
                `${i + 1}. ${c.name}: ${fmtJPY(c.rev)} (${pct(c.rev, monthlyRevenue)}%)`,
            )
            .join("\n")
        : "(顧客別売上データなし)";

    // ───────── 品質 (quality_monthly から、__total__ 行を除外して合算) ─────────
    const qRows = (qualityMonthly || []).filter(
      (r: any) => r.client_id && r.client_id !== "__total__",
    );
    const totalDeliveries = qRows.reduce((s, r: any) => s + Number(r.total_deliveries || 0), 0);
    const totalOnTime = qRows.reduce((s, r: any) => s + Number(r.on_time_deliveries || 0), 0);
    const totalRevisions = qRows.reduce((s, r: any) => s + Number(r.revision_count || 0), 0);
    const onTimeRate = totalDeliveries > 0 ? pct(totalOnTime, totalDeliveries) : 0;
    const revisionRate =
      totalDeliveries > 0 ? Math.round((totalRevisions / totalDeliveries) * 1000) / 10 : 0;

    // ───────── 目標値 (targets 最新 → plan_settings → デフォルト) ─────────
    const tMap = new Map<string, number>();
    (targetsRows || []).forEach((t: any) =>
      tMap.set(t.metric_name, Number(t.target_value || 0)),
    );
    // plan_settings は会計年度別。当該年度を優先するが、無ければ任意の1件。
    const plan: any =
      (planRows || []).find((p: any) => p.fiscal_year?.includes(String(y))) ||
      (planRows || [])[0] || {};

    const target_sales =
      tMap.get("monthly_revenue") ||
      (plan.annual_revenue_target ? Math.round(Number(plan.annual_revenue_target) / 12) : 0) ||
      6250000;
    const target_gpr =
      tMap.get("gross_margin_rate") ||
      tMap.get("gross_profit_rate") ||
      Number(plan.gross_profit_rate) ||
      70;
    const target_opr = Number(plan.operating_profit_rate) || 20;
    const target_ghp =
      tMap.get("gross_profit_per_hour") ||
      tMap.get("gp_per_hour") ||
      Number(plan.gp_per_hour_target) ||
      21552;
    const target_pghp =
      tMap.get("gp_per_project_hour") || Number(plan.gp_per_project_hour_target) || 25000;
    const target_utilization = tMap.get("utilization_rate") || 70;
    const target_on_time =
      tMap.get("on_time_rate") || Number(plan.on_time_delivery_target) || 95;
    const target_revision =
      tMap.get("revision_rate") || Number(plan.revision_rate_target) || 20;
    const target_clients = Number(plan.annual_client_target) || 30;
    const target_top1_max = 25;

    // ───────── 財務指標 (finance_monthly) ─────────
    const cashBalance = Number(finance?.cash_and_deposits || 0);
    const netAssets = Number(finance?.net_assets || 0);
    const income = Number(finance?.income_amount || 0);
    const expense = Number(finance?.expense_amount || 0);
    const receivables = Number(finance?.accounts_receivable || 0);
    const payables = Number(finance?.accounts_payable || 0);

    // ───────── 3. プロンプト構築 ─────────
    const systemPrompt = `あなたはOff Beat株式会社の経営アドバイザーです。
与えられた月次経営データを分析し、経営者向けの月次統合レポートを生成してください。

レポートは以下の7項目構造で、必ず指定されたJSON形式で出力してください:
1. 目標(goal) — 今期の目指す姿
2. 現状(current) — 各指標の実績
3. 問題(gap) — 目標との乖離
4. 課題(issue) — GAPの根本原因
5. 方針(policy) — やること・やらないこと
6. 解決策(solution) — 具体的施策
7. 来月アクション(next_action) — タイムライン付き実行計画

## 重要な制約
- すべての文字列は日本語で記述(英字ラベルを除く)
- 数値は具体的に(例: "163.7%" "△838万円" "+15.5pt")
- JSON以外の文字(マークダウン、説明文など)は一切出力しない
- 必ずvalid JSONで、全フィールドを埋めること

## ステータス判定基準
- success: 目標達成率100%以上
- warning: 目標達成率70-99%
- danger: 目標達成率70%未満 / 債務超過 / 構造的リスク

## 会社情報
- Off Beat株式会社(クリエイティブ制作会社、広告代理店向けデジタル広告クリエイティブ制作)
- 6名体制(代表1名・社員2名・パート3名)
- 少人数で粗利工数単価を最大化する方針

## 出力JSONスキーマ
{
  "meta": { "year_month": "YYYY-MM", "generated_at": "ISO8601", "organization_name": "Off Beat株式会社" },
  "headline": { "title": "最大35文字", "subtitle": "最大80文字" },
  "goal": {
    "pillars": [
      { "label": "PROFIT", "title": "収益性の向上", "metric": "粗利率 70%", "description": "80文字程度" },
      { "label": "STABILITY", "title": "財務基盤の安定化", "metric": "...", "description": "..." },
      { "label": "GROWTH", "title": "顧客基盤の拡大", "metric": "...", "description": "..." }
    ],
    "kpis": [
      { "category": "経営指標", "items": [{"name":"...","target":"...","note":"..."}] },
      { "category": "財務指標", "items": [...] },
      { "category": "生産性指標", "items": [...] },
      { "category": "顧客指標", "items": [...] },
      { "category": "品質指標", "items": [...] }
    ]
  },
  "current": {
    "pillars": [
      { "label":"PROFIT", "title":"収益性", "target_key":"粗利率", "target_value":"70%", "actual_value":"64.17", "unit":"%", "status":"warning", "status_text":"目標未達", "note":"..." }
    ],
    "kpis": [ { "category":"...", "items":[{"name":"...","target":"...","actual":"...","rate":"...","status":"..."}] } ]
  },
  "gap": {
    "pillars": [
      { "label":"...", "title":"...", "target":"...", "actual":"...", "gap":"△5.83", "gap_unit":"pt", "progress_rate":91.7, "status":"warning", "note":"..." }
    ],
    "kpis": [ { "category":"...", "items":[{"name":"...","target":"...","actual":"...","gap":"...","rate":91.7,"status":"..."}] } ]
  },
  "issue": {
    "root_causes": [
      { "rank":"01", "priority":"収益性を阻害", "title":"タイトル", "description":"100-150文字", "impact":["バッジ1","バッジ2","バッジ3"] }
    ],
    "kpi_issues": [ { "category":"経営指標", "issues":["短い箇条書き1","短い箇条書き2"] } ]
  },
  "policy": {
    "headline_title": "今月の基本方針",
    "headline_subtitle": "補足メッセージ",
    "yes_items": ["やること1","やること2","やること3"],
    "no_items": ["やらないこと1","やらないこと2","やらないこと3"]
  },
  "solution": {
    "headline_title": "具体的な施策",
    "headline_subtitle": "補足",
    "items": [ { "title":"8文字以内", "detail":"80-100文字" } ]
  },
  "next_action": {
    "headline_title": "来月の実行計画",
    "headline_subtitle": "補足",
    "top_priority": { "title":"...", "owner":"...", "deadline":"...", "impact":"..." },
    "timeline": [ { "when":"4/5まで", "what":"50文字以内" } ]
  }
}

## 文字数制限(厳守)
- headline.title: 35文字以内
- headline.subtitle: 80文字以内
- pillars[].description/note: 80文字程度
- issue.root_causes[].description: 100-150文字
- issue.root_causes[].impact の各要素: 15文字以内
- issue.kpi_issues[].issues の各要素: 30文字以内
- solution.items[].title: 8文字以内
- solution.items[].detail: 80-100文字
- next_action.timeline[].what: 50文字以内`;

    const userPrompt = `以下は ${year_month} の経営データです。このデータを元に月次統合レポートを生成してください。

## 目標値
- 月次売上: ${fmtJPY(target_sales)}
- 粗利率: ${target_gpr}%
- 営業利益率: ${target_opr}%
- 粗利工数単価: ${target_ghp}円/h
- 案件粗利工数単価: ${target_pghp}円/h
- 案件稼働率: ${target_utilization}%以上
- 納期遵守率: ${target_on_time}%以上
- 修正率: ${target_revision}%以下
- 年間取引顧客数: ${target_clients}社
- 上位1社構成比: ${target_top1_max}%以下

## 実績データ

### 経営指標
- 月次売上: ${fmtJPY(monthlyRevenue)} (目標比 ${pct(monthlyRevenue, target_sales)}%)
- 粗利: ${fmtJPY(monthlyGp)}
- 粗利率: ${gpRate}% (目標 ${target_gpr}%)
- 営業利益: ${fmtJPY(operatingProfit)}
- 営業利益率: ${opRate}%

### 財務指標
- 現預金残高: ${fmtJPY(cashBalance)}
- 純資産: ${fmtJPY(netAssets)}
- 入金額: ${fmtJPY(income)}
- 出金額: ${fmtJPY(expense)}
- 売掛金: ${fmtJPY(receivables)}
- 買掛金: ${fmtJPY(payables)}

### 生産性指標
- 総労働時間: ${Math.round(totalHours)}h
- 案件工数: ${Math.round(projectHours)}h
- 案件稼働率: ${utilization}%
- 粗利工数単価: ${ghp.toLocaleString()}円/h
- 案件粗利工数単価: ${pghp.toLocaleString()}円/h

### 顧客指標
- 当月取引顧客数: ${activeClients}社
- 上位1社構成比: ${top1Share}%
- 上位2社構成比: ${top2Share}%

TOP5顧客:
${top5List}

### 品質指標
- 納品件数: ${totalDeliveries}件
- 納期遵守率: ${onTimeRate}% (目標 ${target_on_time}%以上)
- 修正率: ${revisionRate}% (目標 ${target_revision}%以下)

## 前月比較 (${pYm})
- 売上: ${fmtJPY(prevRevenue)} → ${fmtJPY(monthlyRevenue)} (前月比 ${pct(monthlyRevenue, prevRevenue)}%)
- 粗利率: ${prevGpRate}% → ${gpRate}%

上記データを分析し、JSON形式で7項目構造のレポートを出力してください。
JSONのみを出力し、マークダウン記号や説明文は含めないでください。`;

    // ───────── 4. Claude API 呼び出し ─────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Claude APIエラー (${claudeRes.status}): ${errText.slice(0, 200)}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claudeJson = await claudeRes.json();
    const rawText: string = claudeJson?.content?.[0]?.text || "";
    if (!rawText) {
      console.error("Claude empty response:", JSON.stringify(claudeJson));
      throw new Error("Claudeから空のレスポンスが返却されました");
    }

    // ───────── 5. JSONパース ─────────
    let reportData: any;
    try {
      reportData = JSON.parse(stripJsonFences(rawText));
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", rawText.slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "AIレスポンスのJSON解析に失敗しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ───────── 6. DB保存 (upsert) ─────────
    const reportContent = JSON.stringify(reportData);
    const { error: upsertErr } = await supabase.from("report_cache").upsert(
      {
        org_id,
        year_month,
        report_type: REPORT_TYPE,
        report_content: reportContent,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,year_month,report_type" },
    );
    if (upsertErr) {
      console.error("DB upsert error:", upsertErr);
      return new Response(
        JSON.stringify({ success: false, error: `DB保存エラー: ${upsertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, report_data: reportData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-monthly-report error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
