import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, RefreshCw, Link2, Copy, XCircle, Trash2, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { ORG_ID } from "@/lib/fiscalYear";

/* ────────────────────────────────────────────── */
/* Tab 1: アラート設定                              */
/* ────────────────────────────────────────────── */

interface AlertMetric {
  key: string;
  label: string;
  section: string;
  warnDefault: number;
  dangerDefault: number;
  suffix: string;
  warnLabel: string;
  dangerLabel: string;
}

const ALERT_METRICS: AlertMetric[] = [
  // 経営指標
  { key: "rev_achievement", label: "売上達成率", section: "経営指標アラート", warnDefault: 90, dangerDefault: 80, suffix: "%", warnLabel: "< 90%", dangerLabel: "< 80%" },
  { key: "gm_rate", label: "粗利率", section: "経営指標アラート", warnDefault: 65, dangerDefault: 60, suffix: "%", warnLabel: "< 65%", dangerLabel: "< 60%" },
  { key: "op_rate", label: "営業利益率", section: "経営指標アラート", warnDefault: 15, dangerDefault: 10, suffix: "%", warnLabel: "< 15%", dangerLabel: "< 10%" },
  // 顧客指標
  { key: "client_count", label: "顧客数", section: "顧客指標アラート", warnDefault: 80, dangerDefault: 60, suffix: "%", warnLabel: "< 目標の80%", dangerLabel: "< 目標の60%" },
  { key: "client_unit_price", label: "顧客単価", section: "顧客指標アラート", warnDefault: 85, dangerDefault: 70, suffix: "%", warnLabel: "< 目標の85%", dangerLabel: "< 目標の70%" },
  { key: "project_count", label: "案件数", section: "顧客指標アラート", warnDefault: 80, dangerDefault: 60, suffix: "%", warnLabel: "< 目標の80%", dangerLabel: "< 目標の60%" },
  { key: "project_unit_price", label: "案件単価", section: "顧客指標アラート", warnDefault: 85, dangerDefault: 70, suffix: "%", warnLabel: "< 目標の85%", dangerLabel: "< 目標の70%" },
  // 生産性指標
  { key: "gph", label: "粗利工数単価", section: "生産性指標アラート", warnDefault: 18000, dangerDefault: 15000, suffix: "円", warnLabel: "< ¥18,000", dangerLabel: "< ¥15,000" },
  { key: "project_gph", label: "案件粗利工数単価", section: "生産性指標アラート", warnDefault: 22000, dangerDefault: 18000, suffix: "円", warnLabel: "< ¥22,000", dangerLabel: "< ¥18,000" },
  { key: "utilization", label: "案件稼働率", section: "生産性指標アラート", warnDefault: 70, dangerDefault: 60, suffix: "%", warnLabel: "< 70%", dangerLabel: "< 60%" },
  // 品質指標
  { key: "on_time", label: "納期遵守率", section: "品質指標アラート", warnDefault: 95, dangerDefault: 90, suffix: "%", warnLabel: "< 95%", dangerLabel: "< 90%" },
  { key: "revision", label: "修正発生率", section: "品質指標アラート", warnDefault: 20, dangerDefault: 30, suffix: "%", warnLabel: "> 20%", dangerLabel: "> 30%" },
];

