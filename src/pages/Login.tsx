import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import offbeatIcon from "@/assets/offbeat-icon.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("ログインに失敗しました: " + error.message);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-content-bg">
      <div className="bg-card rounded-lg shadow-sm p-8 w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={offbeatIcon} alt="Off Beat" className="h-8 w-8 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">BeatBoard</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            経営ダッシュボードにログイン
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-foreground text-background rounded-sm text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          アクセスには管理者からの招待が必要です
        </p>
      </div>
    </div>
  );
};

export default Login;
