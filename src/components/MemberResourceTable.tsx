import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, ORG_ID, getMonthLabel } from "@/lib/fiscalYear";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SELF_PATTERNS = ["Off Beat株式会社（自社）", "Off Beat株式会社(自社)"];
const MEMBER_ORDER = ["中村", "岩谷", "久恒", "石川", "林"];
const isSelfWork = (name: string) => !name || SELF_PATTERNS.includes(name);
const fmtYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;

interface MemberClassRow {
  member_name: string;
  employment_type: string;
  start_month: string | null;
  end_month: string | null;
}

export function MemberResourceTable() {
  const fiscalMonths = getFiscalYearMonths(2026);
  const [selectedMember, setSelectedMember] = useState<string>("");

  const hoursQuery = useQuery({
    queryKey: ["member_client_monthly_hours"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("member_client_monthly_hours" as any) as any)
        .select("*")
        .eq("org_id", ORG_ID);
      if (error) throw error;
      return data as { year_month: string; member_name: string; client_name: string; hours: number }[];
    },
  });

  const classQuery = useQuery({
    queryKey: ["member_classifications"],
    queryFn: async () => {
      const { data } = await (supabase.from("member_classifications" as any) as any)
        .select("*")
        .eq("org_id", ORG_ID);
      return (data as MemberClassRow[]) ?? [];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["monthly_sales", "member_resource"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_sales")
        .select("year_month, gross_profit")
        .eq("org_id", ORG_ID)
        .in("year_month", fiscalMonths);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = hoursQuery.isLoading || classQuery.isLoading || salesQuery.isLoading;
  const hours = hoursQuery.data ?? [];
  const classifications = classQuery.data ?? [];
  const sales = salesQuery.data ?? [];

  // Exclude CEO members
  const ceoNames = useMemo(() =>
    classifications.filter((c) => c.employment_type === "CEO").map((c) => c.member_name),
    [classifications]
  );

  const isMemberActive = (memberName: string, ym: string): boolean => {
    const mc = classifications.find((c) => memberName.includes(c.member_name));
    if (!mc) return true; // unknown → show
    if (mc.start_month && ym < mc.start_month) return false;
    if (mc.end_month && ym > mc.end_month) return false;
    return true;
  };

  // Gross profit per month
  const gpByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sales) {
      map[s.year_month] = (map[s.year_month] ?? 0) + s.gross_profit;
    }
    return map;
  }, [sales]);

  // Filter out CEO, group by member
  const memberData = useMemo(() => {
    const filtered = hours.filter(
      (h) => !ceoNames.some((n) => h.member_name.includes(n))
    );

    // Get unique members
    const memberSet = new Set(filtered.map((h) => h.member_name));
    // Sort by predefined order
    const members = Array.from(memberSet).sort((a, b) => {
      const idxA = MEMBER_ORDER.findIndex((n) => a.includes(n));
      const idxB = MEMBER_ORDER.findIndex((n) => b.includes(n));
      const oA = idxA >= 0 ? idxA : 999;
      const oB = idxB >= 0 ? idxB : 999;
      return oA - oB;
    });

    // Per member, per month: totalHours, projectHours
    const result: Record<string, Record<string, { total: number; project: number }>> = {};
    for (const m of members) {
      result[m] = {};
    }
    for (const h of filtered) {
      if (!result[h.member_name]) continue;
      if (!result[h.member_name][h.year_month]) {
        result[h.member_name][h.year_month] = { total: 0, project: 0 };
      }
      result[h.member_name][h.year_month].total += Number(h.hours);
      if (!isSelfWork(h.client_name)) {
        result[h.member_name][h.year_month].project += Number(h.hours);
      }
    }

    // All members' project hours per month (for GP allocation)
    const totalProjectByMonth: Record<string, number> = {};
    for (const m of members) {
      for (const ym of fiscalMonths) {
        const proj = result[m]?.[ym]?.project ?? 0;
        totalProjectByMonth[ym] = (totalProjectByMonth[ym] ?? 0) + proj;
      }
    }

    return { members, data: result, totalProjectByMonth };
  }, [hours, ceoNames, fiscalMonths]);

  if (isLoading) return null;
  if (memberData.members.length === 0) return null;

  const { members, data, totalProjectByMonth } = memberData;

  type RowDef = { label: string; key: string };
  const rowDefs: RowDef[] = [
    { label: "総労働時間", key: "total" },
    { label: "案件工数", key: "project" },
    { label: "案件稼働率", key: "utilization" },
    { label: "粗利工数単価", key: "gph" },
    { label: "案件粗利工数単価", key: "projectGph" },
  ];

  const getCellValue = (member: string, ym: string, key: string): string => {
    if (!isMemberActive(member, ym)) return "—";
    const d = data[member]?.[ym];
    const total = d?.total ?? 0;
    const project = d?.project ?? 0;

    if (key === "total") return total > 0 ? `${total.toFixed(1)}h` : "—";
    if (key === "project") return project > 0 ? `${project.toFixed(1)}h` : "—";
    if (key === "utilization") {
      if (total === 0) return "—";
      return `${((project / total) * 100).toFixed(1)}%`;
    }

    // GP allocation
    const monthGp = gpByMonth[ym] ?? 0;
    const totalProj = totalProjectByMonth[ym] ?? 0;
    const allocatedGp = totalProj > 0 ? monthGp * (project / totalProj) : 0;

    if (key === "gph") {
      if (total === 0) return "—";
      return fmtYen(allocatedGp / total);
    }
    if (key === "projectGph") {
      if (project === 0) return "—";
      return fmtYen(allocatedGp / project);
    }
    return "—";
  };

  const getCellClass = (member: string, ym: string, key: string): string => {
    if (!isMemberActive(member, ym)) return "";
    const d = data[member]?.[ym];
    const total = d?.total ?? 0;
    const project = d?.project ?? 0;

    if (key === "utilization" && total > 0) {
      const rate = (project / total) * 100;
      if (rate < 50) return "text-destructive font-semibold";
    }
    return "";
  };

  // Default to first member (中村)
  const activeMember = selectedMember && members.includes(selectedMember) ? selectedMember : members[0];
  const displayMembers = [activeMember];

  return (
    <div className="bg-card rounded-lg shadow-sm p-5 overflow-x-auto animate-fade-in">
      <h3 className="text-sm font-semibold mb-3">メンバー別 リソース内訳</h3>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {members.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMember(m)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeMember === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">項目</TableHead>
            {fiscalMonths.map((ym) => (
              <TableHead key={ym} className="text-center whitespace-nowrap min-w-[90px]">
                {getMonthLabel(ym)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayMembers.map((member) => (
            <>
              {/* Member header row (only in 全員 mode) */}
              {selectedMember === null && (
                <TableRow key={`${member}-header`} className="bg-muted/50">
                  <TableCell
                    colSpan={fiscalMonths.length + 1}
                    className="font-semibold text-xs sticky left-0 z-10 bg-muted/50"
                  >
                    {member}
                  </TableCell>
                </TableRow>
              )}
              {rowDefs.map((rd) => (
                <TableRow key={`${member}-${rd.key}`}>
                  <TableCell className={cn("text-xs sticky left-0 bg-card z-10 whitespace-nowrap", selectedMember === null ? "pl-6" : "pl-3 font-medium")}>
                    {rd.label}
                  </TableCell>
                  {fiscalMonths.map((ym) => (
                    <TableCell
                      key={ym}
                      className={cn(
                        "text-center text-xs font-mono tabular-nums whitespace-nowrap",
                        getCellClass(member, ym, rd.key)
                      )}
                    >
                      {getCellValue(member, ym, rd.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
