import { Home, Target, TrendingUp, Wallet, BarChart3, Users, CheckCircle, FileText, Settings, LogOut } from "lucide-react";
import offbeatIcon from "@/assets/offbeat-icon.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";

const menuItems = [
  { title: "ダッシュボード", url: "/dashboard", icon: Home, minRole: "viewer" as const },
  { title: "経営指標", url: "/management", icon: TrendingUp, minRole: "viewer" as const },
  { title: "財務指標", url: "/finance", icon: Wallet, minRole: "viewer" as const },
  { title: "生産性指標", url: "/productivity", icon: BarChart3, minRole: "viewer" as const },
  { title: "顧客指標", url: "/customers", icon: Users, minRole: "viewer" as const },
  { title: "品質指標", url: "/quality", icon: CheckCircle, minRole: "viewer" as const },
  { title: "レポート", url: "/report", icon: FileText, minRole: "viewer" as const },
  { title: "事業計画", url: "/plan", icon: Target, minRole: "viewer" as const },
  { title: "設定", url: "/settings", icon: Settings, minRole: "manager" as const },
];

const ROLE_ORDER: Record<string, number> = { viewer: 0, manager: 1, admin: 2 };

function hasAccess(userRole: UserRole, minRole: string) {
  return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[minRole] ?? 0);
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  viewer: "閲覧者",
};

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useUserRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ログアウトしました");
    navigate("/login");
  };

  const filteredItems = menuItems.filter((item) => hasAccess(role, item.minRole));

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2">
        <img src={offbeatIcon} alt="Off Beat" className="h-7 w-7 object-contain" />
        <h1 className="text-xl font-bold text-foreground tracking-tight">BeatBoard</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {filteredItems.map((item) => {
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
            {ROLE_DISPLAY[role]?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{ROLE_DISPLAY[role] || role}</p>
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