function AlertsTab() {
  const [values, setValues] = useState<Record<string, { warn: number; danger: number }>>(() => {
    const init: Record<string, { warn: number; danger: number }> = {};
    ALERT_METRICS.forEach((a) => { init[a.key] = { warn: a.warnDefault, danger: a.dangerDefault }; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("alert_settings" as any)
        .select("*")
        .eq("org_id", ORG_ID);
      if (data && (data as any[]).length > 0) {
        const newValues = { ...values };
        (data as any[]).forEach((row: any) => {
          if (newValues[row.metric_key]) {
            newValues[row.metric_key] = { warn: Number(row.warn_value), danger: Number(row.danger_value) };
          }
        });
        setValues(newValues);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete and re-insert
      await (supabase.from("alert_settings" as any) as any).delete().eq("org_id", ORG_ID);
      const inserts = ALERT_METRICS.map((m) => ({
        org_id: ORG_ID,
        metric_key: m.key,
        warn_value: values[m.key]?.warn ?? m.warnDefault,
        danger_value: values[m.key]?.danger ?? m.dangerDefault,
      }));
      const { error } = await (supabase.from("alert_settings" as any) as any).insert(inserts);
      if (error) throw error;
      toast.success("アラート設定を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
    setSaving(false);
  };

  const resetDefaults = () => {
    const init: Record<string, { warn: number; danger: number }> = {};
    ALERT_METRICS.forEach((a) => { init[a.key] = { warn: a.warnDefault, danger: a.dangerDefault }; });
    setValues(init);
    toast.info("デフォルト値に戻しました（保存ボタンで確定）");
  };

  const sections = [...new Set(ALERT_METRICS.map(m => m.section))];

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">{section}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs min-w-[140px]">指標</TableHead>
                <TableHead className="text-xs text-center">⚠️ 警告閾値</TableHead>
                <TableHead className="text-xs text-center">🚨 危険閾値</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALERT_METRICS.filter(m => m.section === section).map((a) => (
                <TableRow key={a.key}>
                  <TableCell className="text-sm font-medium">{a.label}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        type="number"
                        value={values[a.key]?.warn ?? a.warnDefault}
                        onChange={(e) => setValues((p) => ({ ...p, [a.key]: { ...p[a.key], warn: parseFloat(e.target.value) || 0 } }))}
                        className="h-8 w-24 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">{a.suffix}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        type="number"
                        value={values[a.key]?.danger ?? a.dangerDefault}
                        onChange={(e) => setValues((p) => ({ ...p, [a.key]: { ...p[a.key], danger: parseFloat(e.target.value) || 0 } }))}
                        className="h-8 w-24 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">{a.suffix}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-1.5" />デフォルトに戻す
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 2: データ管理                                */
/* ────────────────────────────────────────────── */

interface MemberClassification {
  id?: string;
  member_name: string;
  employment_type: string;
  start_month: string;
  end_month: string | null;
}

const EMPLOYMENT_TYPES = ["CEO", "正社員", "パート", "業務委託"];

function DataTab() {
  const [boardWebhookUrl, setBoardWebhookUrl] = useState("https://offbeat-inc.app.n8n.cloud/webhook/wf01-board-sync");
  const [freeeWebhookUrl, setFreeeWebhookUrl] = useState("https://offbeat-inc.app.n8n.cloud/webhook/wf02-freee-sync");
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [members, setMembers] = useState<MemberClassification[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [orgRes, membersRes] = await Promise.all([
        supabase.from("organizations").select("settings_json").eq("id", ORG_ID).single(),
        (supabase.from("member_classifications" as any) as any).select("*").eq("org_id", ORG_ID).order("created_at"),
      ]);
      if (orgRes.data?.settings_json && typeof orgRes.data.settings_json === "object") {
        const s = orgRes.data.settings_json as Record<string, unknown>;
        if (s.webhook_board_url) setBoardWebhookUrl(s.webhook_board_url as string);
        if (s.webhook_freee_url) setFreeeWebhookUrl(s.webhook_freee_url as string);
      }
      if (membersRes.data && (membersRes.data as any[]).length > 0) {
        setMembers((membersRes.data as any[]).map((r: any) => ({
          id: r.id,
          member_name: r.member_name,
          employment_type: r.employment_type,
          start_month: r.start_month || "2025-05",
          end_month: r.end_month || null,
        })));
      }
      setLoaded(true);
    })();
  }, []);

  const handleSaveWebhooks = async () => {
    setSavingWebhooks(true);
    try {
      const { data: org } = await supabase.from("organizations").select("id, settings_json").eq("id", ORG_ID).single();
      if (!org) { toast.error("組織情報が見つかりません"); return; }
      const settings = typeof org.settings_json === "object" && org.settings_json !== null ? org.settings_json as Record<string, unknown> : {};
      const { error } = await supabase.from("organizations").update({
        settings_json: { ...settings, webhook_board_url: boardWebhookUrl, webhook_freee_url: freeeWebhookUrl },
      }).eq("id", org.id);
      if (error) throw error;
      toast.success("Webhook URLを保存しました");
    } catch { toast.error("保存に失敗しました"); }
    setSavingWebhooks(false);
  };

  const addMemberRow = () => {
    setMembers((prev) => [...prev, { member_name: "", employment_type: "正社員", start_month: "2025-05", end_month: null }]);
  };

  const updateMemberRow = (idx: number, field: keyof MemberClassification, value: string | null) => {
    setMembers((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMemberRow = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveMembers = async () => {
    setSavingMembers(true);
    try {
      await (supabase.from("member_classifications" as any) as any).delete().eq("org_id", ORG_ID);
      const inserts = members.filter((m) => m.member_name.trim()).map((m) => ({
        org_id: ORG_ID,
        member_name: m.member_name.trim(),
        employment_type: m.employment_type,
        start_month: m.start_month || null,
        end_month: m.end_month || null,
      }));
      if (inserts.length > 0) {
        const { error } = await (supabase.from("member_classifications" as any) as any).insert(inserts);
        if (error) throw error;
      }
      toast.success("メンバー分類を保存しました");
    } catch { toast.error("保存に失敗しました"); }
    setSavingMembers(false);
  };

  return (
    <div className="space-y-6">
      {/* Webhook URL Settings */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">外部連携設定</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Board同期 Webhook URL</Label>
            <Input value={boardWebhookUrl} onChange={(e) => setBoardWebhookUrl(e.target.value)} className="text-xs" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">freee同期 Webhook URL</Label>
            <Input value={freeeWebhookUrl} onChange={(e) => setFreeeWebhookUrl(e.target.value)} className="text-xs" placeholder="https://..." />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleSaveWebhooks} disabled={savingWebhooks}>
            <Save className="h-4 w-4 mr-1.5" />{savingWebhooks ? "保存中..." : "URL保存"}
          </Button>
        </div>
      </div>

      {/* Sync Log Placeholder */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">同期ログ</h3>
        <p className="text-sm text-muted-foreground">同期ログは準備中です</p>
      </div>

      {/* Member Classification */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">メンバー分類設定</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addMemberRow} className="text-xs">+ メンバー追加</Button>
            <Button size="sm" onClick={handleSaveMembers} disabled={savingMembers} className="text-xs gap-1">
              <Save className="h-3 w-3" />{savingMembers ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">生産性指標のPace CSV処理で使用するメンバー分類です。CEOは全集計から除外されます。</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">メンバー名</TableHead>
                <TableHead className="text-xs">雇用形態</TableHead>
                <TableHead className="text-xs">在籍開始</TableHead>
                <TableHead className="text-xs">在籍終了</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="p-1">
                    <Input value={m.member_name} onChange={(e) => updateMemberRow(i, "member_name", e.target.value)} className="h-8 text-xs" placeholder="氏名" />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={m.employment_type} onValueChange={(v) => updateMemberRow(i, "employment_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t === "CEO" ? "CEO（除外）" : t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input value={m.start_month} onChange={(e) => updateMemberRow(i, "start_month", e.target.value)} className="h-8 text-xs w-28" placeholder="2025-05" />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input value={m.end_month ?? ""} onChange={(e) => updateMemberRow(i, "end_month", e.target.value || null)} className="h-8 text-xs w-28" placeholder="空=通期" />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button variant="ghost" size="sm" onClick={() => removeMemberRow(i)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">メンバーが登録されていません</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Tab 3: メンバー管理                               */
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
        <div className="overflow-x-auto">
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
      </div>

      {/* Members table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">メンバー一覧</h3>
        </div>
        <div className="overflow-x-auto">
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
        <p className="text-muted-foreground text-sm mt-1">アラート・データ管理・メンバー管理</p>
      </div>

      <Tabs defaultValue="alerts">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="alerts" className="text-xs sm:text-sm">アラート設定</TabsTrigger>
            <TabsTrigger value="data" className="text-xs sm:text-sm">データ管理</TabsTrigger>
            {isAdmin && <TabsTrigger value="members" className="text-xs sm:text-sm">メンバー管理</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
        {isAdmin && <TabsContent value="members"><MembersTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
