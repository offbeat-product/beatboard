import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { CURRENT_MONTH, getFiscalYearLabel, getFiscalMonthNumber } from "@/lib/fiscalYear";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const fyLabel = getFiscalYearLabel(CURRENT_MONTH);
  const fyMonth = getFiscalMonthNumber(CURRENT_MONTH);
  const [y, m] = CURRENT_MONTH.split("-");
  const currentLabel = `${y}年${Number(m)}月`;

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <aside className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </aside>
      ) : (
        <AppSidebar />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button onClick={() => setMobileOpen(true)} className="p-1.5 -ml-1.5 hover:bg-secondary rounded-sm">
                <Menu className="h-5 w-5" />
              </button>
            )}
            {isMobile && <h1 className="text-base font-bold text-foreground tracking-tight">BeatBoard</h1>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {fyLabel} 第{fyMonth}月（{currentLabel}）
            </span>
            <CurrencyToggle />
          </div>
        </header>
        <main className="flex-1 bg-content-bg p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
