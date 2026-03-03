import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 bg-content-bg p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
