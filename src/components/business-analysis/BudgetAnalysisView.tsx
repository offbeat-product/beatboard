import { useMemo } from "react";
import { CATEGORY_TO_ROLE, ROLE_META, parseWorkCategory, type Role } from "@/lib/role-mapping";
import { cn } from "@/lib/utils";

export interface BudgetLogRow {
  member_name: string;
  task_category: string | null;
  hours: number;
}

interface Props {
  clientName: string;
  yearMonths: string[];
  grossProfit: number;
  targetRate: number;
  logs: BudgetLogRow[];
}

interface TaskAggregate {
  name: string;
  category: string;
  role: Role;
  hours: number;
  members: { name: string; hours: number }[];
}

interface RoleAggregate {
  role: Role;
  total: number;
  budget: number;
  overrun: number;
  tasks: TaskAggregate[];
}

const fmtH = (h: number) => `${h.toFixed(1)}h`;
const fmtY = (v: number) => `¥${Math.round(v).toLocaleString()}`;

export function BudgetAnalysisView({ clientName, yearMonths, grossProfit, targetRate, logs }: Props) {
  const data = useMemo(() => {
    const totalBudget = targetRate > 0 ? grossProfit / targetRate : 0;
    const perRoleBudget = totalBudget / 3;

    const taskMap = new Map<string, { category: string; role: Role; members: Map<string, number> }>();
    for (const log of logs) {
      const { category, taskName } = parseWorkCategory(log.task_category);
      const role: Role = CATEGORY_TO_ROLE[category] ?? "OH";
      const key = `${category}:::${taskName}`;
      if (!taskMap.has(key)) taskMap.set(key, { category, role, members: new Map() });
      const entry = taskMap.get(key)!;
      entry.members.set(log.member_name, (entry.members.get(log.member_name) ?? 0) + Number(log.hours ?? 0));
    }

    const roles: Record<Role, RoleAggregate> = {
      AM: { role: "AM", total: 0, budget: perRoleBudget, overrun: 0, tasks: [] },
      QM: { role: "QM", total: 0, budget: perRoleBudget, overrun: 0, tasks: [] },
      PM: { role: "PM", total: 0, budget: perRoleBudget, overrun: 0, tasks: [] },
      OH: { role: "OH", total: 0, budget: 0, overrun: 0, tasks: [] },
    };

    for (const [key, entry] of taskMap) {
      const [, name] = key.split(":::");
      const members = [...entry.members.entries()]
        .map(([n, h]) => ({ name: n, hours: h }))
        .sort((a, b) => b.hours - a.hours);
      const hours = members.reduce((s, m) => s + m.hours, 0);
      roles[entry.role].tasks.push({ name, category: entry.category, role: entry.role, hours, members });
      roles[entry.role].total += hours;
    }

    for (const r of Object.values(roles)) {
      r.tasks.sort((a, b) => b.hours - a.hours);
      r.overrun = r.total - r.budget;
    }

    const actualTotal = Object.values(roles).reduce((s, r) => s + r.total, 0);
    const currentRate = actualTotal > 0 ? grossProfit / actualTotal : 0;

    return { totalBudget, perRoleBudget, actualTotal, currentRate, roles };
  }, [grossProfit, targetRate, logs]);

  const monthLabel = yearMonths.length === 1 ? yearMonths[0] : `${yearMonths[0]} 〜 ${yearMonths[yearMonths.length - 1]}`;

  if (grossProfit <= 0) {
    return (
      <div className="p-4 bg-card rounded-lg border text-xs text-muted-foreground">
        粗利データが見つかりません(実工数: {fmtH(data.actualTotal)})
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary card */}
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold">{clientName}</div>
            <div className="text-xs text-muted-foreground">{monthLabel} ・ 粗利 {fmtY(grossProfit)}</div>
          </div>
          <div className="text-[11px] text-muted-foreground text-right space-y-0.5">
            <div>許容工数: <span className="font-mono-num text-foreground">{fmtH(data.totalBudget)}</span> (目標 {fmtY(targetRate)}/h)</div>
            <div>実工数: <span className="font-mono-num text-foreground">{fmtH(data.actualTotal)}</span></div>
            <div>現在の単価: <span className="font-mono-num text-foreground">{fmtY(data.currentRate)}/h</span></div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(["PM", "AM", "QM", "OH"] as Role[]).map((r) => {
            const ov = data.roles[r].overrun;
            const isOH = r === "OH";
            return (
              <div key={r} className="bg-muted rounded-md p-3">
                <div className="text-[11px] text-muted-foreground">
                  {ROLE_META[r].code} {ROLE_META[r].label}
                </div>
                <div className={cn("text-base font-medium font-mono-num", ov > 0 && !isOH && "text-red-700", isOH && ov > 0 && "text-red-700")}>
                  {ov >= 0 ? "+" : ""}
                  {ov.toFixed(1)}h
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role cards: PM, AM, QM, then OH if any */}
      {(["PM", "AM", "QM"] as Role[]).map((r) => (
        <RoleBudgetCard key={r} agg={data.roles[r]} />
      ))}
      {data.roles.OH.total > 0 && <RoleBudgetCard agg={data.roles.OH} />}
    </div>
  );
}

function RoleBudgetCard({ agg }: { agg: RoleAggregate }) {
  const meta = ROLE_META[agg.role];
  const isOH = agg.role === "OH";
  const showBudgetLine = !isOH && agg.total > agg.budget && agg.budget > 0;

  // For each task, compute cumulative position and split if it crosses budget line
  const segments = useMemo(() => {
    if (agg.total <= 0) return [];
    let cum = 0;
    const segs: { task: TaskAggregate; leftPct: number; widthPct: number; overBudget: boolean; isSplit: boolean; splitWidthPct?: number }[] = [];
    for (const t of agg.tasks) {
      const startH = cum;
      const endH = cum + t.hours;
      const leftPct = (startH / agg.total) * 100;
      const widthPct = (t.hours / agg.total) * 100;
      const crosses = !isOH && agg.budget > 0 && startH < agg.budget && endH > agg.budget;
      if (crosses) {
        const splitH = agg.budget - startH;
        const splitWidthPct = (splitH / agg.total) * 100;
        segs.push({ task: t, leftPct, widthPct, overBudget: false, isSplit: true, splitWidthPct });
      } else {
        const overBudget = isOH || (agg.budget > 0 && startH >= agg.budget);
        segs.push({ task: t, leftPct, widthPct, overBudget, isSplit: false });
      }
      cum = endH;
    }
    return segs;
  }, [agg, isOH]);

  const budgetLinePct = agg.total > 0 && agg.budget > 0 ? Math.min(100, (agg.budget / agg.total) * 100) : 0;

  // Determine per-task over-budget marker for list dots (cumulative)
  const taskOverFlags = useMemo(() => {
    const flags = new Map<string, boolean>();
    let cum = 0;
    for (const t of agg.tasks) {
      const over = isOH || (agg.budget > 0 && cum + t.hours / 2 > agg.budget);
      flags.set(t.name, over);
      cum += t.hours;
    }
    return flags;
  }, [agg, isOH]);

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground">{meta.code}</span>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono-num">
          {!isOH && <>予算 {agg.budget.toFixed(1)}h / </>}
          実績 {agg.total.toFixed(1)}h
          {!isOH && (
            <>
              {" "}/ 超過 <span className={cn(agg.overrun > 0 && "text-red-700 font-medium")}>{agg.overrun >= 0 ? "+" : ""}{agg.overrun.toFixed(1)}h</span>
            </>
          )}
        </div>
      </div>

      {/* Stack bar */}
      {agg.total > 0 && (
        <div className="relative mb-4 mt-2">
          <div className="relative h-8 bg-muted rounded overflow-hidden flex">
            {segments.map((s, i) => {
              if (s.isSplit) {
                return (
                  <div key={i} className="flex h-full" style={{ width: `${s.widthPct}%` }} title={`${s.task.name} ${s.task.hours.toFixed(1)}h`}>
                    <div
                      className="h-full flex items-center justify-center text-[11px] font-mono-num overflow-hidden"
                      style={{ width: `${(s.splitWidthPct! / s.widthPct) * 100}%`, background: "#9FE1CB", color: "#04342C", borderRight: "1px solid rgba(255,255,255,0.7)" }}
                    />
                    <div
                      className="h-full flex items-center justify-center text-[11px] font-mono-num overflow-hidden"
                      style={{ width: `${100 - (s.splitWidthPct! / s.widthPct) * 100}%`, background: "#F0997B", color: "#4A1B0C", borderRight: "1px solid rgba(255,255,255,0.7)" }}
                    >
                      {i < 3 && s.widthPct > 8 ? `${s.task.hours.toFixed(1)}h` : ""}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="h-full flex items-center justify-center text-[11px] font-mono-num overflow-hidden"
                  style={{
                    width: `${s.widthPct}%`,
                    background: s.overBudget ? "#F0997B" : "#9FE1CB",
                    color: s.overBudget ? "#4A1B0C" : "#04342C",
                    borderRight: "1px solid rgba(255,255,255,0.7)",
                  }}
                  title={`${s.task.name} ${s.task.hours.toFixed(1)}h`}
                >
                  {i < 3 && s.widthPct > 8 ? `${s.task.hours.toFixed(1)}h` : ""}
                </div>
              );
            })}
          </div>
          {showBudgetLine && (
            <div
              className="absolute pointer-events-none"
              style={{ left: `${budgetLinePct}%`, top: -4, bottom: -4, width: 1.5, background: "hsl(var(--foreground))" }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-background px-1 border rounded">
                予算 {agg.budget.toFixed(1)}h
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task list */}
      <div>
        {agg.tasks.map((t, idx) => {
          const pct = agg.total > 0 ? (t.hours / agg.total) * 100 : 0;
          const isOver = taskOverFlags.get(t.name) ?? false;
          const lead = t.members[0];
          const others = t.members.slice(1);
          const isLast = idx === agg.tasks.length - 1;
          return (
            <div
              key={t.name}
              className={cn(
                "grid items-center gap-2.5 py-2",
                !isLast && "border-b border-border",
              )}
              style={{ gridTemplateColumns: "18px 1fr 70px 44px 140px 50px" }}
            >
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: isOver ? "#F0997B" : "#9FE1CB" }} />
              <div className={cn("text-sm truncate", idx < 3 && "font-medium")} title={t.name}>
                {t.name}
              </div>
              <div className="text-sm font-mono-num text-right font-medium">{t.hours.toFixed(1)}h</div>
              <div className="text-[11px] font-mono-num text-right text-muted-foreground">{pct.toFixed(0)}%</div>
              <div className="text-[11px] truncate" title={t.members.map((m) => `${m.name} ${m.hours.toFixed(1)}h`).join(" / ")}>
                {t.members.length === 1 ? (
                  <>
                    {lead.name}{" "}
                    <span className="bg-red-50 text-red-700 text-[10px] px-1.5 py-0.5 rounded ml-1">1名のみ</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{lead.name} {lead.hours.toFixed(1)}h</span>
                    {others.length > 0 && (
                      <span className="text-muted-foreground"> + {others.map((o) => o.name).join("・")}</span>
                    )}
                  </>
                )}
              </div>
              <div className="text-right">
                {t.members.length > 1 && (
                  <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                    {t.members.length}名
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {agg.tasks.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">タスクなし</div>}
      </div>
    </div>
  );
}
