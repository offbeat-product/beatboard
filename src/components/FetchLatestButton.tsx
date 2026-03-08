import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const DEFAULT_BOARD_URL = "https://offbeat-inc.app.n8n.cloud/webhook/wf01-board-sync";
const DEFAULT_FREEE_URL = "https://offbeat-inc.app.n8n.cloud/webhook/wf02-freee-sync";

type WebhookTarget = "board" | "freee" | "both";

interface FetchLatestButtonProps {
  /** Which webhooks to call */
  targets?: WebhookTarget;
}

function formatLastFetched(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FetchLatestButton({ targets = "both" }: FetchLatestButtonProps) {
  const storageKey = `lastFetched_${targets}`;
  const [syncing, setSyncing] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const cooldownRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setLastFetched(localStorage.getItem(storageKey));
  }, [storageKey]);

  const handleClick = useCallback(async () => {
    if (cooldownRef.current || syncing) return;
    setSyncing(true);
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 30000);

    try {
      const { data: org } = await supabase
        .from("organizations")
        .select("settings_json")
        .eq("id", ORG_ID)
        .single();
      const settings = (org?.settings_json && typeof org.settings_json === "object")
        ? (org.settings_json as Record<string, unknown>)
        : {};
      const boardUrl = (settings.webhook_board_url as string) || DEFAULT_BOARD_URL;
      const freeeUrl = (settings.webhook_freee_url as string) || DEFAULT_FREEE_URL;

      const calls: Promise<Response>[] = [];
      if (targets === "board" || targets === "both") {
        calls.push(fetch(boardUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year_month: "current" }),
        }));
      }
      if (targets === "freee" || targets === "both") {
        calls.push(fetch(freeeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year_month: "current" }),
        }));
      }

      await Promise.all(calls);
      await new Promise((r) => setTimeout(r, 10000));
      await queryClient.invalidateQueries();

      const now = new Date().toISOString();
      localStorage.setItem(storageKey, now);
      setLastFetched(now);

      toast.success("最新データを取得しました");
    } catch {
      toast.error("データ取得に失敗しました。しばらく待ってから再試行してください。");
    } finally {
      setSyncing(false);
    }
  }, [syncing, queryClient, targets, storageKey]);

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
        disabled={syncing}
        onClick={handleClick}
      >
        {syncing ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />取得中...</>
        ) : (
          <><RefreshCw className="h-4 w-4 mr-1.5" />最新データ取得</>
        )}
      </Button>
    </div>
  );
}
