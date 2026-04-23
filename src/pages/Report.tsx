import { useState, useCallback, useRef, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useReportData } from "@/hooks/useReportData";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { CURRENT_MONTH, ORG_ID } from "@/lib/fiscalYear";
import { SGA_CATEGORY_NAMES } from "@/hooks/useManagementData";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, Sparkles, Loader2, FileText, Presentation } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

const N8N_WEBHOOK_URL = "https://offbeat-inc.app.n8n.cloud/webhook/wf06-report-generate";

/* ── Helpers ── */
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

function getDefaultMonth(): string {
  return prevMonth(CURRENT_MONTH);
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const [cy, cm] = CURRENT_MONTH.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    let m = cm - i;
    let y = cy;
    while (m <= 0) { m += 12; y -= 1; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    options.push({ value: ym, label: `${y}年${m}月` });
  }
  return options;
}

const fmtCurrency = (v: number, unit: string) => {
  if (unit === "万円") return `¥${(v / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万`;
  return `¥${Math.round(v).toLocaleString()}`;
};

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const fmtRate = (v: number) => `${v.toFixed(1)}%`;

const colorClass = (actual: number, target: number, higherIsBetter = true) => {
  if (target === 0) return "";
  return higherIsBetter
    ? actual >= target ? "text-green-600" : "text-destructive"
    : actual <= target ? "text-green-600" : "text-destructive";
};

const momColorClass = (v: number) => v > 0 ? "text-green-600" : v < 0 ? "text-destructive" : "";
const negativeClass = (v: number) => v < 0 ? "text-destructive font-semibold" : "";
const diffColorClass = (v: number) => v > 0 ? "text-green-600" : v < 0 ? "text-destructive" : "";

const fmtDiff = (v: number, unit: string) => {
  const prefix = v > 0 ? "+" : "";
  return `${prefix}${fmtCurrency(v, unit)}`;
};

