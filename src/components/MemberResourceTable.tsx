import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, getCurrentMonth, getFiscalEndYear, ORG_ID } from "@/lib/fiscalYear";

const fmtMonthShort = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}/${Number(m)}月`;
};
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SELF_PATTERNS = ["Off Beat株式会社（自社）", "Off Beat株式会社(自社)"];
const MEMBER_ORDER = ["中村", "岩谷", "久恒", "石川", "林"];
const isSelfWork = (name: string) => !name || SELF_PATTERNS.includes(name);

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

  const isLoading = hoursQuery.isLoading || classQuery.isLoading;
  const hours = hoursQuery.data ?? [];
  const classifications = classQuery.data ?? [];

  // Exclude CEO members
  const ceoNames = useMemo(() =>
    classifications.filter((c) => c.employment_type === "CEO").map((c) => c.member_name),
    [classifications]
  );

  const isMemberActive = (memberName: string, ym: string): boolean => {
    const mc = classifications.find((c) => memberName.includes(c.member_name));
    if (!mc) return true;
    if (mc.start_month && ym < mc.start_month) return false;
    if (mc.end_month && ym > mc.end_month) return false;
    return true;
  };

  // Filter out CEO, group by member
  const memberData = useMemo(() => {
    const filtered = hours.filter(
      (h) => !ceoNames.some((n) => h.member_name.includes(n))
    );

    const memberSet = new Set(filtered.map((h) => h.member_name));
    const members = Array.from(memberSet).sort((a, b) => {
      const idxA = MEMBER_ORDER.findIndex((n) => a.includes(n));
      const idxB = MEMBER_ORDER.findIndex((n) => b.includes(n));
      return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
    });

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

    return { members, data: result };
  }, [hours, ceoNames, fiscalMonths]);

  const { members, data } = memberData;

  if (isLoading) return null;
  if (members.length === 0) return null;

  type RowDef = { label: string; key: string };
  const rowDefs: RowDef[] = [
    { label: "総労働時間", key: "total" },
    { label: "案件工数", key: "project" },
    { label: "案件稼働率", key: "utilization" },
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
    return "—";
  };

  const getAnnualValue = (member: string, key: string): string => {
    let totalSum = 0;
    let projectSum = 0;
    for (const ym of fiscalMonths) {
      if (!isMemberActive(member, ym)) continue;
      const d = data[member]?.[ym];
      totalSum += d?.total ?? 0;
      projectSum += d?.project ?? 0;
    }
    if (key === "total") return totalSum > 0 ? `${totalSum.toFixed(1)}h` : "—";
    if (key === "project") return projectSum > 0 ? `${projectSum.toFixed(1)}h` : "—";
    if (key === "utilization") {
      if (totalSum === 0) return "—";
      return `${((projectSum / totalSum) * 100).toFixed(1)}%`;
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
      if (rate < 70) return "text-destructive font-semibold";
    }
    return "";
  };

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
            <TableHead className="text-center whitespace-nowrap min-w-[90px] bg-muted/50 font-semibold">通期平均</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayMembers.map((member) => (
            <>
              {rowDefs.map((rd) => (
                <TableRow key={`${member}-${rd.key}`}>
                  <TableCell className="text-xs pl-3 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
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
                  <TableCell className="text-center text-xs font-mono tabular-nums whitespace-nowrap bg-muted/50 font-semibold">
                    {getAnnualValue(member, rd.key)}
                  </TableCell>
                </TableRow>
              ))}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
