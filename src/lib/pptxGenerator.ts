/**
 * BeatBoard 月次統合レポート pptx ジェネレーター
 *
 * 使用方法:
 *   import { generateMonthlyReportPptx } from './pptxGenerator';
 *   await generateMonthlyReportPptx(reportData, { logoUrl: '/logo.png' });
 *
 * 自動的にブラウザでpptxファイルがダウンロードされる。
 */

import pptxgen from "pptxgenjs";
import { MonthlyReportData, BRAND_COLORS, getStatusColor } from "./types";

const C = BRAND_COLORS;

interface GenerateOptions {
  logoUrl?: string;              // ロゴ画像のURL (publicから取得)
  organizationName?: string;     // 組織名(デフォルト: データ内のmeta.organization_name)
  fileName?: string;             // ダウンロードファイル名(未指定なら自動)
}

// ========== 定数 ==========

const SW = 13.3;  // スライド幅
const SH = 7.5;   // スライド高さ
const LOGO_H = 0.32;
const LOGO_W = LOGO_H * (1004 / 227);  // ロゴのアスペクト比

const TOTAL_PAGES = 10;

// ========== メイン関数 ==========

export async function generateMonthlyReportPptx(
  data: MonthlyReportData,
  options: GenerateOptions = {}
): Promise<void> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = data.meta.organization_name;
  pres.title = `${data.meta.year_month} 月次経営分析レポート`;

  const logoUrl = options.logoUrl || "/logo.png";
  const orgName = options.organizationName || data.meta.organization_name;

  // ロゴを Base64 に変換(pptxgenjsが要求する形式)
  const logoBase64 = await loadImageAsBase64(logoUrl);

  // 各ページを生成
  addCoverPage(pres, data, logoBase64, orgName);
  addExecutiveSummary(pres, data, logoBase64);
  addGoalPage(pres, data, logoBase64);
  addCurrentPage(pres, data, logoBase64);
  addGapPage(pres, data, logoBase64);
  addIssuePage(pres, data, logoBase64);
  addPolicyPage(pres, data, logoBase64);
  addSolutionPage(pres, data, logoBase64);
  addActionPage(pres, data, logoBase64);
  addSummaryPage(pres, data, logoBase64);

  // ファイル名の決定
  const fileName =
    options.fileName ||
    `${orgName}_${data.meta.year_month.replace("-", "")}_MonthlyReport.pptx`;

  // ダウンロード実行
  await pres.writeFile({ fileName });
}

// ========== ヘルパー関数 ==========

/**
 * 画像URLを Base64 に変換
 */
async function loadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 共通ヘッダー・フッターの追加
 */
