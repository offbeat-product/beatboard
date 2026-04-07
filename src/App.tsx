import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { CurrencyUnitProvider } from "@/hooks/useCurrencyUnit";
import { RefreshProvider } from "@/hooks/useRefresh";
import { RefreshStatusCard } from "@/components/RefreshStatusCard";
import { AccessBlockedScreen } from "@/components/AccessBlockedScreen";
import Index from "./pages/Index";
import Finance from "./pages/Finance";
import Customers from "./pages/Customers";
import Management from "./pages/Management";
import Productivity from "./pages/Productivity";
import Quality from "./pages/Quality";
import Report from "./pages/Report";
import Plan from "./pages/Plan";
import SettingsPage from "./pages/SettingsPage";
import Login from "./pages/Login";
import InviteAccept from "./pages/InviteAccept";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { loading: roleLoading, isDeleted, profileExists } = useUserRole();

  if (authLoading || roleLoading) return <div className="min-h-screen flex items-center justify-center bg-content-bg"><span className="text-muted-foreground text-sm">読み込み中...</span></div>;
  if (!session) return <Navigate to="/login" replace />;

  if (isDeleted) return <AccessBlockedScreen />;

  return <>{children}</>;
}

const AppRoutes = () => {
  const { session, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-content-bg"><span className="text-muted-foreground text-sm">読み込み中...</span></div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Index />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/management" element={<Management />} />
        <Route path="/productivity" element={<Productivity />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/report" element={<Report />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/pl" element={<Navigate to="/management" replace />} />
      <Route path="/ai" element={<Navigate to="/report" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyUnitProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </CurrencyUnitProvider>
  </QueryClientProvider>
);

export default App;
