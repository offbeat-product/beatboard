import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function AccessBlockedScreen() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ログアウトしました");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-content-bg">
      <div className="bg-card rounded-lg shadow-sm border border-border p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold text-foreground">アクセス権限がありません</h1>
        <p className="text-sm text-muted-foreground">
          管理者にお問い合わせください。
        </p>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          ログアウト
        </Button>
      </div>
    </div>
  );
}
