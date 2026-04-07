import { useState, useEffect } from "react";
import { useRefresh, WfStatus } from "@/hooks/useRefresh";
import { X, RefreshCw, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StepIcon({ s }: { s: WfStatus }) {
  if (s === "done") return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (s === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />;
  if (s === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  return <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 inline-block" />;
}

function stepLabel(s: WfStatus, label: string) {
  if (s === "done") return label;
  if (s === "running") return `${label}…`;
  if (s === "error") return `${label}（失敗）`;
  return label;
}

export function RefreshStatusCard() {
  const { status, startedAt, progress, error, triggerRefresh, reset } = useRefresh();
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss after success
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(t);
    }
    if (status === "running") {
      setDismissed(false);
    }
  }, [status]);

  if (status === "idle" || dismissed) return null;

  const isError = status === "error";
  const isSuccess = status === "success";

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-72 rounded-lg border shadow-lg p-3 text-sm transition-all",
        isError
          ? "bg-destructive/10 border-destructive/30"
          : "bg-card border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          {isSuccess ? (
            <><Check className="h-4 w-4 text-green-500" /> 最新化完了</>
          ) : isError ? (
            <><AlertCircle className="h-4 w-4 text-destructive" /> 更新エラー</>
          ) : (
            <><Loader2 className="h-4 w-4 animate-spin text-primary" /> データ更新中…</>
          )}
        </span>
        <button
          onClick={() => { setDismissed(true); if (isSuccess || isError) reset(); }}
          className="p-0.5 hover:bg-muted rounded"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Steps */}
      {!isSuccess && (
        <div className="space-y-1 text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1.5">
            <StepIcon s={progress.wf01_board} />
            {stepLabel(progress.wf01_board, "Board データ取得")}
          </div>
          <div className="flex items-center gap-1.5">
            <StepIcon s={progress.wf02_freee} />
            {stepLabel(progress.wf02_freee, "freee データ取得")}
          </div>
          <div className="flex items-center gap-1.5">
            <StepIcon s={progress.wf05_kpi} />
            {stepLabel(progress.wf05_kpi, "KPI 再計算")}
          </div>
        </div>
      )}

      {/* Start time */}
      {startedAt && !isSuccess && (
        <div className="text-[10px] text-muted-foreground">
          開始: {formatTime(startedAt)}
        </div>
      )}

      {/* Error details + retry */}
      {isError && (
        <div className="mt-2 space-y-1.5">
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={triggerRefresh}>
            <RefreshCw className="h-3 w-3 mr-1" /> 再試行
          </Button>
        </div>
      )}
    </div>
  );
}
