import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import offbeatIcon from "@/assets/offbeat-icon.png";

type InviteInfo = {
  id: string;
  role: string;
  org_id: string;
  status: string;
  expires_at: string;
};

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("invite_links")
        .select("id, role, org_id, status, expires_at")
        .eq("token", token)
        .single();

      if (error || !data) { setInvalid(true); setLoading(false); return; }

      const expired = new Date(data.expires_at) < new Date();
      if (data.status !== "active" || expired) {
        setInvalid(true);
        setLoading(false);
        return;
      }
      setInvite(data as InviteInfo);
      setLoading(false);
    })();
  }, [token]);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !invite) return;
    if (password.length < 6) {
      toast.error("パスワードは6文字以上で入力してください");
      return;
    }
    setSubmitting(true);
    try {
      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (userId) {
        // Update profile with role from invite
        // Wait a moment for the trigger to create the profile
        await new Promise((r) => setTimeout(r, 1000));
        await supabase
          .from("profiles")
          .update({ role: invite.role, org_id: invite.org_id, status: "active" })
          .eq("id", userId);

        // Mark invite as used
        await supabase
          .from("invite_links")
          .update({ status: "used", used_by: userId })
          .eq("id", invite.id);
      }

      toast.success("アカウントを作成しました。ダッシュボードに移動します。");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "サインアップに失敗しました");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-content-bg">
        <span className="text-muted-foreground text-sm">読み込み中...</span>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-content-bg">
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 max-w-md w-full text-center space-y-4">
          <img src={offbeatIcon} alt="BeatBoard" className="h-10 w-10 mx-auto" />
          <h1 className="text-xl font-bold">このリンクは無効です</h1>
          <p className="text-sm text-muted-foreground">
            招待リンクが期限切れまたは既に使用済みです。管理者に新しいリンクを依頼してください。
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            ログインページへ
          </Button>
        </div>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: "管理者",
    manager: "マネージャー",
    viewer: "閲覧者",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-content-bg">
      <div className="bg-card rounded-lg shadow-sm border border-border p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <img src={offbeatIcon} alt="BeatBoard" className="h-10 w-10 mx-auto" />
          <h1 className="text-xl font-bold">BeatBoard に参加</h1>
          <p className="text-sm text-muted-foreground">
            ロール: <span className="font-medium text-foreground">{ROLE_LABELS[invite!.role] || invite!.role}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
            />
          </div>
          <Button className="w-full" onClick={handleSignup} disabled={submitting || !email.trim() || !password.trim()}>
            {submitting ? "作成中..." : "アカウントを作成"}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          既にアカウントをお持ちの場合は
          <button onClick={() => navigate("/login")} className="text-primary hover:underline ml-1">
            ログイン
          </button>
        </p>
      </div>
    </div>
  );
}
