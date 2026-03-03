import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Save, Zap } from "lucide-react";

/* ── helpers ── */
const METRICS = [
  "monthly_revenue",
  "gross_margin_rate",
  "gph",
  "top1_concentration",
  "top3_concentration",
] as const;

const METRIC_LABELS: Record<string, string> = {
  monthly_revenue: "月次売上目標",
  gross_margin_rate: "粗利率目標",
  gph: "粗利工数単価目標",
  top1_concentration: "上位1社集中度目標",
  top3_concentration: "上位3社集中度目標",
};

function generateMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

const fmt = (v: number | undefined, metric: string) => {
  if (v === undefined || v === null) return "";
  if (metric === "monthly_revenue") return v.toLocaleString();
  if (metric === "gph") return v.toLocaleString();
  if (metric.includes("rate") || metric.includes("concentration")) return v.toString();
  return v.toString();
};

/* ────────────────────────────────────────────── */
/* Tab 1: 目標値設定                                */
/* ────────────────────────────────────────────── */

type TargetRow = Record<string, number | undefined>;
type TargetsMap = Record<string, TargetRow>; // key = year_month

function TargetsTab() {
  const months = generateMonths();
  const [data, setData] = useState<TargetsMap>({});
  const [editCell, setEditCell] = useState<{ ym: string; metric: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});

  // fetch
  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("targets")
        .select("year_month, metric_name, target_value")
        .in("year_month", months);
      if (!rows) return;
      const map: TargetsMap = {};
      rows.forEach((r) => {
        if (!map[r.year_month]) map[r.year_month] = {};
        map[r.year_month][r.metric_name] = r.target_value;
      });
      setData(map);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (ym: string, metric: string) => {
    setEditCell({ ym, metric });
    setEditValue(data[ym]?.[metric]?.toString() ?? "");
  };

  const commitEdit = () => {
    if (!editCell) return;
    const num = parseFloat(editValue);
    setData((prev) => ({
      ...prev,
      [editCell.ym]: { ...prev[editCell.ym], [editCell.metric]: isNaN(num) ? undefined : num },
    }));
    setEditCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get org_id from first existing target or use a default approach
      const { data: orgData } = await supabase.from("organizations").select("id").limit(1).single();
      const orgId = orgData?.id;
      if (!orgId) {
        toast.error("組織情報が見つかりません");
        setSaving(false);
        return;
      }

      const upserts: { org_id: string; year_month: string; metric_name: string; target_value: number }[] = [];
      for (const ym of months) {
        for (const m of METRICS) {
          const v = data[ym]?.[m];
          if (v !== undefined) upserts.push({ org_id: orgId, year_month: ym, metric_name: m, target_value: v });
        }
      }

      if (upserts.length === 0) {
        toast.info("保存するデータがありません");
        setSaving(false);
        return;
      }

      // Delete existing and re-insert
      await supabase.from("targets").delete().in("year_month", months).eq("org_id", orgId);
      const { error } = await supabase.from("targets").insert(upserts);
      if (error) throw error;
      toast.success("目標値を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
    setSaving(false);
  };

  const applyBulk = () => {
    const newData = { ...data };
    for (const ym of months) {
      if (!newData[ym]) newData[ym] = {};
      for (const m of METRICS) {
        const v = parseFloat(bulkValues[m] ?? "");
        if (!isNaN(v)) newData[ym][m] = v;
      }
    }
    setData(newData);
    setBulkOpen(false);
    toast.success("一括設定を適用しました（保存ボタンで確定）");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-1.5" />
              12ヶ月分一括設定
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>年間目標を一括設定</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {METRICS.map((m) => (
                <div key={m} className="grid grid-cols-[1fr_140px] items-center gap-3">
                  <Label className="text-sm">{METRIC_LABELS[m]}</Label>
                  <Input
                    type="number"
                    value={bulkValues[m] ?? ""}
                    onChange={(e) => setBulkValues((p) => ({ ...p, [m]: e.target.value }))}
                    placeholder="値"
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">キャンセル</Button>
              </DialogClose>
              <Button size="sm" onClick={applyBulk}>適用</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-xs">年月</TableHead>
                {METRICS.map((m) => (
                  <TableHead key={m} className="text-xs text-center">{METRIC_LABELS[m]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((ym) => (
                <TableRow key={ym}>
                  <TableCell className="text-xs font-medium font-mono-num">{ym}</TableCell>
                  {METRICS.map((m) => {
                    const isEditing = editCell?.ym === ym && editCell?.metric === m;
                    return (
                      <TableCell
                        key={m}
                        className="text-center cursor-pointer hover:bg-secondary/60 transition-colors"
                        onClick={() => !isEditing && startEdit(ym, m)}
                      >
                        {isEditing ? (
                          <Input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                            className="h-7 text-xs text-center w-24 mx-auto"
                          />
                        ) : (
                          <span className="text-xs font-mono-num text-muted-foreground">
                            {fmt(data[ym]?.[m], m) || "—"}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 2: アラート閾値                              */
/* ────────────────────────────────────────────── */

const ALERT_DEFAULTS = [
  { name: "売上進捗率", warnKey: "rev_warn", dangerKey: "rev_danger", warnDefault: -10, dangerDefault: -20, suffix: "%" },
  { name: "粗利率", warnKey: "gm_warn", dangerKey: "gm_danger", warnDefault: 60, dangerDefault: 55, suffix: "%" },
  { name: "粗利工数単価", warnKey: "gph_warn", dangerKey: "gph_danger", warnDefault: 18000, dangerDefault: 15000, suffix: "円" },
  { name: "顧客集中度（上位1社）", warnKey: "top1_warn", dangerKey: "top1_danger", warnDefault: 35, dangerDefault: 40, suffix: "%" },
  { name: "顧客集中度（上位3社）", warnKey: "top3_warn", dangerKey: "top3_danger", warnDefault: 70, dangerDefault: 80, suffix: "%" },
];

function AlertsTab() {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    ALERT_DEFAULTS.forEach((a) => {
      init[a.warnKey] = a.warnDefault;
      init[a.dangerKey] = a.dangerDefault;
    });
    return init;
  });

  // Load from org settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("organizations").select("settings_json").limit(1).single();
      if (data?.settings_json && typeof data.settings_json === "object" && (data.settings_json as Record<string, unknown>).alerts) {
        setValues((prev) => ({ ...prev, ...(data.settings_json as Record<string, unknown>).alerts as Record<string, number> }));
      }
    })();
  }, []);

  const handleSave = async () => {
    const { data: org } = await supabase.from("organizations").select("id, settings_json").limit(1).single();
    if (!org) { toast.error("組織情報が見つかりません"); return; }
    const settings = typeof org.settings_json === "object" && org.settings_json !== null ? org.settings_json : {};
    const { error } = await supabase
      .from("organizations")
      .update({ settings_json: { ...settings, alerts: values } })
      .eq("id", org.id);
    if (error) toast.error("保存に失敗しました");
    else toast.success("アラート閾値を保存しました");
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">KPI</TableHead>
              <TableHead className="text-xs text-center">⚠️ 警告閾値</TableHead>
              <TableHead className="text-xs text-center">🚨 危険閾値</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALERT_DEFAULTS.map((a) => (
              <TableRow key={a.warnKey}>
                <TableCell className="text-sm font-medium">{a.name}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      value={values[a.warnKey]}
                      onChange={(e) => setValues((p) => ({ ...p, [a.warnKey]: parseFloat(e.target.value) || 0 }))}
                      className="h-8 w-24 text-xs text-center border-chart-yellow/40 focus-visible:ring-chart-yellow/30"
                    />
                    <span className="text-xs text-muted-foreground">{a.suffix}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      value={values[a.dangerKey]}
                      onChange={(e) => setValues((p) => ({ ...p, [a.dangerKey]: parseFloat(e.target.value) || 0 }))}
                      className="h-8 w-24 text-xs text-center border-destructive/40 focus-visible:ring-destructive/30"
                    />
                    <span className="text-xs text-muted-foreground">{a.suffix}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1.5" />
          保存
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 3: データ管理                                */
/* ────────────────────────────────────────────── */

const SYNC_SOURCES = [
  { id: "board", label: "Board と同期", lastSync: "2026/03/03 08:00" },
  { id: "freee", label: "freee と同期", lastSync: "2026/03/03 08:00" },
  { id: "pace", label: "Pace と同期", lastSync: "2026/03/03 08:00" },
  { id: "checkgo", label: "CheckGO と同期", lastSync: "2026/03/03 08:00" },
];

function DataTab() {
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const handleSync = (id: string) => {
    setSyncing((p) => ({ ...p, [id]: true }));
    toast.success("同期を開始しました");
    setTimeout(() => setSyncing((p) => ({ ...p, [id]: false })), 2000);
  };

  const handleSyncAll = () => {
    const all: Record<string, boolean> = {};
    SYNC_SOURCES.forEach((s) => (all[s.id] = true));
    setSyncing(all);
    toast.success("全データの同期を開始しました");
    setTimeout(() => setSyncing({}), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {SYNC_SOURCES.map((src) => (
          <div key={src.id} className="bg-card rounded-lg shadow-sm border border-border p-5">
            <Button
              variant="outline"
              className="w-full justify-center"
              disabled={syncing[src.id]}
              onClick={() => handleSync(src.id)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing[src.id] ? "animate-spin" : ""}`} />
              {src.label}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              最終同期: {src.lastSync}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <Button className="w-full" disabled={Object.values(syncing).some(Boolean)} onClick={handleSyncAll}>
          <RefreshCw className={`h-4 w-4 mr-2 ${Object.values(syncing).some(Boolean) ? "animate-spin" : ""}`} />
          全データを同期
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Main Page                                       */
/* ────────────────────────────────────────────── */

const SettingsPage = () => {
  usePageTitle("設定");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">設定</h2>
        <p className="text-muted-foreground text-sm mt-1">目標値・アラート・データ同期の管理</p>
      </div>

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets">目標値設定</TabsTrigger>
          <TabsTrigger value="alerts">アラート閾値</TabsTrigger>
          <TabsTrigger value="data">データ管理</TabsTrigger>
        </TabsList>

        <TabsContent value="targets">
          <TargetsTab />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab />
        </TabsContent>
        <TabsContent value="data">
          <DataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
