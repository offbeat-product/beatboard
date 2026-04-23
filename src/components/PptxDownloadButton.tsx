/**
 * BeatBoard pptxダウンロードボタン
 *
 * 使い方:
 *   <PptxDownloadButton reportData={reportData} />
 *
 * reportData は generate-monthly-report Edge Function のレスポンス
 * (report_content をJSON.parseしたオブジェクト)
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast"; // shadcn/ui toast
import { generateMonthlyReportPptx } from "@/lib/pptxGenerator";
import type { MonthlyReportData } from "@/lib/types";

interface PptxDownloadButtonProps {
  reportData: MonthlyReportData | null;
  logoUrl?: string;
  organizationName?: string;
  disabled?: boolean;
}

export function PptxDownloadButton({
  reportData,
  logoUrl = "/logo.png",
  organizationName,
  disabled = false,
}: PptxDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!reportData) {
      toast({
        title: "レポートデータがありません",
        description: "先にレポートを生成してください",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateMonthlyReportPptx(reportData, {
        logoUrl,
        organizationName,
      });

      toast({
        title: "ダウンロード完了",
        description: "月次レポートのpptxファイルを生成しました",
      });
    } catch (error) {
      console.error("pptx generation error:", error);
      toast({
        title: "生成エラー",
        description:
          error instanceof Error
            ? error.message
            : "pptxの生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={disabled || isGenerating || !reportData}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          生成中...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          pptxダウンロード
        </>
      )}
    </Button>
  );
}
