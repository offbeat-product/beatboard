import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRefresh } from "@/hooks/useRefresh";
import { useEffect, useState } from "react";

function formatLastFetched(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RefreshButton() {
  const { status, triggerRefresh, completedAt } = useRefresh();
  const isRunning = status === "running";

  // Show last fetched time from localStorage (unified key)
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  useEffect(() => {
    setLastFetched(localStorage.getItem("lastFetched_both"));
  }, [completedAt]);

  const displayTime = formatLastFetched(lastFetched);

  return (
    <div className="flex items-center gap-2 shrink-0">
      {displayTime && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline">
          最終取得: {displayTime}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={isRunning}
        onClick={() => triggerRefresh()}
      >
        {isRunning ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />取得中…</>
        ) : (
          <><RefreshCw className="h-4 w-4 mr-1.5" />最新データ取得</>
        )}
      </Button>
    </div>
  );
}
