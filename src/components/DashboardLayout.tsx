import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        {/* Mobile header */}
        {isMobile && (
          <header className="sticky top-0 z-30 flex items-center h-12 px-4 border-b border-border bg-background">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 -ml-1.5 hover:bg-secondary rounded-sm">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="ml-3 text-base font-bold text-primary tracking-tight">BeatBoard</h1>
          </header>
        )}
        <main className="flex-1 bg-content-bg p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
