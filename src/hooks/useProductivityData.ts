import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, getCurrentMonth, getPreviousMonth, getFiscalEndYear, ORG_ID, getFiscalYearLabel, getFiscalMonthNumber, getMonthLabel } from "@/lib/fiscalYear";

export interface MonthlyHoursInput {
  employeeTotalHours: number;
  employeeProjectHours: number;
  partTimerTotalHours: number;
  partTimerProjectHours: number;
}

export interface MonthlyProductivityRow {
  ym: string;
  label: string;
  revenue: number;
  grossProfit: number;
  employees: number;
  partTimers: number;
  headcount: number;
  employeeTotalHours: number;
  employeeProjectHours: number;
  partTimerTotalHours: number;
  partTimerProjectHours: number;
  totalLaborHours: number;
  projectHours: number;
  utilizationRate: number;
  gph: number;
  projectGph: number;
  revenuePerHead: number;
  grossProfitPerHead: number;
}

export function useProductivityData(months?: string[]) {
  const currentMonth = getCurrentMonth();
  const fiscalMonths = months && months.length > 0 ? months : getFiscalYearMonths(getFiscalEndYear(currentMonth));
  const previousMonth = getPreviousMonth(currentMonth);
  const currentIdx = fiscalMonths.indexOf(currentMonth);
  const fyLabel = getFiscalYearLabel(currentMonth);
  // Always fetch current & previous month so KPI cards work even when range doesn't include them
  const extraMonths = [currentMonth, previousMonth].filter((m) => !fiscalMonths.includes(m));
  const fetchMonths = [...fiscalMonths, ...extraMonths];
  const rangeKey = fetchMonths.join(",");

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "productivity", rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, revenue, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fetchMonths);
      if (error) throw error;
      return data;
    },
  });

  const kpiQuery = useQuery({
    queryKey: ["kpi_snapshots", "productivity", rangeKey],
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
          "employee_total_hours",
          "employee_project_hours",
          "parttimer_total_hours",
          "parttimer_project_hours",
          "fulltime_count",
          "parttime_count",
          "fulltime_total_hours",
          "fulltime_project_hours",
          "parttime_total_hours",
          "parttime_project_hours",
          "pace_data_exists",
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

  // Staffing rules per month (defaults)
  const getStaffing = (ym: string) => {
    // Check kpi_snapshots for Pace-derived counts first
    const findSnap = (metric: string) => {
      const matches = kpiSnapshots.filter((k) => k.snapshot_date.startsWith(ym) && k.metric_name === metric);
      return matches.length > 0 ? matches[matches.length - 1] : undefined;
    };
    const ftCount = findSnap("fulltime_count");
    const ptCount = findSnap("parttime_count");
    if (ftCount || ptCount) {
      return {
        employees: ftCount?.actual_value ?? (ym >= "2026-02" ? 2 : 3),
        partTimers: ptCount?.actual_value ?? (ym >= "2026-02" ? 3 : 0),
        employeeHours: 160,
        partTimerHoursEach: 140,
      };
    }
    if (ym >= "2026-02") {
      return { employees: 2, partTimers: 3, employeeHours: 160, partTimerHoursEach: 140 };
    }
    return { employees: 3, partTimers: 0, employeeHours: 160, partTimerHoursEach: 140 };
  };

  // Check if a month has Pace data
  const hasPaceData = (ym: string): boolean => {
    return kpiSnapshots.some((k) => k.snapshot_date.startsWith(ym) && k.metric_name === "pace_data_exists" && k.actual_value === 1);
  };

  // Build base monthly data with default hours from kpi_snapshots or staffing rules
  const getDefaultHoursForMonth = (ym: string): MonthlyHoursInput => {
    const staffing = getStaffing(ym);
    const findSnap = (metric: string) => {
      const matches = kpiSnapshots.filter((k) => k.snapshot_date.startsWith(ym) && k.metric_name === metric);
      return matches.length > 0 ? matches[matches.length - 1] : undefined;
    };

    const empTotalSnap = findSnap("employee_total_hours");
    const empProjSnap = findSnap("employee_project_hours");
    const ptTotalSnap = findSnap("parttimer_total_hours");
    const ptProjSnap = findSnap("parttimer_project_hours");

    // If granular snapshots exist, use them
    if (empTotalSnap || ptTotalSnap) {
      const empTotal = empTotalSnap?.actual_value ?? staffing.employees * staffing.employeeHours;
      const ptTotal = ptTotalSnap?.actual_value ?? staffing.partTimers * staffing.partTimerHoursEach;
      const empProj = empProjSnap?.actual_value ?? Math.max(0, empTotal - staffing.employees * 40);
      const ptProj = ptProjSnap?.actual_value ?? Math.max(0, ptTotal - staffing.partTimers * 20);
      return { employeeTotalHours: empTotal, employeeProjectHours: empProj, partTimerTotalHours: ptTotal, partTimerProjectHours: ptProj };
    }

    // Fall back to legacy total_labor_hours / project_hours snapshots
    const totalSnap = findSnap("total_labor_hours");
    const projSnap = findSnap("project_hours");
    
    const defaultEmpTotal = staffing.employees * staffing.employeeHours;
    const defaultPtTotal = staffing.partTimers * staffing.partTimerHoursEach;
    
    if (totalSnap) {
      // Distribute proportionally
      const total = totalSnap.actual_value;
      const ratio = defaultEmpTotal + defaultPtTotal > 0 ? defaultEmpTotal / (defaultEmpTotal + defaultPtTotal) : 1;
      const empTotal = Math.round(total * ratio);
      const ptTotal = Math.round(total * (1 - ratio));
      const internalEmp = staffing.employees * 40;
      const internalPt = staffing.partTimers * 20;
      const projTotal = projSnap?.actual_value ?? (total - internalEmp - internalPt);
      const empProj = Math.max(0, Math.round(projTotal * ratio));
      const ptProj = Math.max(0, Math.round(projTotal * (1 - ratio)));
      return { employeeTotalHours: empTotal, employeeProjectHours: empProj, partTimerTotalHours: ptTotal, partTimerProjectHours: ptProj };
    }

    // Pure defaults
    const empTotal = defaultEmpTotal;
    const ptTotal = defaultPtTotal;
    const empProj = Math.max(0, empTotal - staffing.employees * 40);
    const ptProj = Math.max(0, ptTotal - staffing.partTimers * 20);
    return { employeeTotalHours: empTotal, employeeProjectHours: empProj, partTimerTotalHours: ptTotal, partTimerProjectHours: ptProj };
  };

  // Compute monthly row from hours input
  const computeMonthlyRow = (ym: string, hours: MonthlyHoursInput): MonthlyProductivityRow => {
    const salesRows = sales.filter((s) => s.year_month === ym);
    const revenue = salesRows.reduce((s, r) => s + r.revenue, 0);
    const grossProfit = salesRows.reduce((s, r) => s + r.gross_profit, 0);
    const staffing = getStaffing(ym);
    const headcount = staffing.employees + staffing.partTimers;

    const totalLaborHours = hours.employeeTotalHours + hours.partTimerTotalHours;
    const projectHours = hours.employeeProjectHours + hours.partTimerProjectHours;
    const utilizationRate = totalLaborHours > 0 ? (projectHours / totalLaborHours) * 100 : 0;
    const gph = totalLaborHours > 0 ? grossProfit / totalLaborHours : 0;
    const projectGph = projectHours > 0 ? grossProfit / projectHours : 0;
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
      ...hours,
      totalLaborHours,
      projectHours,
      utilizationRate,
      gph,
      projectGph,
      revenuePerHead,
      grossProfitPerHead,
    };
  };

  // Default hours map
  const defaultHoursMap: Record<string, MonthlyHoursInput> = {};
  for (const ym of fiscalMonths) {
    defaultHoursMap[ym] = getDefaultHoursForMonth(ym);
  }

  // Build monthly data with default hours
  const monthlyData = fiscalMonths.map((ym) => computeMonthlyRow(ym, defaultHoursMap[ym]));

  const currentData = monthlyData.find((m) => m.ym === currentMonth);
  const prevData = monthlyData.find((m) => m.ym === previousMonth);

  const currentGPH = currentData?.gph ?? 0;
  const prevGPH = prevData?.gph ?? 0;
  const gphMomChange = prevGPH > 0 ? ((currentGPH - prevGPH) / prevGPH) * 100 : 0;

  const currentProjectGPH = currentData?.projectGph ?? 0;
  const prevProjectGPH = prevData?.projectGph ?? 0;
  const projectGphMomChange = prevProjectGPH > 0 ? ((currentProjectGPH - prevProjectGPH) / prevProjectGPH) * 100 : 0;

  const activeMonths = monthlyData.slice(0, currentIdx + 1).filter((m) => m.gph > 0);
  const avgGPH = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.gph, 0) / activeMonths.length : 0;

  const activeProjectMonths = monthlyData.slice(0, currentIdx + 1).filter((m) => m.projectGph > 0);
  const avgProjectGPH = activeProjectMonths.length > 0 ? activeProjectMonths.reduce((s, m) => s + m.projectGph, 0) / activeProjectMonths.length : 0;

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
    fiscalMonths,
    currentMonth,
    previousMonth,
    currentIdx,
    // Targets
    targetGPH,
    targetProjectGPH,
    // GPH
    currentGPH,
    prevGPH,
    gphMomChange,
    avgGPH,
    // Project GPH
    currentProjectGPH,
    prevProjectGPH,
    projectGphMomChange,
    avgProjectGPH,
    // Data
    monthlyData,
    gphChartData,
    perHeadChartData,
    // For editable mode
    defaultHoursMap,
    computeMonthlyRow,
    sales,
    // Pace data flag
    hasPaceData,
  };
}
