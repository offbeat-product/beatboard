import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, CURRENT_MONTH, ORG_ID, getFiscalYearLabel, getFiscalMonthNumber, getMonthLabel } from "@/lib/fiscalYear";

export function useProductivityData() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const currentMonth = CURRENT_MONTH;
  const previousMonth = "2026-02";
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const monthsElapsed = getFiscalMonthNumber(currentMonth);
  const fyLabel = getFiscalYearLabel(currentMonth);

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "productivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const kpiQuery = useQuery({
    queryKey: ["kpi_snapshots", "productivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_snapshots")
        .select("snapshot_date, metric_name, actual_value")
        .eq("org_id", ORG_ID)
        .in("metric_name", [
          "gross_profit_per_hour",
          "gross_profit_per_project_hour",
          "project_hours",
          "total_labor_hours",
        ]);
      if (error) throw error;
      return data;
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", "productivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("metric_name, target_value")
        .eq("org_id", ORG_ID)
        .in("metric_name", ["gross_profit_per_hour", "gross_profit_per_project_hour"]);
      if (error) throw error;
      return data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["members", "productivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, member_type, status")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = salesQuery.isLoading || kpiQuery.isLoading || targetsQuery.isLoading || membersQuery.isLoading;
  const isError = salesQuery.isError || kpiQuery.isError || targetsQuery.isError || membersQuery.isError;
  const sales = salesQuery.data ?? [];
  const kpiSnapshots = kpiQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  const targetGPH = targets.find((t) => t.metric_name === "gross_profit_per_hour")?.target_value ?? 21552;
  const targetProjectGPH = targets.find((t) => t.metric_name === "gross_profit_per_project_hour")?.target_value ?? 25000;

  // Staffing rules per month
  const getStaffing = (ym: string) => {
    if (ym >= "2026-02") {
      return { employees: 2, partTimers: 3, employeeHours: 160, partTimerTotalHours: 3 * 140 };
    }
    return { employees: 3, partTimers: 0, employeeHours: 160, partTimerTotalHours: 0 };
  };

  // Build monthly data
  const monthlyData = fiscalMonths.map((ym) => {
    const salesRows = sales.filter((s) => s.year_month === ym);
    const revenue = salesRows.reduce((s, r) => s + r.revenue, 0);
    const grossProfit = salesRows.reduce((s, r) => s + r.gross_profit, 0);

    const staffing = getStaffing(ym);
    const headcount = staffing.employees + staffing.partTimers;

    // Total labor hours from kpi_snapshots or calculated
    const totalHoursSnap = kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym) && k.metric_name === "total_labor_hours");
    const totalLaborHours = totalHoursSnap
      ? totalHoursSnap.actual_value
      : staffing.employees * staffing.employeeHours + staffing.partTimerTotalHours;

    // Project hours from kpi_snapshots or calculated
    const projectHoursSnap = kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym) && k.metric_name === "project_hours");
    const internalHours = staffing.employees * 40 + staffing.partTimers * 20;
    const projectHours = projectHoursSnap
      ? projectHoursSnap.actual_value
      : totalLaborHours - internalHours;

    // GPH from kpi_snapshots or calculated
    const gphSnap = kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym) && k.metric_name === "gross_profit_per_hour");
    const gph = gphSnap ? gphSnap.actual_value : (totalLaborHours > 0 ? grossProfit / totalLaborHours : 0);

    const projectGphSnap = kpiSnapshots.find((k) => k.snapshot_date.startsWith(ym) && k.metric_name === "gross_profit_per_project_hour");
    const projectGph = projectGphSnap ? projectGphSnap.actual_value : (projectHours > 0 ? grossProfit / projectHours : 0);

    const utilizationRate = totalLaborHours > 0 ? (projectHours / totalLaborHours) * 100 : 0;
    const revenuePerHead = headcount > 0 ? revenue / headcount : 0;
    const grossProfitPerHead = headcount > 0 ? grossProfit / headcount : 0;

    return {
      ym,
      label: getMonthLabel(ym),
      revenue,
      grossProfit,
      employees: staffing.employees,
      partTimers: staffing.partTimers,
      headcount,
      totalLaborHours,
      projectHours,
      utilizationRate,
      gph,
      projectGph,
      revenuePerHead,
      grossProfitPerHead,
    };
  });

  const currentData = monthlyData.find((m) => m.ym === currentMonth);
  const prevData = monthlyData.find((m) => m.ym === previousMonth);

  // GPH KPIs
  const currentGPH = currentData?.gph ?? 0;
  const prevGPH = prevData?.gph ?? 0;
  const gphMomChange = prevGPH > 0 ? ((currentGPH - prevGPH) / prevGPH) * 100 : 0;

  const currentProjectGPH = currentData?.projectGph ?? 0;
  const prevProjectGPH = prevData?.projectGph ?? 0;
  const projectGphMomChange = prevProjectGPH > 0 ? ((currentProjectGPH - prevProjectGPH) / prevProjectGPH) * 100 : 0;

  // Averages (fiscal year up to current month)
  const activeMonths = monthlyData.slice(0, currentIdx + 1).filter((m) => m.gph > 0);
  const avgGPH = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.gph, 0) / activeMonths.length : 0;

  const activeProjectMonths = monthlyData.slice(0, currentIdx + 1).filter((m) => m.projectGph > 0);
  const avgProjectGPH = activeProjectMonths.length > 0 ? activeProjectMonths.reduce((s, m) => s + m.projectGph, 0) / activeProjectMonths.length : 0;

  // Chart data
  const gphChartData = monthlyData.map((m) => ({
    name: m.label,
    粗利工数単価: Math.round(m.gph),
    案件粗利工数単価: Math.round(m.projectGph),
  }));

  const perHeadChartData = monthlyData.map((m) => ({
    name: m.label,
    "1人あたり売上": Math.round(m.revenuePerHead),
    "1人あたり粗利": Math.round(m.grossProfitPerHead),
  }));

  return {
    isLoading,
    isError,
    fyLabel,
    monthsElapsed,
    // GPH (total labor hours)
    currentGPH,
    prevGPH,
    gphMomChange,
    avgGPH,
    targetGPH,
    // Project GPH
    currentProjectGPH,
    prevProjectGPH,
    projectGphMomChange,
    avgProjectGPH,
    targetProjectGPH,
    // Data
    monthlyData,
    gphChartData,
    perHeadChartData,
  };
}
