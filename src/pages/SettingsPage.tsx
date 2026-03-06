import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Save, Zap, Link2, Copy, XCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { getFiscalYearMonths, getMonthLabel, ORG_ID } from "@/lib/fiscalYear";

/* ── helpers ── */
const METRICS = [
  "monthly_revenue",
  "gross_margin_rate",
  "gross_profit_per_hour",
  "top1_concentration",
  "top3_concentration",
] as const;

const METRIC_LABELS: Record<string, string> = {
  monthly_revenue: "月次売上目標",
  gross_margin_rate: "粗利率目標",
  gross_profit_per_hour: "粗利工数単価目標",
  top1_concentration: "上位1社集中度目標",
  top3_concentration: "上位3社集中度目標",
};

const METRIC_DEFAULTS: Record<string, number> = {
  gross_profit_per_hour: 22000,
};

/* ────────────────────────────────────────────── */
/* Tab 1: 目標値設定                                */
/* ────────────────────────────────────────────── */

type TargetRow = Record<string, number | undefined>;
type TargetsMap = Record<string, TargetRow>;

function TargetsTab() {
  const { unit } = useCurrencyUnit();
  const [fyPeriod, setFyPeriod] = useState<"current" | "next">("current");
  const fyEndYear = fyPeriod === "current" ? 2026 : 2027;
  const months = getFiscalYearMonths(fyEndYear);
  const fyLabel = `${fyEndYear}年4月期`;

  const [data, setData] = useState<TargetsMap>({});
  const [editCell, setEditCell] = useState<{ ym: string; metric: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("targets")
        .select("year_month, metric_name, target_value")
        .eq("org_id", ORG_ID)
        .in("year_month", months);
      if (!rows) return;
      const map: TargetsMap = {};
      rows.forEach((r) => {
        if (!map[r.year_month]) map[r.year_month] = {};
        map[r.year_month][r.metric_name] = r.target_value;
      });
      setData(map);
    })();
  }, [fyPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAmountMetric = (m: string) => m === "monthly_revenue" || m === "gross_profit_per_hour";

  const inputToDbValue = (v: string, metric: string): number | undefined => {
    const num = parseFloat(v.replace(/,/g, ""));
    if (isNaN(num)) return undefined;
    if (metric === "monthly_revenue" && unit === "thousand") return num * 1000;
    return num;
  };

  const dbToInputValue = (v: number | undefined, metric: string): string => {
    if (v === undefined || v === null) return "";
    if (metric === "monthly_revenue" && unit === "thousand") return Math.round(v / 1000).toLocaleString();
    if (isAmountMetric(metric)) return v.toLocaleString();
    return v.toString();
  };

  const startEdit = (ym: string, metric: string) => {
    setEditCell({ ym, metric });
    const val = data[ym]?.[metric] ?? METRIC_DEFAULTS[metric];
    setEditValue(dbToInputValue(val, metric));
  };

  const commitEdit = () => {
    if (!editCell) return;
    const dbVal = inputToDbValue(editValue, editCell.metric);
    setData((prev) => ({
      ...prev,
      [editCell.ym]: { ...prev[editCell.ym], [editCell.metric]: dbVal },
    }));
    setEditCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts: { org_id: string; year_month: string; metric_name: string; target_value: number }[] = [];
      for (const ym of months) {
        for (const m of METRICS) {
          const v = data[ym]?.[m] ?? METRIC_DEFAULTS[m];
          if (v !== undefined) upserts.push({ org_id: ORG_ID, year_month: ym, metric_name: m, target_value: v });
        }
      }
      if (upserts.length === 0) { toast.info("保存するデータがありません"); setSaving(false); return; }
      await supabase.from("targets").delete().in("year_month", months).eq("org_id", ORG_ID);
      const { error } = await supabase.from("targets").insert(upserts);
      if (error) throw error;
      toast.success("目標値を保存しました");
    } catch { toast.error("保存に失敗しました"); }
    setSaving(false);
  };

  const applyBulk = () => {
    const newData = { ...data };
    for (const ym of months) {
      if (!newData[ym]) newData[ym] = {};
      for (const m of METRICS) {
        const dbVal = inputToDbValue(bulkValues[m] ?? "", m);
        if (dbVal !== undefined) newData[ym][m] = dbVal;
      }
    }
    setData(newData);
    setBulkOpen(false);
    toast.success("一括設定を適用しました（保存ボタンで確定）");
  };

  const getInputSuffix = (metric: string) => {
    if (metric === "monthly_revenue") return unit === "thousand" ? "千円" : "円";
    if (metric === "gross_profit_per_hour") return "円";
    return "";
  };

  const displayValue = (v: number | undefined, metric: string) => {
    if (v === undefined || v === null) {
      const def = METRIC_DEFAULTS[metric];
      if (def !== undefined) return dbToInputValue(def, metric);
      return "—";
    }
    return dbToInputValue(v, metric);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border text-xs font-medium overflow-hidden">
            <button onClick={() => setFyPeriod("current")} className={`px-3 py-1.5 transition-colors ${fyPeriod === "current" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}>当期（2026年4月期）</button>
            <button onClick={() => setFyPeriod("next")} className={`px-3 py-1.5 transition-colors ${fyPeriod === "next" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}>来期（2027年4月期）</button>
          </div>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Zap className="h-4 w-4 mr-1.5" />12ヶ月分一括設定</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{fyLabel} 年間目標を一括設定</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                {METRICS.map((m) => (
                  <div key={m} className="grid grid-cols-[1fr_140px_auto] items-center gap-3">
                    <Label className="text-sm">{METRIC_LABELS[m]}</Label>
                    <Input type="text" value={bulkValues[m] ?? ""} onChange={(e) => setBulkValues((p) => ({ ...p, [m]: e.target.value }))} placeholder="値" className="text-sm" />
                    <span className="text-xs text-muted-foreground w-8">{getInputSuffix(m)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button variant="outline" size="sm">キャンセル</Button></DialogClose>
                <Button size="sm" onClick={applyBulk}>適用</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存"}</Button>
      </div>
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-xs">年月</TableHead>
                {METRICS.map((m) => (
                  <TableHead key={m} className="text-xs text-center">
                    {METRIC_LABELS[m]}{getInputSuffix(m) && <span className="text-muted-foreground ml-1">({getInputSuffix(m)})</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((ym) => (
                <TableRow key={ym}>
                  <TableCell className="text-xs font-medium font-mono-num">{getMonthLabel(ym)}</TableCell>
                  {METRICS.map((m) => {
                    const isEditing = editCell?.ym === ym && editCell?.metric === m;
                    return (
                      <TableCell key={m} className="text-center cursor-pointer hover:bg-secondary/60 transition-colors" onClick={() => !isEditing && startEdit(ym, m)}>
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input type="text" autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()} className="h-7 text-xs text-center w-24 mx-auto" />
                            {getInputSuffix(m) && <span className="text-xs text-muted-foreground">{getInputSuffix(m)}</span>}
                          </div>
                        ) : (
                          <span className="text-xs font-mono-num text-muted-foreground">{displayValue(data[ym]?.[m], m)}</span>
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
    ALERT_DEFAULTS.forEach((a) => { init[a.warnKey] = a.warnDefault; init[a.dangerKey] = a.dangerDefault; });
    return init;
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("organizations").select("settings_json").eq("id", ORG_ID).single();
      if (data?.settings_json && typeof data.settings_json === "object" && (data.settings_json as Record<string, unknown>).alerts) {
        setValues((prev) => ({ ...prev, ...(data.settings_json as Record<string, unknown>).alerts as Record<string, number> }));
      }
    })();
  }, []);

  const handleSave = async () => {
    const { data: org } = await supabase.from("organizations").select("id, settings_json").eq("id", ORG_ID).single();
    if (!org) { toast.error("組織情報が見つかりません"); return; }
    const settings = typeof org.settings_json === "object" && org.settings_json !== null ? org.settings_json : {};
    const { error } = await supabase.from("organizations").update({ settings_json: { ...settings, alerts: values } }).eq("id", org.id);
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
                    <Input type="number" value={values[a.warnKey]} onChange={(e) => setValues((p) => ({ ...p, [a.warnKey]: parseFloat(e.target.value) || 0 }))} className="h-8 w-24 text-xs text-center border-chart-yellow/40 focus-visible:ring-chart-yellow/30" />
                    <span className="text-xs text-muted-foreground">{a.suffix}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Input type="number" value={values[a.dangerKey]} onChange={(e) => setValues((p) => ({ ...p, [a.dangerKey]: parseFloat(e.target.value) || 0 }))} className="h-8 w-24 text-xs text-center border-destructive/40 focus-visible:ring-destructive/30" />
                    <span className="text-xs text-muted-foreground">{a.suffix}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1.5" />保存</Button>
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
  const handleSync = (id: string) => { setSyncing((p) => ({ ...p, [id]: true })); toast.success("同期を開始しました"); setTimeout(() => setSyncing((p) => ({ ...p, [id]: false })), 2000); };
  const handleSyncAll = () => { const all: Record<string, boolean> = {}; SYNC_SOURCES.forEach((s) => (all[s.id] = true)); setSyncing(all); toast.success("全データの同期を開始しました"); setTimeout(() => setSyncing({}), 3000); };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SYNC_SOURCES.map((src) => (
          <div key={src.id} className="bg-card rounded-lg shadow-sm border border-border p-5">
            <Button variant="outline" className="w-full justify-center" disabled={syncing[src.id]} onClick={() => handleSync(src.id)}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing[src.id] ? "animate-spin" : ""}`} />{src.label}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">最終同期: {src.lastSync}</p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <Button className="w-full" disabled={Object.values(syncing).some(Boolean)} onClick={handleSyncAll}>
          <RefreshCw className={`h-4 w-4 mr-2 ${Object.values(syncing).some(Boolean) ? "animate-spin" : ""}`} />全データを同期
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 4: 労働時間                                  */
/* ────────────────────────────────────────────── */

function WorkHoursTab() {
  const [stdHours, setStdHours] = useState("160");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("organizations").select("settings_json").eq("id", ORG_ID).single();
      if (data?.settings_json && typeof data.settings_json === "object") {
        const s = data.settings_json as Record<string, unknown>;
        if (s.standard_work_hours) setStdHours(String(s.standard_work_hours));
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: org } = await supabase.from("organizations").select("id, settings_json").eq("id", ORG_ID).single();
    if (!org) { toast.error("組織情報が見つかりません"); setSaving(false); return; }
    const settings = typeof org.settings_json === "object" && org.settings_json !== null ? org.settings_json : {};
    const { error } = await supabase.from("organizations").update({ settings_json: { ...settings, standard_work_hours: parseFloat(stdHours) || 160 } }).eq("id", org.id);
    if (error) toast.error("保存に失敗しました");
    else toast.success("労働時間設定を保存しました");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-sm font-semibold mb-4">標準労働時間</h3>
        <div className="flex items-center gap-3">
          <Label className="text-sm">月間標準労働時間</Label>
          <Input type="number" value={stdHours} onChange={(e) => setStdHours(e.target.value)} className="w-24 text-sm" />
          <span className="text-xs text-muted-foreground">時間/月</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存"}</Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 5: メンバー管理                               */
/* ────────────────────────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  viewer: "閲覧者",
};

function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("");
}

type InviteLink = {
  id: string;
  token: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string | null;
};

function MembersTab() {
  const [role, setRole] = useState("viewer");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [linksRes, membersRes] = await Promise.all([
      supabase.from("invite_links").select("*").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, display_name, role, status, created_at").eq("status", "active").order("created_at", { ascending: true }),
    ]);
    if (linksRes.data) {
      // Mark expired links
      const now = new Date();
      setInviteLinks(
        (linksRes.data as InviteLink[]).map((l) => ({
          ...l,
          status: l.status === "active" && new Date(l.expires_at) < now ? "expired" : l.status,
        }))
      );
    }
    if (membersRes.data) setMembers(membersRes.data as Profile[]);
    setLoadingMembers(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("invite_links").insert({
        org_id: ORG_ID,
        token,
        role,
        created_by: user?.id || null,
        expires_at: expiresAt,
      });
      if (error) throw error;

      const url = `${window.location.origin}/invite/${token}`;
      setGeneratedUrl(url);
      toast.success("招待リンクを生成しました");
      fetchData();
    } catch (err: any) {
      toast.error("生成に失敗しました: " + (err.message || "不明なエラー"));
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      toast.success("クリップボードにコピーしました");
    }
  };

  const handleDeactivate = async (linkId: string) => {
    const { error } = await supabase.from("invite_links").update({ status: "deactivated" }).eq("id", linkId);
    if (error) toast.error("無効化に失敗しました");
    else { toast.success("リンクを無効化しました"); fetchData(); }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error("ロール変更に失敗しました");
    else { toast.success("ロールを変更しました"); setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m)); }
  };

  const handleDelete = async (memberId: string, memberEmail: string | null) => {
    if (!confirm(`${memberEmail || "このメンバー"} のアクセスを無効化しますか？`)) return;
    const { error } = await supabase.from("profiles").update({ status: "deleted" }).eq("id", memberId);
    if (error) toast.error("削除に失敗しました");
    else { toast.success("メンバーを無効化しました"); setMembers((prev) => prev.filter((m) => m.id !== memberId)); }
  };

  const getLinkStatusLabel = (status: string) => {
    if (status === "active") return { label: "有効", cls: "bg-green-100 text-green-800" };
    if (status === "used") return { label: "使用済", cls: "bg-muted text-muted-foreground" };
    if (status === "expired") return { label: "期限切れ", cls: "bg-yellow-100 text-yellow-800" };
    if (status === "deactivated") return { label: "無効化済", cls: "bg-destructive/10 text-destructive" };
    return { label: status, cls: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="space-y-6">
      {/* Invite link generation */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          招待リンクを生成
        </h3>
        <p className="text-xs text-muted-foreground mb-4">リンクを共有してメンバーを招待できます。リンクは7日間有効です。</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div>
            <Label className="text-xs mb-1 block">ロール</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">管理者</SelectItem>
                <SelectItem value="manager">マネージャー</SelectItem>
                <SelectItem value="viewer">閲覧者</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="w-full sm:w-auto">
            <Link2 className="h-4 w-4 mr-1.5" />
            {generating ? "生成中..." : "招待リンクを生成"}
          </Button>
        </div>
        {generatedUrl && (
          <div className="mt-4 flex items-center gap-2 bg-muted rounded-md p-3">
            <code className="text-xs flex-1 truncate">{generatedUrl}</code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              コピー
            </Button>
          </div>
        )}
      </div>

      {/* Invite links table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">招待リンク一覧</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">リンク</TableHead>
              <TableHead className="text-xs">ロール</TableHead>
              <TableHead className="text-xs">ステータス</TableHead>
              <TableHead className="text-xs">作成日</TableHead>
              <TableHead className="text-xs">有効期限</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inviteLinks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">招待リンクはありません</TableCell></TableRow>
            ) : inviteLinks.map((link) => {
              const st = getLinkStatusLabel(link.status);
              return (
                <TableRow key={link.id}>
                  <TableCell className="text-xs font-mono">...{link.token.slice(-8)}</TableCell>
                  <TableCell className="text-xs">{ROLE_LABELS[link.role] || link.role}</TableCell>
                  <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(link.created_at).toLocaleDateString("ja-JP")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(link.expires_at).toLocaleDateString("ja-JP")}</TableCell>
                  <TableCell>
                    {link.status === "active" && (
                      <button onClick={() => handleDeactivate(link.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="無効化">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Members table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">メンバー一覧</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">表示名</TableHead>
              <TableHead className="text-xs">メールアドレス</TableHead>
              <TableHead className="text-xs">ロール</TableHead>
              <TableHead className="text-xs">登録日</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMembers ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">読み込み中...</TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">メンバーがいません</TableCell></TableRow>
            ) : members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="text-sm">{member.display_name || "—"}</TableCell>
                <TableCell className="text-sm">{member.email || "—"}</TableCell>
                <TableCell>
                  <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理者</SelectItem>
                      <SelectItem value="manager">マネージャー</SelectItem>
                      <SelectItem value="viewer">閲覧者</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{member.created_at ? new Date(member.created_at).toLocaleDateString("ja-JP") : "—"}</TableCell>
                <TableCell>
                  <button
                    onClick={() => handleDelete(member.id, member.email)}
                    disabled={member.id === currentUserId}
                    className={`transition-colors ${member.id === currentUserId ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-destructive"}`}
                    title={member.id === currentUserId ? "自分自身は削除できません" : "削除"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Main Page                                       */
/* ────────────────────────────────────────────── */

const SettingsPage = () => {
  usePageTitle("設定");
  const { isAdmin } = useUserRole();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">設定</h2>
        <p className="text-muted-foreground text-sm mt-1">目標値・アラート・データ同期・労働時間・メンバー管理</p>
      </div>

      <Tabs defaultValue="targets">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="targets" className="text-xs sm:text-sm">目標値設定</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm">アラート閾値</TabsTrigger>
            <TabsTrigger value="data" className="text-xs sm:text-sm">データ管理</TabsTrigger>
            <TabsTrigger value="workhours" className="text-xs sm:text-sm">労働時間</TabsTrigger>
            {isAdmin && <TabsTrigger value="members" className="text-xs sm:text-sm">メンバー管理</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="targets"><TargetsTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
        <TabsContent value="workhours"><WorkHoursTab /></TabsContent>
        {isAdmin && <TabsContent value="members"><MembersTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