const fmtGeneratedAt = (iso: string | null): string => {
  if (!iso) return "未生成";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "未生成";
  // Convert to JST
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}年${mo}月${day}日 ${h}:${min}`;
};

/* ── Main ── */
const Report = () => {
  usePageTitle("月次レポート");
  const [selectedYm, setSelectedYm] = useState(getDefaultMonth);
  const { unit } = useCurrencyUnit();
  const { isLoading, isError, managementData: mgmt, financeData: fin, productivityData: prod, customersData: cust, qualityData: qual } = useReportData(selectedYm);

  const monthOptions = generateMonthOptions();
  const ymLabel = (() => {
    const [y, m] = selectedYm.split("-").map(Number);
    return `${y}年${m}月`;
  })();

  // AI report state
  const [analysisContent, setAnalysisContent] = useState("");
  const [actionContent, setActionContent] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<string | null>(null);
  const [actionGeneratedAt, setActionGeneratedAt] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  // Load cached reports when month changes
  useEffect(() => {
    let cancelled = false;
    const loadCache = async () => {
      const { data } = await supabase
        .from("report_cache")
        .select("report_type, report_content, generated_at")
        .eq("org_id", ORG_ID)
        .eq("year_month", selectedYm)
        .in("report_type", ["analysis", "action"]);
      if (cancelled || !data) return;
      const analysis = data.find((r) => r.report_type === "analysis");
      const action = data.find((r) => r.report_type === "action");
      setAnalysisContent(analysis?.report_content ?? "");
      setAnalysisGeneratedAt(analysis?.generated_at ?? null);
      setActionContent(action?.report_content ?? "");
      setActionGeneratedAt(action?.generated_at ?? null);
    };
    loadCache();
    return () => { cancelled = true; };
  }, [selectedYm]);

  const upsertCache = useCallback(async (reportType: string, content: string) => {
    const now = new Date().toISOString();
    await supabase.from("report_cache").upsert(
      { org_id: ORG_ID, year_month: selectedYm, report_type: reportType, report_content: content, generated_at: now },
      { onConflict: "org_id,year_month,report_type" }
    );
    return now;
  }, [selectedYm]);

  const callN8nWebhook = useCallback(async (reportType: "analysis" | "action"): Promise<string> => {
    const resp = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year_month: selectedYm, report_type: reportType }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "Unknown error");
      throw new Error(`Webhook error (${resp.status}): ${text}`);
    }
    const json = await resp.json();
    if (!json.report) throw new Error("レスポンスにreportフィールドがありません");
    return json.report as string;
  }, [selectedYm]);

  const handleGenerateAnalysis = useCallback(async () => {
    setAnalysisContent("");
    setAnalysisLoading(true);
    try {
      const report = await callN8nWebhook("analysis");
      setAnalysisContent(report);
      const ts = await upsertCache("analysis", report);
      setAnalysisGeneratedAt(ts);
    } catch (e: any) {
      toast.error(e.message || "分析レポートの生成に失敗しました");
    } finally {
      setAnalysisLoading(false);
    }
  }, [callN8nWebhook, upsertCache]);

  const handleGenerateAction = useCallback(async () => {
    if (!analysisContent) {
      toast.error("先に「数値評価・課題分析」タブで分析レポートを生成してください");
      return;
    }
    setActionContent("");
    setActionLoading(true);
    try {
      const report = await callN8nWebhook("action");
      setActionContent(report);
      const ts = await upsertCache("action", report);
      setActionGeneratedAt(ts);
    } catch (e: any) {
      toast.error(e.message || "アクション提案の生成に失敗しました");
    } finally {
      setActionLoading(false);
    }
  }, [analysisContent, callN8nWebhook, upsertCache]);

  const handleExportPdf = useCallback(async () => {
    if (!analysisContent && !actionContent) {
      toast.error("先にレポートを生成してください");
      return;
    }
    toast.info("PDF生成中...");
    const html2pdf = (await import("html2pdf.js")).default;
    const { marked } = await import("marked");
    const container = document.createElement("div");
    container.style.padding = "24px";
    container.style.fontFamily = "sans-serif";
    container.style.fontSize = "12px";
    container.style.lineHeight = "1.6";

    if (analysisContent) {
      const sec1 = document.createElement("div");
      sec1.innerHTML = `<h1 style="font-size:18px;margin-bottom:16px">数値評価・課題分析 - ${ymLabel}</h1>`;
      const md1 = document.createElement("div");
      md1.innerHTML = await marked(analysisContent) as string;
      sec1.appendChild(md1);
      container.appendChild(sec1);
    }

    if (actionContent) {
      if (analysisContent) {
        const pageBreak = document.createElement("div");
        pageBreak.style.pageBreakBefore = "always";
        container.appendChild(pageBreak);
      }
      const sec2 = document.createElement("div");
      sec2.innerHTML = `<h1 style="font-size:18px;margin-bottom:16px">解決策・来月アクション - ${ymLabel}</h1>`;
      const md2 = document.createElement("div");
      md2.innerHTML = await marked(actionContent) as string;
      sec2.appendChild(md2);
      container.appendChild(sec2);
    }

    html2pdf()
      .set({
        margin: 10,
        filename: `Off Beat_月次レポート_${selectedYm}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(container)
      .save()
      .then(() => toast.success("PDFを保存しました"))
      .catch(() => toast.error("PDF生成に失敗しました"));
  }, [ymLabel, selectedYm, analysisContent, actionContent]);

  const handleExportPptx = useCallback(async () => {
    toast.info("PPTX生成中...");
    try {
      // 1. Fetch both reports from report_cache
      const { data } = await supabase
        .from("report_cache")
        .select("report_type, report_content")
        .eq("org_id", ORG_ID)
        .eq("year_month", selectedYm)
        .in("report_type", ["analysis", "action"]);

      const analysisReport = data?.find((r) => r.report_type === "analysis")?.report_content;
      const actionReport = data?.find((r) => r.report_type === "action")?.report_content;

      if (!analysisReport && !actionReport) {
        toast.error("先にレポートを生成してください");
        return;
      }

      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_16x9";

      // ── Color palette ──
      const C = {
        black: "000000", dark: "1A1A1A", accent: "FF4500", orange: "FF6B00",
        white: "FFFFFF", offWhite: "F8F8F8", lightGray: "E8E8E8",
        midGray: "999999", darkText: "1A1A1A", bodyText: "4A4A4A",
        green: "16A34A", red: "DC2626", yellow: "D97706", teal: "0D9488",
      };
      const FONT = "Arial";

      const [yNum, mNum] = selectedYm.split("-").map(Number);
      const ymDisplayLabel = `${yNum}年${mNum}月度`;

      // ── Markdown parser ──
      type PptxSlide = { title: string; blocks: SlideBlock[] };
      type SlideBlock =
        | { type: "text"; text: string; bold?: boolean }
        | { type: "h3"; text: string }
        | { type: "bullet"; items: { text: string; bold?: boolean }[] }
        | { type: "table"; headers: string[]; rows: string[][] }
        | { type: "quote"; text: string };

      function parseMarkdownToSlides(md: string): PptxSlide[] {
        const sections = md.split(/(?=^## )/gm).filter((s) => s.trim());
        const slides: PptxSlide[] = [];

        for (const section of sections) {
          const lines = section.split("\n");
          const title = lines[0].replace(/^#+\s*/, "").trim();
          const blocks: SlideBlock[] = [];
          let i = 1;

          while (i < lines.length) {
            const line = lines[i];

            // Table detection
            if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s-:|]+\|/)) {
              const headerLine = line;
              i++; // skip separator
              i++;
              const headers = headerLine.split("|").map((c) => c.trim()).filter(Boolean);
              const rows: string[][] = [];
              while (i < lines.length && lines[i].includes("|") && !lines[i].match(/^#{1,3}\s/)) {
                const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
                rows.push(cells);
                i++;
              }
              blocks.push({ type: "table", headers, rows });
              continue;
            }

            // H3
            if (line.match(/^### /)) {
              blocks.push({ type: "h3", text: line.replace(/^###\s*/, "").replace(/\*\*/g, "") });
              i++;
              continue;
            }

            // Blockquote
            if (line.match(/^>\s/)) {
              const quoteLines: string[] = [];
              while (i < lines.length && lines[i].match(/^>\s?/)) {
                quoteLines.push(lines[i].replace(/^>\s?/, ""));
                i++;
              }
              blocks.push({ type: "quote", text: quoteLines.join("\n").replace(/\*\*/g, "") });
              continue;
            }

            // Bullet
            if (line.match(/^[-*•]\s/)) {
              const items: { text: string; bold?: boolean }[] = [];
              while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
                const raw = lines[i].replace(/^[-*•]\s*/, "");
                const hasBold = raw.includes("**");
                items.push({ text: raw.replace(/\*\*/g, ""), bold: hasBold });
                i++;
              }
              blocks.push({ type: "bullet", items });
              continue;
            }

            // Regular text
            if (line.trim()) {
              const hasBold = line.includes("**");
              blocks.push({ type: "text", text: line.replace(/\*\*/g, ""), bold: hasBold });
            }
            i++;
          }

          slides.push({ title, blocks });
        }
        return slides;
      }

      // ── Slide helpers ──
      function addDarkSlide(pptx: InstanceType<typeof PptxGenJS>): ReturnType<typeof pptx.addSlide> {
        const s = pptx.addSlide();
        s.background = { color: C.dark };
        return s;
      }

      function addContentSlide(pptx: InstanceType<typeof PptxGenJS>, title: string, blocks: SlideBlock[]) {
        const s = pptx.addSlide();
        // Header: orange bar + title
        s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.35, w: 0.08, h: 0.5, fill: { color: C.accent } });
        s.addText(title, { x: 0.6, y: 0.3, w: 7, h: 0.6, fontSize: 18, bold: true, italic: true, color: C.darkText, fontFace: FONT });
        // Right top: company name
        s.addText("Off Beat Inc.", { x: 7.5, y: 0.3, w: 2, h: 0.4, fontSize: 9, color: C.midGray, align: "right", fontFace: FONT });
        // Footer
        s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 6.85, w: 9.2, h: 0.01, fill: { color: C.lightGray } });
        s.addText("©Off Beat Inc. All Rights Reserved.", { x: 0.4, y: 6.9, w: 9.2, h: 0.3, fontSize: 7, color: C.midGray, fontFace: FONT });

        let curY = 1.1;
        const maxY = 6.7;
        const leftX = 0.5;
        const contentW = 9;

        for (const block of blocks) {
          if (curY >= maxY) break;

          if (block.type === "h3") {
            s.addText(block.text, { x: leftX, y: curY, w: contentW, h: 0.35, fontSize: 14, bold: true, color: C.darkText, fontFace: FONT });
            curY += 0.4;
          } else if (block.type === "text") {
            s.addText(block.text, { x: leftX, y: curY, w: contentW, h: 0.28, fontSize: 11, color: C.bodyText, fontFace: FONT, bold: block.bold });
            curY += 0.3;
          } else if (block.type === "bullet") {
            const bulletTexts = block.items.map((item) => ({
              text: item.text,
              options: { fontSize: 11, color: C.bodyText, fontFace: FONT, bold: item.bold || false, bullet: true as const, lineSpacing: 18 },
            }));
            const bH = Math.min(block.items.length * 0.28, maxY - curY);
            s.addText(bulletTexts, { x: leftX, y: curY, w: contentW, h: bH, valign: "top" });
            curY += bH + 0.1;
          } else if (block.type === "table") {
            const headerRow = block.headers.map((h) => ({
              text: h, options: { fontSize: 9, bold: true, color: C.white, fill: { color: C.black }, fontFace: FONT, align: "left" as const },
            }));
            const dataRows = block.rows.map((row) =>
              row.map((cell) => ({
                text: cell,
                options: { fontSize: 9, color: C.darkText, fontFace: FONT, align: "left" as const },
              }))
            );
            const colW = contentW / block.headers.length;
            const tH = Math.min((block.rows.length + 1) * 0.3, maxY - curY);
            s.addTable([headerRow, ...dataRows], {
              x: leftX, y: curY, w: contentW, h: tH,
              colW: Array(block.headers.length).fill(colW),
              border: { pt: 0.5, color: C.lightGray },
              rowH: 0.28,
              autoPage: false,
            });
            curY += tH + 0.15;
          } else if (block.type === "quote") {
            const qH = Math.min(0.6, maxY - curY);
            s.addShape(pptx.ShapeType.rect, { x: leftX, y: curY, w: contentW, h: qH, fill: { color: C.offWhite } });
            s.addShape(pptx.ShapeType.rect, { x: leftX, y: curY, w: 0.06, h: qH, fill: { color: C.accent } });
            s.addText(block.text, { x: leftX + 0.2, y: curY + 0.05, w: contentW - 0.3, h: qH - 0.1, fontSize: 10, italic: true, color: C.bodyText, fontFace: FONT, valign: "top" });
            curY += qH + 0.15;
          }
        }
      }

      function addSectionDivider(pptx: InstanceType<typeof PptxGenJS>, num: string, title: string) {
        const s = addDarkSlide(pptx);
        s.addShape(pptx.ShapeType.rect, { x: 1.2, y: 2.8, w: 0.08, h: 1.2, fill: { color: C.accent } });
        s.addText(`${num} | ${title}`, { x: 1.5, y: 2.8, w: 7, h: 1.2, fontSize: 28, bold: true, color: C.white, fontFace: FONT, valign: "middle" });
      }

      // ══════════════════════════════════════
      // SLIDE 1 – Cover (dark)
      // ══════════════════════════════════════
      const cover = addDarkSlide(pptx);
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0.6, w: 10, h: 0.05, fill: { color: C.accent } });
      cover.addText("Off Beat Inc.", { x: 0.5, y: 2.0, w: 9, h: 0.6, fontSize: 16, color: C.midGray, fontFace: FONT, align: "center" });
      cover.addText("月次経営分析レポート", { x: 0.5, y: 2.7, w: 9, h: 1.0, fontSize: 32, bold: true, color: C.white, fontFace: FONT, align: "center" });
      cover.addText(ymDisplayLabel, { x: 0.5, y: 3.8, w: 9, h: 0.6, fontSize: 18, color: C.midGray, fontFace: FONT, align: "center" });
      cover.addText("• • • • •", { x: 7, y: 6.2, w: 2.5, h: 0.4, fontSize: 14, color: C.midGray, fontFace: FONT, align: "right" });

      // ══════════════════════════════════════
      // PART 2 – Analysis (if available)
      // ══════════════════════════════════════
      if (analysisReport) {
        addSectionDivider(pptx, "01", "数値評価・課題分析");
        const analysisSlides = parseMarkdownToSlides(analysisReport);
        for (const sl of analysisSlides) {
          addContentSlide(pptx, sl.title, sl.blocks);
        }
      }

      // ══════════════════════════════════════
      // PART 3 – Action (if available)
      // ══════════════════════════════════════
      if (actionReport) {
        addSectionDivider(pptx, analysisReport ? "02" : "01", "解決策・来月アクション");
        const actionSlides = parseMarkdownToSlides(actionReport);
        for (const sl of actionSlides) {
          addContentSlide(pptx, sl.title, sl.blocks);
        }
      }

      // ══════════════════════════════════════
      // CLOSING SLIDE
      // ══════════════════════════════════════
      const closing = addDarkSlide(pptx);
      closing.addShape(pptx.ShapeType.rect, { x: 0, y: 0.6, w: 10, h: 0.05, fill: { color: C.accent } });
      closing.addText("Off Beat Inc.", { x: 0.5, y: 2.8, w: 9, h: 0.6, fontSize: 20, color: C.white, fontFace: FONT, align: "center", bold: true });
      const today = new Date();
      const reportDate = `報告日: ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
      closing.addText(reportDate, { x: 0.5, y: 3.6, w: 9, h: 0.4, fontSize: 12, color: C.midGray, fontFace: FONT, align: "center" });
      closing.addText("• • • • •", { x: 7, y: 6.2, w: 2.5, h: 0.4, fontSize: 14, color: C.midGray, fontFace: FONT, align: "right" });

      await pptx.writeFile({ fileName: `Off Beat_月次レポート_${selectedYm}.pptx` });
      toast.success("PPTXを保存しました");
    } catch (e: any) {
      console.error("PPTX generation error:", e);
      toast.error("PPTX生成に失敗しました");
    }
  }, [selectedYm]);

  const activeReportContent = analysisContent || actionContent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-muted-foreground text-sm">読み込み中...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-destructive text-sm">データの取得に失敗しました</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <PageHeader title="月次レポート" description="経営指標の振り返りと改善提案" />
        <Select value={selectedYm} onValueChange={setSelectedYm}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="management" className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="flex-wrap h-auto gap-0.5">
            {/* データ閲覧タブ */}
            <TabsTrigger value="management">経営指標</TabsTrigger>
            <TabsTrigger value="finance">財務指標</TabsTrigger>
            <TabsTrigger value="productivity">生産性指標</TabsTrigger>
            <TabsTrigger value="customers">顧客指標</TabsTrigger>
            <TabsTrigger value="quality">品質指標</TabsTrigger>
            {/* 区切り */}
            <Separator orientation="vertical" className="h-6 mx-1.5" />
            {/* AI分析タブ */}
            <TabsTrigger
              value="analysis"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 data-[state=active]:dark:bg-blue-600"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              数値評価・課題分析
            </TabsTrigger>
            <TabsTrigger
              value="action"
              className="data-[state=active]:bg-orange-500 data-[state=active]:text-white bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 data-[state=active]:dark:bg-orange-600"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              解決策・来月アクション
            </TabsTrigger>
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!activeReportContent}>
                <Download className="h-4 w-4 mr-1.5" />
                レポート生成
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportPdf()}>
                <FileText className="h-4 w-4 mr-2" />
                PDFで保存（全レポート）
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPptx()}>
                <Presentation className="h-4 w-4 mr-2" />
                PPTXで保存（全レポート）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Tab 1: Management ── */}
        <TabsContent value="management" className="space-y-6">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">■ 売上</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>指標</TableHead>
                  <TableHead className="text-right">目標</TableHead>
                  <TableHead className="text-right">実績</TableHead>
                  <TableHead className="text-right">達成率</TableHead>
                  <TableHead className="text-right">前月比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">売上</TableCell>
                  <TableCell className="text-right">{fmtCurrency(mgmt.revenueTarget, unit)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(mgmt.revenue, mgmt.revenueTarget))}>{fmtCurrency(mgmt.revenue, unit)}</TableCell>
                  <TableCell className={cn("text-right", colorClass(mgmt.revenueAchievementRate, 100))}>{mgmt.revenueAchievementRate}%</TableCell>
                  <TableCell className={cn("text-right", momColorClass(mgmt.revenueMom))}>{fmtPct(mgmt.revenueMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">粗利</TableCell>
                  <TableCell className="text-right">{fmtCurrency(mgmt.grossProfitTarget, unit)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(mgmt.grossProfit, mgmt.grossProfitTarget))}>{fmtCurrency(mgmt.grossProfit, unit)}</TableCell>
                  <TableCell className={cn("text-right", colorClass(mgmt.grossProfitAchievementRate, 100))}>{mgmt.grossProfitAchievementRate}%</TableCell>
                  <TableCell className={cn("text-right", momColorClass(mgmt.grossProfitMom))}>{fmtPct(mgmt.grossProfitMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">粗利率</TableCell>
                  <TableCell className="text-right">70.0%</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(mgmt.grossProfitRate, 70))}>{fmtRate(mgmt.grossProfitRate)}</TableCell>
                  <TableCell className={cn("text-right", colorClass(mgmt.grossProfitRate, 70))}>{mgmt.grossProfitRate >= 70 ? "達成" : "未達"}</TableCell>
                  <TableCell className={cn("text-right", momColorClass(mgmt.grossProfitRateMom))}>{fmtPct(mgmt.grossProfitRateMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">営業利益</TableCell>
                  <TableCell className="text-right">{fmtCurrency(mgmt.opTarget, unit)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(mgmt.operatingProfit, mgmt.opTarget))}>{fmtCurrency(mgmt.operatingProfit, unit)}</TableCell>
                  <TableCell className={cn("text-right", colorClass(mgmt.opAchievementRate, 100))}>{mgmt.opAchievementRate}%</TableCell>
                  <TableCell className={cn("text-right", momColorClass(mgmt.opMom))}>{fmtPct(mgmt.opMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">営業利益率</TableCell>
                  <TableCell className="text-right">20.0%</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(mgmt.opRate, 20))}>{fmtRate(mgmt.opRate)}</TableCell>
                  <TableCell className={cn("text-right", colorClass(mgmt.opRate, 20))}>{mgmt.opRate >= 20 ? "達成" : "未達"}</TableCell>
                  <TableCell className={cn("text-right", momColorClass(mgmt.opRateMom))}>{fmtPct(mgmt.opRateMom)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">■ 販管費内訳</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>大項目</TableHead>
                  <TableHead className="text-right">予算</TableHead>
                  <TableHead className="text-right">実績</TableHead>
                  <TableHead className="text-right">差異</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SGA_CATEGORY_NAMES.map((cat) => {
                  const budget = mgmt.sgaBudget[cat] ?? 0;
                  const actual = mgmt.sgaCategoryBreakdown[cat] ?? 0;
                  const diff = budget - actual;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(budget, unit)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(actual, unit)}</TableCell>
                      <TableCell className={cn("text-right", diff >= 0 ? "text-green-600" : "text-destructive")}>
                        {fmtCurrency(diff, unit)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab 2: Finance ── */}
        <TabsContent value="finance" className="space-y-6">
          {!fin.hasData ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
              <p className="text-muted-foreground">財務データ未登録</p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-lg shadow-sm border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">■ キャッシュフロー</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>指標</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead className="text-right">前月比増減</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">入金額</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.incomeAmount))}>{fmtCurrency(fin.incomeAmount, unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">出金額</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(-fin.expenseAmount))}>{fmtCurrency(fin.expenseAmount, unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">収支差額</TableCell>
                      <TableCell className={cn("text-right font-semibold", diffColorClass(fin.cashFlowDiff))}>{fmtCurrency(fin.cashFlowDiff, unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">現預金残高</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.cashAndDeposits))}>{fmtCurrency(fin.cashAndDeposits, unit)}</TableCell>
                      <TableCell className={cn("text-right", diffColorClass(fin.cashMom))}>{fmtDiff(fin.cashMom, unit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">■ 債権・債務</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>指標</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">売掛金残高</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.accountsReceivable))}>{fmtCurrency(fin.accountsReceivable, unit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">買掛金残高</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.accountsPayable))}>{fmtCurrency(fin.accountsPayable, unit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">売掛回転日数</TableCell>
                      <TableCell className="text-right font-semibold">{fin.arTurnoverDays.toFixed(1)}日</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">買掛回転日数</TableCell>
                      <TableCell className="text-right font-semibold">{fin.apTurnoverDays.toFixed(1)}日</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">■ 貸借対照表サマリー</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>指標</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">資産合計</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.totalAssets))}>{fmtCurrency(fin.totalAssets, unit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">負債合計</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.totalLiabilities))}>{fmtCurrency(fin.totalLiabilities, unit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">純資産</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.netAssets))}>{fmtCurrency(fin.netAssets, unit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">自己資本比率</TableCell>
                      <TableCell className={cn("text-right font-semibold", fin.equityRatio < 0 ? "text-destructive" : "")}>{fmtRate(fin.equityRatio)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">借入金残高</TableCell>
                      <TableCell className={cn("text-right font-semibold", negativeClass(fin.borrowings))}>{fmtCurrency(fin.borrowings, unit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Tab 3: Productivity ── */}
        <TabsContent value="productivity" className="space-y-6">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">■ 労働時間・工数単価</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>指標</TableHead>
                  <TableHead className="text-right">目標</TableHead>
                  <TableHead className="text-right">実績</TableHead>
                  <TableHead className="text-right">達成率</TableHead>
                  <TableHead className="text-right">前月比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">全体総労働時間</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-semibold">{prod.totalLaborHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className={cn("text-right", momColorClass(prod.totalLaborHoursMom))}>{fmtPct(prod.totalLaborHoursMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">全体案件工数</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-semibold">{prod.projectHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className={cn("text-right", momColorClass(prod.projectHoursMom))}>{fmtPct(prod.projectHoursMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">案件稼働率</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-semibold">{fmtRate(prod.utilizationRate)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className={cn("text-right", momColorClass(prod.utilizationRateMom))}>{fmtPct(prod.utilizationRateMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">粗利工数単価</TableCell>
                  <TableCell className="text-right">¥{prod.gphTarget.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(prod.gph, prod.gphTarget))}>¥{Math.round(prod.gph).toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right", colorClass(prod.gphAchievementRate, 100))}>{prod.gphAchievementRate}%</TableCell>
                  <TableCell className={cn("text-right", momColorClass(prod.gphMom))}>{fmtPct(prod.gphMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">案件粗利工数単価</TableCell>
                  <TableCell className="text-right">¥{prod.projectGphTarget.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right font-semibold", colorClass(prod.projectGph, prod.projectGphTarget))}>¥{Math.round(prod.projectGph).toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right", colorClass(prod.projectGphAchievementRate, 100))}>{prod.projectGphAchievementRate}%</TableCell>
                  <TableCell className={cn("text-right", momColorClass(prod.projectGphMom))}>{fmtPct(prod.projectGphMom)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab 4: Customers ── */}
        <TabsContent value="customers" className="space-y-6">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">■ 顧客数・単価</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>指標</TableHead>
                  <TableHead className="text-right">前月</TableHead>
                  <TableHead className="text-right">当月</TableHead>
                  <TableHead className="text-right">前月比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">顧客数</TableCell>
                  <TableCell className="text-right">{cust.prevClientCount}社</TableCell>
                  <TableCell className="text-right font-semibold">{cust.currClientCount}社</TableCell>
                  <TableCell className={cn("text-right", momColorClass(cust.clientCountMom))}>{fmtPct(cust.clientCountMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">顧客単価</TableCell>
                  <TableCell className="text-right">{fmtCurrency(cust.prevClientAvg, unit)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtCurrency(cust.currClientAvg, unit)}</TableCell>
                  <TableCell className={cn("text-right", momColorClass(cust.clientAvgMom))}>{fmtPct(cust.clientAvgMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">案件数</TableCell>
                  <TableCell className="text-right">{cust.prevProjectCount}件</TableCell>
                  <TableCell className="text-right font-semibold">{cust.currProjectCount}件</TableCell>
                  <TableCell className={cn("text-right", momColorClass(cust.projectCountMom))}>{fmtPct(cust.projectCountMom)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">案件単価</TableCell>
                  <TableCell className="text-right">{fmtCurrency(cust.prevProjectAvg, unit)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtCurrency(cust.currProjectAvg, unit)}</TableCell>
                  <TableCell className={cn("text-right", momColorClass(cust.projectAvgMom))}>{fmtPct(cust.projectAvgMom)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">■ 顧客別売上・粗利・粗利率</h3>
            {cust.clientTableRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">データなし</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>顧客名</TableHead>
                    <TableHead className="text-right">売上</TableHead>
                    <TableHead className="text-right">粗利</TableHead>
                    <TableHead className="text-right">粗利率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cust.clientTableRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(row.revenue, unit)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(row.grossProfit, unit)}</TableCell>
                      <TableCell className={cn("text-right", row.grossProfitRate < cust.avgGrossMarginRate ? "text-destructive" : "")}>
                        {fmtRate(row.grossProfitRate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 5: Quality ── */}
        <TabsContent value="quality" className="space-y-6">
          {!qual.hasData ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
              <p className="text-muted-foreground">品質データ未登録</p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-lg shadow-sm border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">■ 全体品質</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>指標</TableHead>
                      <TableHead className="text-right">目標</TableHead>
                      <TableHead className="text-right">実績</TableHead>
                      <TableHead className="text-right">前月比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">案件数</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right font-semibold">{qual.totalDeliveries}件</TableCell>
                      <TableCell className={cn("text-right", momColorClass(qual.totalDeliveriesMom))}>{fmtPct(qual.totalDeliveriesMom)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">納期遵守数</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right font-semibold">{qual.onTimeDeliveries}件</TableCell>
                      <TableCell className={cn("text-right", momColorClass(qual.onTimeDeliveriesMom))}>{fmtPct(qual.onTimeDeliveriesMom)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">納期遵守率</TableCell>
                      <TableCell className="text-right">95.0%</TableCell>
                      <TableCell className={cn("text-right font-semibold", colorClass(qual.onTimeRate, 95))}>{fmtRate(qual.onTimeRate)}</TableCell>
                      <TableCell className={cn("text-right", momColorClass(qual.onTimeRateMom))}>{fmtPct(qual.onTimeRateMom)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">修正発生数</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right font-semibold">{qual.revisionCount}件</TableCell>
                      <TableCell className={cn("text-right", momColorClass(-qual.revisionCountMom))}>{fmtPct(qual.revisionCountMom)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">修正発生率</TableCell>
                      <TableCell className="text-right">20.0%以下</TableCell>
                      <TableCell className={cn("text-right font-semibold", colorClass(qual.revisionRate, 20, false))}>{fmtRate(qual.revisionRate)}</TableCell>
                      <TableCell className={cn("text-right", momColorClass(-qual.revisionRateMom))}>{fmtPct(qual.revisionRateMom)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">■ 顧客別品質</h3>
                {qual.clientQualityRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">顧客別品質データなし</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>顧客名</TableHead>
                        <TableHead className="text-right">案件数</TableHead>
                        <TableHead className="text-right">納期遵守数</TableHead>
                        <TableHead className="text-right">遵守率</TableHead>
                        <TableHead className="text-right">修正発生数</TableHead>
                        <TableHead className="text-right">発生率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qual.clientQualityRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.clientName}</TableCell>
                          <TableCell className="text-right">{row.totalDeliveries}</TableCell>
                          <TableCell className="text-right">{row.onTimeDeliveries}</TableCell>
                          <TableCell className={cn("text-right", row.onTimeRate < 95 ? "text-destructive" : "")}>
                            {fmtRate(row.onTimeRate)}
                          </TableCell>
                          <TableCell className="text-right">{row.revisionCount}</TableCell>
                          <TableCell className={cn("text-right", row.revisionRate > 20 ? "text-destructive" : "")}>
                            {fmtRate(row.revisionRate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Tab 6: Analysis ── */}
        <TabsContent value="analysis" className="space-y-4">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">■ 数値評価・課題分析</h3>
              <Button onClick={handleGenerateAnalysis} disabled={analysisLoading} size="sm">
                {analysisLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                分析レポートを生成
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">最終生成: {fmtGeneratedAt(analysisGeneratedAt)}</p>
            {analysisContent ? (
              <div className="report-markdown max-w-4xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisContent}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                「分析レポートを生成」ボタンをクリックすると、AIが{ymLabel}のデータを分析します。
              </p>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 7: Action ── */}
        <TabsContent value="action" className="space-y-4">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">■ 解決策・来月アクション</h3>
              <Button onClick={handleGenerateAction} disabled={actionLoading || !analysisContent} size="sm">
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                アクション提案を生成
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">最終生成: {fmtGeneratedAt(actionGeneratedAt)}</p>
            {!analysisContent && !actionContent && (
              <p className="text-sm text-muted-foreground">
                先に「数値評価・課題分析」タブで分析レポートを生成してください。
              </p>
            )}
            {actionContent ? (
              <div className="report-markdown max-w-4xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{actionContent}</ReactMarkdown>
              </div>
            ) : analysisContent && !actionLoading ? (
              <p className="text-sm text-muted-foreground">
                「アクション提案を生成」ボタンをクリックすると、分析結果に基づいた改善提案を生成します。
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Report;
