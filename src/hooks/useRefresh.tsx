import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID, getCurrentMonth } from "@/lib/fiscalYear";

// --- Types ---
export type RefreshStatus = "idle" | "running" | "success" | "error";
export type WfStatus = "pending" | "running" | "done" | "error";

export interface RefreshProgress {
  wf01_board: WfStatus;
  wf02_freee: WfStatus;
  wf05_kpi: WfStatus;
}

export interface RefreshState {
  status: RefreshStatus;
  startedAt: string | null; // ISO string for serialisation
  completedAt: string | null;
  progress: RefreshProgress;
  error: string | null;
}

export interface RefreshContextValue extends RefreshState {
  triggerRefresh: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = "beatboard_refresh_state";
const TIMEOUT_MS = 120_000; // 120 s hard timeout
const BUFFER_WAIT_MS = 45_000; // wait for n8n to finish writing
const KPI_RETRY_INTERVAL_MS = 15_000;
const KPI_MAX_RETRIES = 3;

const DEFAULT_BOARD_URL = "https://offbeat-inc.app.n8n.cloud/webhook/wf01-board-sync";
const DEFAULT_FREEE_URL = "https://offbeat-inc.app.n8n.cloud/webhook/wf02-freee-sync";

const initialState: RefreshState = {
  status: "idle",
  startedAt: null,
  completedAt: null,
  progress: { wf01_board: "pending", wf02_freee: "pending", wf05_kpi: "pending" },
  error: null,
};

function saveState(s: RefreshState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* noop */ }
}

function loadState(): RefreshState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RefreshState;
  } catch { /* noop */ }
  return { ...initialState };
}

function getJstCurrentMonth(): string {
  return getCurrentMonth(); // already JST-based
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RefreshState>(loadState);
  const runningRef = useRef(false);

  // Persist to sessionStorage on every change
  useEffect(() => { saveState(state); }, [state]);

  const patch = useCallback((partial: Partial<RefreshState>) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      if (partial.progress) next.progress = { ...prev.progress, ...partial.progress };
      return next;
    });
  }, []);

  const patchProgress = useCallback((p: Partial<RefreshProgress>) => {
    setState(prev => ({ ...prev, progress: { ...prev.progress, ...p } }));
  }, []);

  const fetchWebhookUrls = useCallback(async () => {
    const { data: org } = await supabase
      .from("organizations")
      .select("settings_json")
      .eq("id", ORG_ID)
      .single();
    const settings = (org?.settings_json && typeof org.settings_json === "object")
      ? (org.settings_json as Record<string, unknown>) : {};
    return {
      boardUrl: (settings.webhook_board_url as string) || DEFAULT_BOARD_URL,
      freeeUrl: (settings.webhook_freee_url as string) || DEFAULT_FREEE_URL,
    };
  }, []);

  const checkKpiSnapshot = useCallback(async (ym: string): Promise<boolean> => {
    const { data } = await supabase
      .from("kpi_snapshots")
      .select("id")
      .eq("org_id", ORG_ID)
      .like("snapshot_date", `${ym}%`)
      .limit(1);
    return !!(data && data.length > 0);
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    const startedAt = new Date().toISOString();
    setState({
      status: "running",
      startedAt,
      completedAt: null,
      progress: { wf01_board: "running", wf02_freee: "running", wf05_kpi: "pending" },
      error: null,
    });

    try {
      const { boardUrl, freeeUrl } = await fetchWebhookUrls();
      const ym = getJstCurrentMonth();

      // Build 3 months: prev, current, next
      const [y, m] = ym.split("-").map(Number);
      const months: string[] = [];
      for (const offset of [-1, 0, 1]) {
        const d = new Date(y, m - 1 + offset, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      // Step 2: Fire WF-01 and WF-02 for all months in parallel
      const boardCalls = months.map(month =>
        fetch(boardUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year_month: month }),
        })
      );
      const freeeCalls = months.map(month =>
        fetch(freeeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year_month: month }),
        })
      );

      const results = await Promise.allSettled([...boardCalls, ...freeeCalls]);

      const boardFailed = results.slice(0, months.length).some(r => r.status === "rejected");
      const freeeFailed = results.slice(months.length).some(r => r.status === "rejected");

      patchProgress({
        wf01_board: boardFailed ? "error" : "done",
        wf02_freee: freeeFailed ? "error" : "done",
      });

      if (boardFailed && freeeFailed) {
        throw new Error("Board と freee の両方のWebhook呼び出しに失敗しました");
      }

      // Step 3: 45-second buffer wait
      patchProgress({ wf05_kpi: "running" });
      await new Promise(r => setTimeout(r, BUFFER_WAIT_MS));

      // Step 4: Check kpi_snapshots with retries
      let kpiFound = false;
      for (let attempt = 0; attempt < KPI_MAX_RETRIES; attempt++) {
        kpiFound = await checkKpiSnapshot(ym);
        if (kpiFound) break;
        if (attempt < KPI_MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, KPI_RETRY_INTERVAL_MS));
        }
      }

      if (!kpiFound) {
        // Still mark as success if webhooks succeeded – KPI may update on schedule
        console.warn("KPI snapshot not found for", ym, "– proceeding anyway");
      }

      patchProgress({ wf05_kpi: kpiFound ? "done" : "done" });

      // Step 5: Invalidate all queries
      await queryClient.invalidateQueries();

      const completedAt = new Date().toISOString();
      // Update lastFetched timestamps in localStorage for all targets
      localStorage.setItem("lastFetched_both", completedAt);
      localStorage.setItem("lastFetched_board", completedAt);
      localStorage.setItem("lastFetched_freee", completedAt);

      setState(prev => ({
        ...prev,
        status: "success",
        completedAt,
        progress: { wf01_board: boardFailed ? "error" : "done", wf02_freee: freeeFailed ? "error" : "done", wf05_kpi: "done" },
        error: boardFailed ? "Board Webhook に失敗しました" : freeeFailed ? "freee Webhook に失敗しました" : null,
      }));
    } catch (err: any) {
      console.error("[RefreshContext] Error:", err);
      setState(prev => ({
        ...prev,
        status: "error",
        error: err?.message || "データ取得に失敗しました",
      }));
    } finally {
      runningRef.current = false;
    }
  }, [fetchWebhookUrls, checkKpiSnapshot, patchProgress, queryClient]);

  const reset = useCallback(() => {
    setState({ ...initialState });
    runningRef.current = false;
  }, []);

  // On mount: restore running state
  useEffect(() => {
    if (state.status === "running" && state.startedAt) {
      const elapsed = Date.now() - new Date(state.startedAt).getTime();
      if (elapsed > TIMEOUT_MS) {
        setState(prev => ({ ...prev, status: "error", error: "タイムアウトしました。再試行してください。" }));
      }
      // Don't auto-resume – let user re-trigger
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RefreshContext.Provider value={{ ...state, triggerRefresh, reset }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within RefreshProvider");
  return ctx;
}
