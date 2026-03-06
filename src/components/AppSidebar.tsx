import { Home, TrendingUp, BarChart3, Users, CheckCircle, FileText, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const menuItems = [
  { title: "ダッシュボード", url: "/dashboard", icon: Home },
  { title: "経営指標", url: "/management", icon: TrendingUp },
  { title: "生産性指標", url: "/productivity", icon: BarChart3 },
  { title: "顧客指標", url: "/customers", icon: Users },
  { title: "品質指標", url: "/quality", icon: CheckCircle },
  { title: "レポート", url: "/ai", icon: FileText },
  { title: "設定", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ログアウトしました");
    navigate("/login");
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5">
        <h1 className="text-xl font-bold text-primary tracking-tight">BeatBoard</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = item.url === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/dashboard"}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors relative ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              activeClassName=""
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
              )}
              <item.icon className="h-[18px] w-[18px]" />
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            管
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">管理者</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="ログアウト"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
