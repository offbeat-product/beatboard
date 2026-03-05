import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function getFiscalYearMonths() {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 8 ? 2025 : 2026;
    const m = ((i + 4) % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export function useCustomersData() {
  const fiscalMonths = getFiscalYearMonths();
  const currentMonth = "2026-03";

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, cost, gross_profit, client_id")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("metric_name, target_value")
        .eq("org_id", ORG_ID)
        .in("metric_name", ["top1_concentration", "top3_concentration"]);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = salesQuery.isLoading || clientsQuery.isLoading || targetsQuery.isLoading;
  const isError = salesQuery.isError || clientsQuery.isError || targetsQuery.isError;
  const sales = salesQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];

  const targetTop1 = (targets.find((t) => t.metric_name === "top1_concentration")?.target_value ?? 0.25) * 100;
  const targetTop3 = (targets.find((t) => t.metric_name === "top3_concentration")?.target_value ?? 0.60) * 100;

  // Current month client breakdown
  const currentSales = sales.filter((s) => s.year_month === currentMonth);
  const totalCurrentRevenue = currentSales.reduce((s, r) => s + r.revenue, 0);

  // Build client revenue map for current month
  const clientRevenueMap: Record<string, number> = {};
  currentSales.forEach((s) => {
    const key = s.client_id ?? "other";
    clientRevenueMap[key] = (clientRevenueMap[key] ?? 0) + s.revenue;
  });

  // Sort by revenue desc
  const sortedClientRevenues = Object.entries(clientRevenueMap)
    .map(([id, revenue]) => ({ id, revenue, pct: totalCurrentRevenue > 0 ? (revenue / totalCurrentRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const top1Pct = sortedClientRevenues[0]?.pct ?? 0;
  const top3Pct = sortedClientRevenues.slice(0, 3).reduce((s, c) => s + c.pct, 0);

  // Pie chart data
  const COLORS: Record<string, string> = {};
  const COLOR_LIST = ["#E85B2D", "#3B82F6", "#10B981", "#F59E0B", "#9CA3AF"];
  const pieData = sortedClientRevenues.map((c, i) => {
    const client = clients.find((cl) => cl.id === c.id);
    const name = client?.name ?? "その他";
    const color = COLOR_LIST[Math.min(i, COLOR_LIST.length - 1)];
    COLORS[name] = color;
    return { name, value: Math.round(c.revenue / 10000), pct: c.pct, color };
  });

  // Monthly breakdown by client (for stacked bar & line)
  const monthlyByClient = fiscalMonths.map((ym) => {
    const rows = sales.filter((s) => s.year_month === ym);
    const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
    const entry: Record<string, number | string> = { name: ym.slice(5).replace(/^0/, "") + "月" };

    // Group by client
    const clientRevs: Record<string, number> = {};
    rows.forEach((r) => {
      const cl = clients.find((c) => c.id === r.client_id);
      const key = cl?.name ?? "その他";
      clientRevs[key] = (clientRevs[key] ?? 0) + r.revenue;
    });

    // Add each client value in 万円
    pieData.forEach((p) => {
      entry[p.name] = Math.round((clientRevs[p.name] ?? 0) / 10000);
    });

    // Concentration
    const sorted = Object.values(clientRevs).sort((a, b) => b - a);
    entry["top1"] = totalRev > 0 ? Number(((sorted[0] ?? 0) / totalRev * 100).toFixed(1)) : 0;
    entry["top3"] = totalRev > 0 ? Number((sorted.slice(0, 3).reduce((s, v) => s + v, 0) / totalRev * 100).toFixed(1)) : 0;

    return entry;
  });

  // Client table data
  const clientTable = clients.map((c) => {
    const rev = clientRevenueMap[c.id] ?? 0;
    const pct = totalCurrentRevenue > 0 ? (rev / totalCurrentRevenue) * 100 : 0;
    return { ...c, revenue: rev, pct };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    isLoading,
    isError,
    top1Pct,
    top3Pct,
    targetTop1,
    targetTop3,
    totalCurrentRevenue,
    pieData,
    monthlyByClient,
    clientTable,
    clientNames: pieData.map((p) => p.name),
    clientColors: pieData.reduce((acc, p) => { acc[p.name] = p.color; return acc; }, {} as Record<string, string>),
  };
}
