import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getMonthLabel } from "@/lib/fiscalYear";

export function useCustomersData() {
  const fiscalMonths = getFiscalYearMonths(2026);

  // Use project_pl for client-level breakdown
  const projectPlQuery = useQuery({
    queryKey: ["project_pl", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pl")
        .select("year_month, revenue, client_id, client_name")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths)
        .not("client_id", "is", null);
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

  const isLoading = projectPlQuery.isLoading || clientsQuery.isLoading || targetsQuery.isLoading;
  const isError = projectPlQuery.isError || clientsQuery.isError || targetsQuery.isError;
  const projectPl = projectPlQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];

  const targetTop1 = (targets.find((t) => t.metric_name === "top1_concentration")?.target_value ?? 0.25) * 100;
  const targetTop3 = (targets.find((t) => t.metric_name === "top3_concentration")?.target_value ?? 0.60) * 100;

  // Find the latest month with data for "current" display
  const monthsWithData = [...new Set(projectPl.map((p) => p.year_month))].sort().reverse();
  const latestMonth = monthsWithData[0] ?? CURRENT_MONTH;

  // Current month client breakdown from project_pl
  const currentSales = projectPl.filter((s) => s.year_month === latestMonth);
  const clientRevenueMap: Record<string, { revenue: number; name: string }> = {};
  currentSales.forEach((s) => {
    const key = String(s.client_id);
    if (!clientRevenueMap[key]) {
      clientRevenueMap[key] = { revenue: 0, name: s.client_name ?? "不明" };
    }
    clientRevenueMap[key].revenue += (s.revenue ?? 0);
  });

  const totalCurrentRevenue = Object.values(clientRevenueMap).reduce((s, c) => s + c.revenue, 0);

  // Sort by revenue desc
  const sortedClientRevenues = Object.entries(clientRevenueMap)
    .map(([id, { revenue, name }]) => ({
      id,
      revenue,
      name,
      pct: totalCurrentRevenue > 0 ? (revenue / totalCurrentRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const top1Pct = sortedClientRevenues[0]?.pct ?? 0;
  const top3Pct = sortedClientRevenues.slice(0, 3).reduce((s, c) => s + c.pct, 0);

  // Pie chart data - top 5 + others
  const COLOR_LIST = ["#E85B2D", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#9CA3AF"];
  const top5 = sortedClientRevenues.slice(0, 5);
  const othersRevenue = sortedClientRevenues.slice(5).reduce((s, c) => s + c.revenue, 0);
  const pieData = top5.map((c, i) => ({
    name: c.name,
    value: c.revenue,
    pct: c.pct,
    color: COLOR_LIST[i],
  }));
  if (othersRevenue > 0) {
    pieData.push({
      name: "その他",
      value: othersRevenue,
      pct: totalCurrentRevenue > 0 ? (othersRevenue / totalCurrentRevenue) * 100 : 0,
      color: COLOR_LIST[5],
    });
  }

  // Monthly breakdown by client (for stacked bar & line)
  const allClientNames = pieData.map((p) => p.name);
  const monthlyByClient = fiscalMonths.map((ym) => {
    const rows = projectPl.filter((s) => s.year_month === ym);
    const totalRev = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const entry: Record<string, number | string> = { name: getMonthLabel(ym) };

    // Group by client
    const clientRevs: Record<string, number> = {};
    rows.forEach((r) => {
      const clientId = String(r.client_id);
      const matchedTop = sortedClientRevenues.find((c) => c.id === clientId);
      const key = matchedTop && top5.some((t) => t.id === clientId) ? matchedTop.name : "その他";
      clientRevs[key] = (clientRevs[key] ?? 0) + (r.revenue ?? 0);
    });

    allClientNames.forEach((name) => {
      entry[name] = clientRevs[name] ?? 0;
    });

    // Concentration
    const sorted = Object.values(clientRevs).sort((a, b) => b - a);
    entry["top1"] = totalRev > 0 ? Number(((sorted[0] ?? 0) / totalRev * 100).toFixed(1)) : 0;
    entry["top3"] = totalRev > 0 ? Number((sorted.slice(0, 3).reduce((s, v) => s + v, 0) / totalRev * 100).toFixed(1)) : 0;

    return entry;
  });

  // Client table data
  const clientTable = sortedClientRevenues.map((c) => {
    const client = clients.find((cl) => String(cl.id) === c.id);
    return {
      id: c.id,
      name: c.name,
      revenue: c.revenue,
      pct: c.pct,
      status: client?.status ?? "unknown",
    };
  });

  return {
    isLoading,
    isError,
    top1Pct,
    top3Pct,
    targetTop1,
    targetTop3,
    totalCurrentRevenue,
    latestMonth,
    pieData,
    monthlyByClient,
    clientTable,
    clientNames: allClientNames,
    clientColors: pieData.reduce((acc, p) => { acc[p.name] = p.color; return acc; }, {} as Record<string, string>),
  };
}