function addHeaderFooter(
  slide: pptxgen.Slide,
  pageTitle: string | null,
  pageNum: number,
  logoBase64: string
) {
  if (pageTitle) {
    slide.addShape("rect", {
      x: 0.5, y: 0.38, w: 0.06, h: 0.35,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    slide.addText(pageTitle, {
      x: 0.65, y: 0.35, w: 6, h: 0.4,
      fontSize: 15, fontFace: "Meiryo", bold: true,
      color: C.text, valign: "middle", margin: 0
    });
  }

  slide.addImage({
    data: logoBase64,
    x: SW - 0.5 - LOGO_W, y: 0.38, w: LOGO_W, h: LOGO_H
  });

  slide.addShape("line", {
    x: 0.5, y: 0.85, w: SW - 1, h: 0,
    line: { color: C.border, width: 0.5 }
  });

  slide.addText("© Off Beat Inc. All Rights Reserved.", {
    x: 0.5, y: 7.05, w: 6, h: 0.3,
    fontSize: 8, fontFace: "Arial", color: C.gray, margin: 0
  });

  slide.addText(`${pageNum} / ${TOTAL_PAGES}`, {
    x: SW - 2, y: 7.05, w: 1.4, h: 0.3,
    fontSize: 9, fontFace: "Arial", color: C.gray,
    align: "right", margin: 0
  });
}

/**
 * スライドタイトル(大見出し + サブタイトル)の追加
 */
function addSlideTitle(slide: pptxgen.Slide, title: string, subtitle?: string) {
  slide.addShape("rect", {
    x: 0.5, y: 1.15, w: 0.08, h: 0.5,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  slide.addText(title, {
    x: 0.75, y: 1.1, w: 12, h: 0.5,
    fontSize: 22, fontFace: "Meiryo", bold: true,
    color: C.text, margin: 0
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.75, y: 1.65, w: 12, h: 0.3,
      fontSize: 11, fontFace: "Meiryo", color: C.gray, margin: 0
    });
  }
}

// ========== ページ1: 表紙 ==========

function addCoverPage(
  pres: pptxgen,
  data: MonthlyReportData,
  logoBase64: string,
  orgName: string
) {
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // 右側の装飾円
  s.addShape("ellipse", {
    x: 8.5, y: -2, w: 7, h: 7,
    fill: { color: C.gradEnd }, line: { color: C.gradEnd, width: 0 }
  });
  s.addShape("ellipse", {
    x: 9.5, y: 2, w: 6, h: 6,
    fill: { color: C.primary, transparency: 10 },
    line: { color: C.primary, width: 0 }
  });
  s.addShape("ellipse", {
    x: 10, y: 4, w: 5, h: 5,
    fill: { color: C.gradAccent, transparency: 30 },
    line: { color: C.gradAccent, width: 0 }
  });

  // 左上ロゴ(大きめ)
  const titleLogoH = 0.5;
  const titleLogoW = titleLogoH * (1004 / 227);
  s.addImage({
    data: logoBase64,
    x: 0.7, y: 0.6, w: titleLogoW, h: titleLogoH
  });

  // ラベル
  s.addText("MONTHLY BUSINESS REVIEW", {
    x: 0.7, y: 2.3, w: 8, h: 0.35,
    fontSize: 13, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 4, margin: 0
  });

  // 年月を分解して表示
  const [year, month] = data.meta.year_month.split("-");
  const monthNum = parseInt(month, 10);

  s.addText(`${year}年${monthNum}月度`, {
    x: 0.7, y: 2.8, w: 8, h: 0.9,
    fontSize: 48, fontFace: "Meiryo", bold: true,
    color: C.text, margin: 0
  });
  s.addText("月次経営分析レポート", {
    x: 0.7, y: 3.75, w: 8, h: 0.9,
    fontSize: 40, fontFace: "Meiryo", bold: true,
    color: C.text, margin: 0
  });

  // 英文サブタイトル
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? parseInt(year, 10) + 1 : year;
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  s.addText(
    `Performance Review & Action Plan for ${monthNames[nextMonth - 1]} ${nextYear}`,
    {
      x: 0.7, y: 4.9, w: 8, h: 0.4,
      fontSize: 14, fontFace: "Arial", italic: true,
      color: C.gray, margin: 0
    }
  );

  // 組織名
  s.addShape("line", {
    x: 0.7, y: 5.8, w: 1.5, h: 0,
    line: { color: C.text, width: 2 }
  });
  s.addText(orgName, {
    x: 0.7, y: 5.95, w: 5, h: 0.35,
    fontSize: 15, fontFace: "Meiryo", bold: true,
    color: C.text, margin: 0
  });

  // 生成日
  const generatedDate = new Date(data.meta.generated_at);
  const dateStr = `${generatedDate.getFullYear()}年${generatedDate.getMonth() + 1}月${generatedDate.getDate()}日`;
  s.addText(`最終生成: ${dateStr}`, {
    x: 0.7, y: 6.35, w: 5, h: 0.3,
    fontSize: 11, fontFace: "Meiryo", color: C.gray, margin: 0
  });

  // フッター(表紙はコピーライトのみ)
  s.addText("© Off Beat Inc. All Rights Reserved.", {
    x: 0.5, y: 7.05, w: 6, h: 0.3,
    fontSize: 8, fontFace: "Arial", color: C.gray, margin: 0
  });
}

// ========== ページ2: エグゼクティブサマリー(1ページ統合版) ==========

function addExecutiveSummary(
  pres: pptxgen,
  data: MonthlyReportData,
  logoBase64: string
) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "エグゼクティブサマリー", 2, logoBase64);

  // 大見出し
  s.addShape("rect", {
    x: 0.5, y: 1.15, w: 0.08, h: 0.5,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  s.addText(data.headline.title, {
    x: 0.75, y: 1.0, w: 12, h: 0.5,
    fontSize: 20, fontFace: "Meiryo", bold: true,
    color: C.text, margin: 0
  });
  s.addText(data.headline.subtitle, {
    x: 0.75, y: 1.5, w: 12, h: 0.3,
    fontSize: 11, fontFace: "Meiryo", color: C.gray, margin: 0
  });

  const contentW = 12.3;
  const contentX = 0.5;

  // ----- 行1: 目標/現状/問題 (横3カラム) -----
  const row1Y = 2.0;
  const row1H = 1.35;
  const row1ColW = (contentW - 0.2 * 2) / 3;

  const goalSummary = summarizeGoal(data);
  const currentSummary = summarizeCurrent(data);
  const gapSummary = summarizeGap(data);

  const row1Items = [
    { label: "GOAL", title: "目標", content: goalSummary, color: C.primary },
    { label: "CURRENT", title: "現状", content: currentSummary, color: C.dark },
    { label: "GAP", title: "問題(目標との乖離)", content: gapSummary, color: C.gray },
  ];

  row1Items.forEach((item, i) => {
    const x = contentX + i * (row1ColW + 0.2);
    s.addShape("rect", {
      x: x, y: row1Y, w: row1ColW, h: row1H,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: row1Y, w: 0.08, h: row1H,
      fill: { color: item.color }, line: { color: item.color, width: 0 }
    });
    s.addText(item.label, {
      x: x + 0.25, y: row1Y + 0.12, w: row1ColW - 0.4, h: 0.22,
      fontSize: 9, fontFace: "Arial", bold: true,
      color: item.color, charSpacing: 2, margin: 0
    });
    s.addText(item.title, {
      x: x + 0.25, y: row1Y + 0.33, w: row1ColW - 0.4, h: 0.3,
      fontSize: 13, fontFace: "Meiryo", bold: true,
      color: C.text, margin: 0
    });
    s.addText(item.content, {
      x: x + 0.25, y: row1Y + 0.68, w: row1ColW - 0.4, h: row1H - 0.75,
      fontSize: 9.5, fontFace: "Meiryo", color: C.dark, margin: 0
    });
  });

  // ----- 行2: 課題 / 方針 -----
  const row2Y = row1Y + row1H + 0.2;
  const row2H = 1.5;
  const row2ColW = (contentW - 0.2) / 2;

  // 課題
  const issueSummary = summarizeIssue(data);
  s.addShape("rect", {
    x: contentX, y: row2Y, w: row2ColW, h: row2H,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x: contentX, y: row2Y, w: 0.08, h: row2H,
    fill: { color: C.text }, line: { color: C.text, width: 0 }
  });
  s.addText("ISSUE", {
    x: contentX + 0.25, y: row2Y + 0.12, w: row2ColW - 0.4, h: 0.22,
    fontSize: 9, fontFace: "Arial", bold: true,
    color: C.text, charSpacing: 2, margin: 0
  });
  s.addText("課題(GAPの根本原因)", {
    x: contentX + 0.25, y: row2Y + 0.33, w: row2ColW - 0.4, h: 0.3,
    fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
  });
  s.addText(issueSummary, {
    x: contentX + 0.25, y: row2Y + 0.68, w: row2ColW - 0.4, h: row2H - 0.75,
    fontSize: 9.5, fontFace: "Meiryo", color: C.dark, margin: 0
  });

  // 方針(やること・やらないこと)
  const policyX = contentX + row2ColW + 0.2;
  s.addShape("rect", {
    x: policyX, y: row2Y, w: row2ColW, h: row2H,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x: policyX, y: row2Y, w: 0.08, h: row2H,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  s.addText("POLICY", {
    x: policyX + 0.25, y: row2Y + 0.12, w: row2ColW - 0.4, h: 0.22,
    fontSize: 9, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 2, margin: 0
  });
  s.addText("方針(やること・やらないこと)", {
    x: policyX + 0.25, y: row2Y + 0.33, w: row2ColW - 0.4, h: 0.3,
    fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
  });

  const innerW = (row2ColW - 0.4 - 0.15) / 2;
  const innerY = row2Y + 0.68;

  // やること
  s.addShape("rect", {
    x: policyX + 0.25, y: innerY, w: innerW, h: 0.3,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  s.addText("✓  やること", {
    x: policyX + 0.25, y: innerY, w: innerW, h: 0.3,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0
  });
  s.addText(
    data.policy.yes_items.slice(0, 3).map((t, idx) => ({
      text: "・" + t,
      options: {
        breakLine: idx < 2,
        fontSize: 8.5, color: C.dark, fontFace: "Meiryo", paraSpaceAfter: 2
      }
    })),
    { x: policyX + 0.25, y: innerY + 0.35, w: innerW, h: row2H - 0.75 - 0.35, margin: 0 }
  );

  // やらないこと
  const noX = policyX + 0.25 + innerW + 0.15;
  s.addShape("rect", {
    x: noX, y: innerY, w: innerW, h: 0.3,
    fill: { color: C.gray }, line: { color: C.gray, width: 0 }
  });
  s.addText("✗  やらないこと", {
    x: noX, y: innerY, w: innerW, h: 0.3,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0
  });
  s.addText(
    data.policy.no_items.slice(0, 3).map((t, idx) => ({
      text: "・" + t,
      options: {
        breakLine: idx < 2,
        fontSize: 8.5, color: C.dark, fontFace: "Meiryo", paraSpaceAfter: 2
      }
    })),
    { x: noX, y: innerY + 0.35, w: innerW, h: row2H - 0.75 - 0.35, margin: 0 }
  );

  // ----- 行3: 解決策 / 来月アクション -----
  const row3Y = row2Y + row2H + 0.2;
  const row3H = 1.75;
  const row3ColW = (contentW - 0.2) / 2;

  // 解決策
  s.addShape("rect", {
    x: contentX, y: row3Y, w: row3ColW, h: row3H,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x: contentX, y: row3Y, w: 0.08, h: row3H,
    fill: { color: C.gradEnd }, line: { color: C.gradEnd, width: 0 }
  });
  s.addText("SOLUTION", {
    x: contentX + 0.25, y: row3Y + 0.12, w: row3ColW - 0.4, h: 0.22,
    fontSize: 9, fontFace: "Arial", bold: true,
    color: C.gradEnd, charSpacing: 2, margin: 0
  });
  s.addText("解決策", {
    x: contentX + 0.25, y: row3Y + 0.33, w: row3ColW - 0.4, h: 0.3,
    fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
  });

  const topSolutions = data.solution.items.slice(0, 3);
  const solItemY = row3Y + 0.75;
  const solAreaH = row3H - 0.9;
  const solItemH = solAreaH / Math.max(topSolutions.length, 1);

  topSolutions.forEach((it, i) => {
    const y = solItemY + i * solItemH;
    const centerY = y + (solItemH - 0.28) / 2;
    s.addShape("ellipse", {
      x: contentX + 0.3, y: centerY, w: 0.28, h: 0.28,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(String(i + 1), {
      x: contentX + 0.3, y: centerY, w: 0.28, h: 0.28,
      fontSize: 11, fontFace: "Arial", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });
    s.addText(it.title, {
      x: contentX + 0.7, y: y, w: 1.5, h: solItemH,
      fontSize: 11, fontFace: "Meiryo", bold: true, color: C.text,
      valign: "middle", margin: 0
    });
    s.addText(it.detail, {
      x: contentX + 2.2, y: y, w: row3ColW - 2.4, h: solItemH,
      fontSize: 9, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
  });

  // 来月アクション
  const actX = contentX + row3ColW + 0.2;
  s.addShape("rect", {
    x: actX, y: row3Y, w: row3ColW, h: row3H,
    fill: { color: C.text }, line: { color: C.text, width: 0 }
  });
  s.addText("NEXT MONTH", {
    x: actX + 0.25, y: row3Y + 0.12, w: row3ColW - 0.4, h: 0.22,
    fontSize: 9, fontFace: "Arial", bold: true,
    color: C.gradAccent, charSpacing: 2, margin: 0
  });
  s.addText("来月の具体アクション", {
    x: actX + 0.25, y: row3Y + 0.33, w: row3ColW - 0.4, h: 0.3,
    fontSize: 13, fontFace: "Meiryo", bold: true, color: "FFFFFF", margin: 0
  });

  const topActions = data.next_action.timeline.slice(0, 5);
  const actItemY = row3Y + 0.75;
  const actAreaH = row3H - 0.9;
  const actItemH = actAreaH / Math.max(topActions.length, 1);

  topActions.forEach((it, i) => {
    const y = actItemY + i * actItemH;
    s.addShape("rect", {
      x: actX + 0.25, y: y + (actItemH - 0.25) / 2, w: 1.0, h: 0.25,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(it.when, {
      x: actX + 0.25, y: y + (actItemH - 0.25) / 2, w: 1.0, h: 0.25,
      fontSize: 8.5, fontFace: "Arial", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });
    s.addText(it.what, {
      x: actX + 1.35, y: y, w: row3ColW - 1.5, h: actItemH,
      fontSize: 9, fontFace: "Meiryo", color: "FFFFFF",
      valign: "middle", margin: 0
    });
  });
}

// ========== ページ3: 目標 ==========

function addGoalPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "目標", 3, logoBase64);

  const title = truncate(getGoalTitle(data), 35);
  addSlideTitle(s, title, "今期目指す姿と5指標の定量目標");

  // 上段: 3つの柱
  const pillarY = 2.15;
  const pillarH = 1.9;
  const pillarW = (12.3 - 0.3) / 3;

  data.goal.pillars.slice(0, 3).forEach((p, i) => {
    const x = 0.5 + i * (pillarW + 0.15);

    s.addShape("rect", {
      x: x, y: pillarY, w: pillarW, h: pillarH,
      fill: { color: C.gradEnd }, line: { color: C.gradEnd, width: 0 }
    });

    s.addText(p.label, {
      x: x + 0.3, y: pillarY + 0.2, w: pillarW - 0.5, h: 0.25,
      fontSize: 10, fontFace: "Arial", bold: true,
      color: C.gradAccent, charSpacing: 3, margin: 0
    });
    s.addText(p.title, {
      x: x + 0.3, y: pillarY + 0.45, w: pillarW - 0.5, h: 0.35,
      fontSize: 14, fontFace: "Meiryo", bold: true,
      color: "FFFFFF", margin: 0
    });
    s.addText(p.metric, {
      x: x + 0.3, y: pillarY + 0.85, w: pillarW - 0.5, h: 0.55,
      fontSize: 24, fontFace: "Meiryo", bold: true,
      color: "FFFFFF", margin: 0
    });
    s.addShape("line", {
      x: x + 0.3, y: pillarY + 1.45, w: 0.5, h: 0,
      line: { color: C.gradAccent, width: 2 }
    });
    s.addText(p.description, {
      x: x + 0.3, y: pillarY + 1.52, w: pillarW - 0.5, h: 0.35,
      fontSize: 9, fontFace: "Meiryo", color: C.gradAccent, margin: 0
    });
  });

  // 下段: 5指標の定量目標
  s.addText("QUANTITATIVE TARGETS  /  5指標の定量目標", {
    x: 0.5, y: 4.15, w: 8, h: 0.3,
    fontSize: 10, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 2, margin: 0
  });

  const kpiY = 4.2;
  const kpiH = 2.65;
  const kpiW = (12.3 - 0.4) / 5;

  data.goal.kpis.slice(0, 5).forEach((cat, i) => {
    const x = 0.5 + i * (kpiW + 0.1);
    const y = kpiY + 0.2;

    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: kpiH - 0.2,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: 0.35,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(cat.category, {
      x: x, y: y, w: kpiW, h: 0.35,
      fontSize: 11, fontFace: "Meiryo", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });

    // 項目は2つまでに制限
    const items = cat.items.slice(0, 2);
    const itemStartY = y + 0.45;
    const availH = kpiH - 0.2 - 0.5;
    const itemH = availH / Math.max(items.length, 1);

    items.forEach((it, idx) => {
      const iy = itemStartY + idx * itemH;

      s.addText(it.name, {
        x: x + 0.15, y: iy + 0.05, w: kpiW - 0.3, h: 0.25,
        fontSize: 9, fontFace: "Meiryo", color: C.gray, margin: 0
      });
      s.addText(it.target, {
        x: x + 0.15, y: iy + 0.3, w: kpiW - 0.3, h: 0.3,
        fontSize: 12, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
      });
      s.addText(it.note, {
        x: x + 0.15, y: iy + 0.6, w: kpiW - 0.3, h: 0.22,
        fontSize: 7.5, fontFace: "Meiryo", color: C.gray, margin: 0
      });
      if (idx < items.length - 1) {
        s.addShape("line", {
          x: x + 0.15, y: iy + itemH - 0.02, w: kpiW - 0.3, h: 0,
          line: { color: C.border, width: 0.5 }
        });
      }
    });
  });
}

// ========== ページ4: 現状 ==========

function addCurrentPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "現状", 4, logoBase64);
  addSlideTitle(s, data.headline.title, data.headline.subtitle);

  // 上段: 3つの柱
  const pillarY = 2.15;
  const pillarH = 1.9;
  const pillarW = (12.3 - 0.3) / 3;

  data.current.pillars.slice(0, 3).forEach((p, i) => {
    const x = 0.5 + i * (pillarW + 0.15);
    const statusColor = getStatusColor(p.status);

    s.addShape("rect", {
      x: x, y: pillarY, w: pillarW, h: pillarH,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: pillarY, w: pillarW, h: 0.08,
      fill: { color: statusColor }, line: { color: statusColor, width: 0 }
    });

    s.addText(p.label, {
      x: x + 0.3, y: pillarY + 0.25, w: pillarW - 0.5, h: 0.25,
      fontSize: 10, fontFace: "Arial", bold: true,
      color: C.primary, charSpacing: 3, margin: 0
    });
    s.addText(p.title, {
      x: x + 0.3, y: pillarY + 0.5, w: pillarW - 0.5, h: 0.3,
      fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
    });

    // ステータスバッジ
    s.addShape("rect", {
      x: x + pillarW - 1.4, y: pillarY + 0.27, w: 1.2, h: 0.3,
      fill: { color: statusColor }, line: { color: statusColor, width: 0 }
    });
    s.addText(p.status_text, {
      x: x + pillarW - 1.4, y: pillarY + 0.27, w: 1.2, h: 0.3,
      fontSize: 9, fontFace: "Meiryo", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });

    // 大きな実績値
    s.addText([
      { text: p.actual_value, options: { fontSize: 36, bold: true, color: C.text, fontFace: "Arial" } },
      { text: " " + p.unit, options: { fontSize: 14, color: C.dark, fontFace: "Meiryo" } },
    ], { x: x + 0.3, y: pillarY + 0.9, w: pillarW - 0.5, h: 0.6, margin: 0 });

    s.addText([
      { text: "目標  ", options: { fontSize: 9, color: C.gray, fontFace: "Meiryo" } },
      { text: p.target_key + " ", options: { fontSize: 9, color: C.dark, fontFace: "Meiryo" } },
      { text: p.target_value, options: { fontSize: 10, bold: true, color: C.primary, fontFace: "Meiryo" } },
    ], { x: x + 0.3, y: pillarY + 1.5, w: pillarW - 0.5, h: 0.25, margin: 0 });

    s.addText(p.note, {
      x: x + 0.3, y: pillarY + 1.72, w: pillarW - 0.5, h: 0.2,
      fontSize: 8, fontFace: "Meiryo", color: C.gray, margin: 0
    });
  });

  // 下段: 5指標の実績
  addKpiCardsGrid(
    s, data.current.kpis, "CURRENT PERFORMANCE  /  5指標の実績", "current"
  );
}

// ========== ページ5: 問題(GAP) ==========

function addGapPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "問題", 5, logoBase64);
  addSlideTitle(s, "目標と現状のGAP", "定量的な不足とその規模を可視化");

  // 上段: 3つの柱のGAP
  const pillarY = 2.15;
  const pillarH = 2.15;
  const pillarW = (12.3 - 0.3) / 3;

  data.gap.pillars.slice(0, 3).forEach((p, i) => {
    const x = 0.5 + i * (pillarW + 0.15);
    const statusColor = getStatusColor(p.status);

    s.addShape("rect", {
      x: x, y: pillarY, w: pillarW, h: pillarH,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: pillarY, w: pillarW, h: 0.08,
      fill: { color: statusColor }, line: { color: statusColor, width: 0 }
    });

    s.addText(p.label, {
      x: x + 0.3, y: pillarY + 0.22, w: pillarW - 0.5, h: 0.22,
      fontSize: 9, fontFace: "Arial", bold: true,
      color: C.primary, charSpacing: 3, margin: 0
    });
    s.addText(p.title, {
      x: x + 0.3, y: pillarY + 0.44, w: pillarW - 0.5, h: 0.3,
      fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
    });

    const flowY = pillarY + 0.8;
    const colW = (pillarW - 0.6) / 2;
    s.addText("目標", {
      x: x + 0.3, y: flowY, w: colW, h: 0.2,
      fontSize: 8, fontFace: "Meiryo", color: C.gray, margin: 0
    });
    s.addText(p.target, {
      x: x + 0.3, y: flowY + 0.18, w: colW, h: 0.25,
      fontSize: 10, fontFace: "Meiryo", bold: true, color: C.dark, margin: 0
    });
    s.addText("実績", {
      x: x + 0.3 + colW, y: flowY, w: colW, h: 0.2,
      fontSize: 8, fontFace: "Meiryo", color: C.gray, margin: 0
    });
    s.addText(p.actual, {
      x: x + 0.3 + colW, y: flowY + 0.18, w: colW, h: 0.25,
      fontSize: 10, fontFace: "Meiryo", bold: true, color: C.dark, margin: 0
    });

    // GAP
    const gapY = pillarY + 1.3;
    s.addShape("rect", {
      x: x + 0.3, y: gapY, w: pillarW - 0.6, h: 0.5,
      fill: { color: C.lightBg }, line: { color: C.lightBg, width: 0 }
    });
    s.addText("GAP", {
      x: x + 0.4, y: gapY + 0.05, w: 0.8, h: 0.18,
      fontSize: 8, fontFace: "Arial", bold: true, color: C.primary,
      charSpacing: 2, margin: 0
    });
    s.addText([
      { text: p.gap, options: { fontSize: 17, bold: true, color: statusColor, fontFace: "Arial" } },
      { text: " " + p.gap_unit, options: { fontSize: 10, color: statusColor, fontFace: "Meiryo" } },
    ], { x: x + 0.4, y: gapY + 0.2, w: pillarW - 0.8, h: 0.3, margin: 0 });

    s.addText(p.note, {
      x: x + 0.3, y: pillarY + 1.85, w: pillarW - 0.5, h: 0.22,
      fontSize: 8, fontFace: "Meiryo", color: C.gray, margin: 0
    });
  });

  // 下段: 5指標のGAP(プログレスバー)
  addKpiCardsGrid(
    s, data.gap.kpis, "GAP ANALYSIS  /  5指標の目標達成ギャップ", "gap"
  );
}

// ========== ページ6: 課題 ==========

function addIssuePage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "課題", 6, logoBase64);
  addSlideTitle(s, "GAPの根本原因", "なぜ目標との乖離が生じているのか");

  // 上段: 根本原因 TOP3
  const rootY = 2.15;
  const rootH = 2.45;
  const rootW = (12.3 - 0.3) / 3;

  data.issue.root_causes.slice(0, 3).forEach((r, i) => {
    const x = 0.5 + i * (rootW + 0.15);

    s.addShape("rect", {
      x: x, y: rootY, w: rootW, h: rootH,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: rootY, w: rootW, h: 1.0,
      fill: { color: C.text }, line: { color: C.text, width: 0 }
    });

    s.addText(r.rank, {
      x: x + 0.3, y: rootY + 0.1, w: 1.5, h: 0.9,
      fontSize: 48, fontFace: "Arial", bold: true, color: "FFFFFF", margin: 0
    });
    s.addText(r.priority, {
      x: x + rootW - 2.0, y: rootY + 0.3, w: 1.8, h: 0.25,
      fontSize: 9, fontFace: "Meiryo", bold: true,
      color: C.gradAccent, align: "right", margin: 0
    });
    s.addText(r.title, {
      x: x + 1.7, y: rootY + 0.55, w: rootW - 1.9, h: 0.4,
      fontSize: 14, fontFace: "Meiryo", bold: true,
      color: "FFFFFF", valign: "middle", margin: 0
    });
    s.addText(r.description, {
      x: x + 0.25, y: rootY + 1.15, w: rootW - 0.5, h: 0.7,
      fontSize: 9, fontFace: "Meiryo", color: C.dark, margin: 0
    });

    // Impact badges
    const impactY = rootY + rootH - 0.4;
    s.addText("IMPACT", {
      x: x + 0.25, y: impactY - 0.3, w: 1.5, h: 0.2,
      fontSize: 8, fontFace: "Arial", bold: true,
      color: C.primary, charSpacing: 2, margin: 0
    });
    const impacts = r.impact.slice(0, 3);
    const badgeW = (rootW - 0.5 - 0.1 * (impacts.length - 1)) / impacts.length;
    impacts.forEach((imp, idx) => {
      const bx = x + 0.25 + idx * (badgeW + 0.1);
      s.addShape("rect", {
        x: bx, y: impactY, w: badgeW, h: 0.32,
        fill: { color: C.lightBg }, line: { color: C.lightBg, width: 0 }
      });
      s.addText(imp, {
        x: bx + 0.05, y: impactY, w: badgeW - 0.1, h: 0.32,
        fontSize: 8, fontFace: "Meiryo", bold: true, color: C.primary,
        align: "center", valign: "middle", margin: 0
      });
    });
  });

  // 下段: 5指標別の課題
  s.addText("ROOT CAUSES BY KPI  /  指標別の根本原因", {
    x: 0.5, y: 4.75, w: 8, h: 0.3,
    fontSize: 10, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 2, margin: 0
  });

  const kpiY = 4.8;
  const kpiH = 2.1;
  const kpiW = (12.3 - 0.4) / 5;

  data.issue.kpi_issues.slice(0, 5).forEach((cat, i) => {
    const x = 0.5 + i * (kpiW + 0.1);
    const y = kpiY + 0.25;

    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: kpiH - 0.25,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: 0.35,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(cat.category, {
      x: x, y: y, w: kpiW, h: 0.35,
      fontSize: 11, fontFace: "Meiryo", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });

    const issues = cat.issues.slice(0, 2);
    s.addText(
      issues.map((t, idx) => ({
        text: "● " + t,
        options: {
          breakLine: idx < issues.length - 1,
          fontSize: 9, color: C.dark, fontFace: "Meiryo", paraSpaceAfter: 6
        }
      })),
      { x: x + 0.15, y: y + 0.45, w: kpiW - 0.3, h: kpiH - 0.7, margin: 0 }
    );
  });
}

// ========== ページ7: 方針 ==========

function addPolicyPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "方針", 7, logoBase64);
  addSlideTitle(s, data.policy.headline_title, data.policy.headline_subtitle);

  const contentY = 2.2;
  const contentH = 4.6;
  const colW = (12.3 - 0.3) / 2;

  // やること(左)
  const yesX = 0.5;
  s.addShape("rect", {
    x: yesX, y: contentY, w: colW, h: contentH,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x: yesX, y: contentY, w: colW, h: 0.7,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  s.addText("✓  YES  /  やること", {
    x: yesX + 0.3, y: contentY, w: colW - 0.6, h: 0.7,
    fontSize: 18, fontFace: "Meiryo", bold: true, color: "FFFFFF",
    valign: "middle", margin: 0
  });

  const yesItems = data.policy.yes_items.slice(0, 6);
  const yesItemH = (contentH - 0.9) / Math.max(yesItems.length, 1);
  yesItems.forEach((item, i) => {
    const y = contentY + 0.9 + i * yesItemH;
    s.addShape("ellipse", {
      x: yesX + 0.4, y: y + (yesItemH - 0.25) / 2, w: 0.25, h: 0.25,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText("✓", {
      x: yesX + 0.4, y: y + (yesItemH - 0.25) / 2, w: 0.25, h: 0.25,
      fontSize: 10, fontFace: "Arial", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });
    s.addText(item, {
      x: yesX + 0.75, y: y, w: colW - 0.95, h: yesItemH,
      fontSize: 11, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
  });

  // やらないこと(右)
  const noX = yesX + colW + 0.3;
  s.addShape("rect", {
    x: noX, y: contentY, w: colW, h: contentH,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x: noX, y: contentY, w: colW, h: 0.7,
    fill: { color: C.gray }, line: { color: C.gray, width: 0 }
  });
  s.addText("✗  NO  /  やらないこと", {
    x: noX + 0.3, y: contentY, w: colW - 0.6, h: 0.7,
    fontSize: 18, fontFace: "Meiryo", bold: true, color: "FFFFFF",
    valign: "middle", margin: 0
  });

  const noItems = data.policy.no_items.slice(0, 6);
  const noItemH = (contentH - 0.9) / Math.max(noItems.length, 1);
  noItems.forEach((item, i) => {
    const y = contentY + 0.9 + i * noItemH;
    s.addShape("ellipse", {
      x: noX + 0.4, y: y + (noItemH - 0.25) / 2, w: 0.25, h: 0.25,
      fill: { color: C.gray }, line: { color: C.gray, width: 0 }
    });
    s.addText("✗", {
      x: noX + 0.4, y: y + (noItemH - 0.25) / 2, w: 0.25, h: 0.25,
      fontSize: 10, fontFace: "Arial", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });
    s.addText(item, {
      x: noX + 0.75, y: y, w: colW - 0.95, h: noItemH,
      fontSize: 11, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
  });
}

// ========== ページ8: 解決策 ==========

function addSolutionPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "解決策", 8, logoBase64);
  addSlideTitle(s, data.solution.headline_title, data.solution.headline_subtitle);

  const items = data.solution.items.slice(0, 4);
  const contentY = 2.2;
  const contentH = 4.6;

  if (items.length <= 2) {
    // 横並び2カラム
    const colW = (12.3 - 0.3) / 2;
    items.forEach((it, i) => {
      const x = 0.5 + i * (colW + 0.3);
      drawSolutionCard(s, x, contentY, colW, contentH, it, i + 1);
    });
  } else {
    // 2x2グリッド
    const colW = (12.3 - 0.3) / 2;
    const rowH = (contentH - 0.3) / 2;
    items.forEach((it, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.5 + col * (colW + 0.3);
      const y = contentY + row * (rowH + 0.3);
      drawSolutionCard(s, x, y, colW, rowH, it, i + 1);
    });
  }
}

function drawSolutionCard(
  s: pptxgen.Slide,
  x: number, y: number, w: number, h: number,
  it: { title: string; detail: string },
  num: number
) {
  s.addShape("rect", {
    x, y, w, h,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addShape("rect", {
    x, y, w: 0.08, h,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  // 番号
  s.addShape("ellipse", {
    x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6,
    fill: { color: C.primary }, line: { color: C.primary, width: 0 }
  });
  s.addText(String(num), {
    x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6,
    fontSize: 22, fontFace: "Arial", bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0
  });
  // タイトル
  s.addText(it.title, {
    x: x + 1.1, y: y + 0.3, w: w - 1.3, h: 0.55,
    fontSize: 16, fontFace: "Meiryo", bold: true, color: C.text,
    valign: "middle", margin: 0
  });
  // 詳細
  s.addText(it.detail, {
    x: x + 0.3, y: y + 1.05, w: w - 0.6, h: h - 1.3,
    fontSize: 11, fontFace: "Meiryo", color: C.dark,
    valign: "top", margin: 0
  });
}

// ========== ページ9: 来月アクション ==========

function addActionPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "来月アクション", 9, logoBase64);
  addSlideTitle(s, data.next_action.headline_title, data.next_action.headline_subtitle);

  // 上段: 最優先アクション
  const tp = data.next_action.top_priority;
  s.addShape("rect", {
    x: 0.5, y: 2.2, w: 12.3, h: 1.25,
    fill: { color: C.gradEnd }, line: { color: C.gradEnd, width: 0 }
  });
  s.addText("TOP PRIORITY", {
    x: 0.8, y: 2.3, w: 3, h: 0.3,
    fontSize: 11, fontFace: "Arial", bold: true,
    color: C.gradAccent, charSpacing: 3, margin: 0
  });
  s.addText(tp.title, {
    x: 0.8, y: 2.55, w: 12, h: 0.5,
    fontSize: 20, fontFace: "Meiryo", bold: true, color: "FFFFFF", margin: 0
  });
  s.addText([
    { text: "担当: ", options: { fontSize: 10, color: C.gradAccent, fontFace: "Meiryo" } },
    { text: tp.owner + "  |  ", options: { fontSize: 10, color: "FFFFFF", fontFace: "Meiryo" } },
    { text: "期限: ", options: { fontSize: 10, color: C.gradAccent, fontFace: "Meiryo" } },
    { text: tp.deadline + "  |  ", options: { fontSize: 10, color: "FFFFFF", fontFace: "Meiryo" } },
    { text: "期待効果: ", options: { fontSize: 10, color: C.gradAccent, fontFace: "Meiryo" } },
    { text: tp.impact, options: { fontSize: 10, color: "FFFFFF", fontFace: "Meiryo" } },
  ], { x: 0.8, y: 3.05, w: 12, h: 0.3, margin: 0 });

  // 下段: タイムライン
  s.addText("TIMELINE  /  タイムライン", {
    x: 0.5, y: 3.7, w: 8, h: 0.3,
    fontSize: 10, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 2, margin: 0
  });

  const timelineY = 4.05;
  const timelineH = 2.8;
  const timeline = data.next_action.timeline.slice(0, 6);

  s.addShape("rect", {
    x: 0.5, y: timelineY, w: 12.3, h: timelineH,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });

  const itemH = timelineH / Math.max(timeline.length, 1);
  timeline.forEach((t, i) => {
    const y = timelineY + i * itemH;

    // 日付バッジ
    s.addShape("rect", {
      x: 0.7, y: y + (itemH - 0.4) / 2, w: 1.5, h: 0.4,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(t.when, {
      x: 0.7, y: y + (itemH - 0.4) / 2, w: 1.5, h: 0.4,
      fontSize: 11, fontFace: "Arial", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });
    // タスク
    s.addText(t.what, {
      x: 2.4, y: y, w: 10.2, h: itemH,
      fontSize: 12, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
    // 区切り線
    if (i < timeline.length - 1) {
      s.addShape("line", {
        x: 0.7, y: y + itemH, w: 11.9, h: 0,
        line: { color: C.border, width: 0.5 }
      });
    }
  });
}

// ========== ページ10: サマリー ==========

function addSummaryPage(pres: pptxgen, data: MonthlyReportData, logoBase64: string) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeaderFooter(s, "KPIサマリー", 10, logoBase64);
  addSlideTitle(s, "来月の重点KPIと期待成果", "各施策実行時の月末到達目標");

  // 左:KPI一覧、右:期待成果
  const leftW = 8.0;
  const rightW = 4.3;
  const contentY = 2.2;
  const contentH = 4.6;

  // 左:KPI一覧
  s.addShape("rect", {
    x: 0.5, y: contentY, w: leftW, h: contentH,
    fill: { color: C.bg }, line: { color: C.border, width: 1 }
  });
  s.addText("重点KPI", {
    x: 0.7, y: contentY + 0.2, w: 7, h: 0.3,
    fontSize: 13, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
  });

  // すべての現状KPIから重要そうなもの5つを抜粋
  const allKpis: Array<{ name: string; target: string; actual: string; status: string }> = [];
  data.current.kpis.forEach(cat => {
    cat.items.forEach(it => {
      allKpis.push({
        name: it.name,
        target: it.target,
        actual: it.actual,
        status: it.status
      });
    });
  });
  const topKpis = allKpis.slice(0, 7);

  // ヘッダー
  const headerY = contentY + 0.65;
  const col1X = 0.7, col2X = 3.3, col3X = 5.3, col4X = 7.0;
  s.addShape("rect", {
    x: 0.5, y: headerY, w: leftW, h: 0.4,
    fill: { color: C.lightBg }, line: { color: C.lightBg, width: 0 }
  });
  s.addText("KPI", {
    x: col1X, y: headerY, w: 2.5, h: 0.4,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: C.primary,
    valign: "middle", margin: 0
  });
  s.addText("目標", {
    x: col2X, y: headerY, w: 2, h: 0.4,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: C.primary,
    valign: "middle", margin: 0
  });
  s.addText("実績", {
    x: col3X, y: headerY, w: 1.7, h: 0.4,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: C.primary,
    valign: "middle", margin: 0
  });
  s.addText("状態", {
    x: col4X, y: headerY, w: 1.3, h: 0.4,
    fontSize: 10, fontFace: "Meiryo", bold: true, color: C.primary,
    valign: "middle", margin: 0
  });

  const rowH = 0.42;
  topKpis.forEach((kpi, i) => {
    const y = headerY + 0.4 + i * rowH;
    s.addText(kpi.name, {
      x: col1X, y, w: 2.5, h: rowH,
      fontSize: 10, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
    s.addText(kpi.target, {
      x: col2X, y, w: 2, h: rowH,
      fontSize: 10, fontFace: "Meiryo", bold: true, color: C.text,
      valign: "middle", margin: 0
    });
    s.addText(kpi.actual, {
      x: col3X, y, w: 1.7, h: rowH,
      fontSize: 10, fontFace: "Meiryo", color: C.dark,
      valign: "middle", margin: 0
    });
    const statusColor = getStatusColor(kpi.status as "success" | "warning" | "danger");
    s.addShape("ellipse", {
      x: col4X + 0.05, y: y + (rowH - 0.2) / 2, w: 0.2, h: 0.2,
      fill: { color: statusColor }, line: { color: statusColor, width: 0 }
    });
  });

  // 右:期待成果
  const rightX = 0.5 + leftW + 0.2;
  s.addShape("rect", {
    x: rightX, y: contentY, w: rightW, h: contentH,
    fill: { color: C.gradEnd }, line: { color: C.gradEnd, width: 0 }
  });
  s.addText("EXPECTED OUTCOME", {
    x: rightX + 0.3, y: contentY + 0.3, w: rightW - 0.6, h: 0.3,
    fontSize: 10, fontFace: "Arial", bold: true,
    color: C.gradAccent, charSpacing: 3, margin: 0
  });
  s.addText("来月末の期待成果", {
    x: rightX + 0.3, y: contentY + 0.65, w: rightW - 0.6, h: 0.4,
    fontSize: 16, fontFace: "Meiryo", bold: true, color: "FFFFFF", margin: 0
  });

  s.addText(data.next_action.top_priority.impact, {
    x: rightX + 0.3, y: contentY + 1.3, w: rightW - 0.6, h: 1.5,
    fontSize: 13, fontFace: "Meiryo", color: "FFFFFF", margin: 0
  });

  s.addShape("line", {
    x: rightX + 0.3, y: contentY + 3.2, w: rightW - 0.6, h: 0,
    line: { color: "FFFFFF", width: 0.5 }
  });

  s.addText("持続可能な成長への転換を加速", {
    x: rightX + 0.3, y: contentY + 3.4, w: rightW - 0.6, h: 0.6,
    fontSize: 12, fontFace: "Meiryo", bold: true, color: "FFFFFF", margin: 0
  });

  s.addShape("rect", {
    x: rightX + 0.3, y: contentY + 4.15, w: rightW - 0.6, h: 0.4,
    fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 }
  });
  s.addText("全社一丸で取り組む", {
    x: rightX + 0.3, y: contentY + 4.15, w: rightW - 0.6, h: 0.4,
    fontSize: 11, fontFace: "Meiryo", bold: true, color: C.gradEnd,
    align: "center", valign: "middle", margin: 0
  });
}

// ========== 5カテゴリKPIカードグリッド(共通) ==========

function addKpiCardsGrid(
  s: pptxgen.Slide,
  kpis: MonthlyReportData["current"]["kpis"] | MonthlyReportData["gap"]["kpis"],
  labelText: string,
  mode: "current" | "gap"
) {
  const kpiY = 4.3;
  const kpiH = 2.55;
  const kpiW = (12.3 - 0.4) / 5;

  s.addText(labelText, {
    x: 0.5, y: 4.25, w: 8, h: 0.3,
    fontSize: 10, fontFace: "Arial", bold: true,
    color: C.primary, charSpacing: 2, margin: 0
  });

  kpis.slice(0, 5).forEach((cat, i) => {
    const x = 0.5 + i * (kpiW + 0.1);
    const y = kpiY + 0.2;

    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: kpiH - 0.2,
      fill: { color: C.bg }, line: { color: C.border, width: 1 }
    });
    s.addShape("rect", {
      x: x, y: y, w: kpiW, h: 0.35,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }
    });
    s.addText(cat.category, {
      x: x, y: y, w: kpiW, h: 0.35,
      fontSize: 11, fontFace: "Meiryo", bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0
    });

    const items = cat.items.slice(0, 2);
    const itemStartY = y + 0.45;
    const availH = kpiH - 0.2 - 0.5;
    const itemH = availH / Math.max(items.length, 1);

    items.forEach((it, idx) => {
      const iy = itemStartY + idx * itemH;
      const statusColor = getStatusColor(it.status as "success" | "warning" | "danger");

      s.addText(it.name, {
        x: x + 0.15, y: iy + 0.02, w: kpiW - 0.3, h: 0.22,
        fontSize: 8.5, fontFace: "Meiryo", color: C.gray, margin: 0
      });

      if (mode === "current") {
        const currentItem = it as { name: string; target: string; actual: string; rate: string; status: string };
        s.addText(currentItem.actual, {
          x: x + 0.15, y: iy + 0.22, w: kpiW - 0.3, h: 0.3,
          fontSize: 12, fontFace: "Meiryo", bold: true, color: C.text, margin: 0
        });
        s.addText([
          { text: "目標 ", options: { fontSize: 7.5, color: C.gray, fontFace: "Meiryo" } },
          { text: currentItem.target, options: { fontSize: 7.5, color: C.dark, fontFace: "Meiryo" } },
        ], { x: x + 0.15, y: iy + 0.54, w: kpiW - 0.3, h: 0.2, margin: 0 });

        if (currentItem.rate && currentItem.rate !== "-" && currentItem.rate !== "—") {
          s.addShape("rect", {
            x: x + kpiW - 0.75, y: iy + 0.3, w: 0.6, h: 0.22,
            fill: { color: statusColor }, line: { color: statusColor, width: 0 }
          });
          s.addText(currentItem.rate, {
            x: x + kpiW - 0.75, y: iy + 0.3, w: 0.6, h: 0.22,
            fontSize: 8, fontFace: "Arial", bold: true, color: "FFFFFF",
            align: "center", valign: "middle", margin: 0
          });
        } else {
          s.addShape("ellipse", {
            x: x + kpiW - 0.3, y: iy + 0.35, w: 0.15, h: 0.15,
            fill: { color: statusColor }, line: { color: statusColor, width: 0 }
          });
        }
      } else {
        // gap モード(プログレスバー付き)
        const gapItem = it as { name: string; gap: string; rate: number; status: string };
        s.addText(gapItem.gap, {
          x: x + 0.15, y: iy + 0.22, w: kpiW - 0.3, h: 0.3,
          fontSize: 13, fontFace: "Meiryo", bold: true, color: statusColor, margin: 0
        });

        const barY = iy + 0.54;
        const barW = kpiW - 0.3;
        const barH = 0.1;
        s.addShape("rect", {
          x: x + 0.15, y: barY, w: barW, h: barH,
          fill: { color: C.border }, line: { color: C.border, width: 0 }
        });
        const fillRate = Math.min(gapItem.rate || 0, 100) / 100;
        if (fillRate > 0) {
          s.addShape("rect", {
            x: x + 0.15, y: barY, w: barW * fillRate, h: barH,
            fill: { color: statusColor }, line: { color: statusColor, width: 0 }
          });
        }
        s.addShape("line", {
          x: x + 0.15 + barW, y: barY - 0.03, w: 0, h: barH + 0.06,
          line: { color: C.primary, width: 1 }
        });
        const rateText = `${gapItem.rate || 0}%`;
        s.addText(rateText, {
          x: x + 0.15, y: iy + 0.68, w: kpiW - 0.3, h: 0.2,
          fontSize: 8, fontFace: "Arial", bold: true, color: statusColor, margin: 0
        });
      }

      if (idx < items.length - 1) {
        s.addShape("line", {
          x: x + 0.15, y: iy + itemH - 0.02, w: kpiW - 0.3, h: 0,
          line: { color: C.border, width: 0.5 }
        });
      }
    });
  });
}

// ========== サマリー関数(エグゼクティブサマリー用) ==========

function getGoalTitle(data: MonthlyReportData): string {
  const p = data.goal.pillars;
  if (p.length === 0) return "今期の目指す姿";
  return p.map(pp => pp.metric).join(" / ");
}

function summarizeGoal(data: MonthlyReportData): string {
  const pillars = data.goal.pillars.slice(0, 3);
  return pillars.map(p => `${p.title}: ${p.metric}`).join("。");
}

function summarizeCurrent(data: MonthlyReportData): string {
  const pillars = data.current.pillars.slice(0, 3);
  return pillars.map(p => `${p.title}: ${p.actual_value}${p.unit}`).join("。");
}

function summarizeGap(data: MonthlyReportData): string {
  const pillars = data.gap.pillars.slice(0, 3);
  return pillars.map(p => `${p.title} ${p.gap}${p.gap_unit}`).join(" / ");
}

function summarizeIssue(data: MonthlyReportData): string {
  const causes = data.issue.root_causes.slice(0, 3);
  return causes.map((c, i) => `${i + 1}. ${c.title}`).join(" / ");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}
