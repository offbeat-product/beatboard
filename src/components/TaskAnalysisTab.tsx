import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, AlertTriangle, Briefcase, Clock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/PageSkeleton";

interface Props {
  months: string[];
}

interface TaskLogRow {
  member_name: string;
  client_name: string;
  client_id: string | null;
  project_no: string | null;
  project_name: string | null;
  task_category: string | null;
  task_detail: string | null;
  hours: number;
  is_self_work: boolean;
  year_month: string;
}

interface ProjectPlRow {
  client_id: string | number | null;
  client_name: string | null;
  gross_profit: number;
  year_month: string;
}

const CATEGORY_ORDER = ["マネージャー", "営業", "企画", "進行管理", "共通", "その他"];

function sortCategories(cats: string[]): string[] {
  const known = CATEGORY_ORDER.filter((c) => cats.includes(c));
  const unknown = cats.filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  // Put unknown after 共通 but before その他 if "その他" was preset
  if (known.includes("その他")) {
    const idx = known.indexOf("その他");
    return [...known.slice(0, idx), ...unknown, ...known.slice(idx)];
  }
  return [...known, ...unknown];
}

interface MemberClientHoursRow {
  client_name: string;
  client_id: string | null;
  member_name: string;
  hours: number;
  year_month: string;
}

/** Extract category prefix like "営業" from "【営業】請求書作成・送付" */
function extractMajorCategory(taskCategory: string | null | undefined): string {
  if (!taskCategory) return "未分類";
  const m = taskCategory.match(/^【([^】]+)】/);
  return m ? m[1] : taskCategory;
}

const fmtH = (h: number) => `${(Math.round(h * 10) / 10).toLocaleString()}h`;
const fmtY = (v: number) => `¥${Math.round(v).toLocaleString()}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function TaskAnalysisTab({ months }: Props) {
  const [threshold, setThreshold] = useState<number>(25000);

  // Fetch task logs in range
  const taskLogsQuery = useQuery({
    queryKey: ["member_task_logs", months[0], months[months.length - 1]],
    queryFn: async () => {
      if (months.length === 0) return [] as TaskLogRow[];
      const { data, error } = await (supabase.from("member_task_logs" as any) as any)
        .select("member_name, client_name, client_id, project_no, project_name, task_category, task_detail, hours, is_self_work, year_month")
        .eq("org_id", ORG_ID)
        .in("year_month", months);
      if (error) throw error;
      return (data ?? []) as TaskLogRow[];
    },
    enabled: months.length > 0,
  });

  // Fetch project_pl for per-client gross_profit
  const salesQuery = useQuery({
    queryKey: ["project_pl_task_analysis", months[0], months[months.length - 1]],
    queryFn: async () => {
      if (months.length === 0) return [] as ProjectPlRow[];
      const { data, error } = await supabase
        .from("project_pl")
        .select("client_id, client_name, gross_profit, year_month")
        .eq("org_id", ORG_ID)
        .in("year_month", months);
      if (error) throw error;
      return (data ?? []) as ProjectPlRow[];
    },
    enabled: months.length > 0,
  });

  // Fetch member_client_monthly_hours for project hours (= GPH denominator)
  const mchQuery = useQuery({
    queryKey: ["mch_task_analysis", months[0], months[months.length - 1]],
    queryFn: async () => {
      if (months.length === 0) return [] as MemberClientHoursRow[];
      const { data, error } = await (supabase.from("member_client_monthly_hours" as any) as any)
        .select("client_name, client_id, member_name, hours, year_month")
        .eq("org_id", ORG_ID)
        .in("year_month", months);
      if (error) throw error;
      return (data ?? []) as MemberClientHoursRow[];
    },
    enabled: months.length > 0,
  });

  const taskLogs = taskLogsQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const mch = mchQuery.data ?? [];

  // Aggregate: per client → gross_profit, project_hours, gph
  const clientStats = useMemo(() => {
    const gpByClient = new Map<string, number>();
    const nameByGp = new Map<string, string>();
    for (const s of sales) {
      const key = s.client_id != null ? String(s.client_id) : (s.client_name ?? "_unknown");
      gpByClient.set(key, (gpByClient.get(key) ?? 0) + Number(s.gross_profit ?? 0));
      if (s.client_name) nameByGp.set(key, s.client_name);
    }
    const hByClient = new Map<string, number>();
    const nameByClient = new Map<string, string>();
    for (const r of mch) {
      if (!r.client_name || r.client_name.includes("Off Beat")) continue;
      const key = r.client_id ? String(r.client_id) : r.client_name;
      hByClient.set(key, (hByClient.get(key) ?? 0) + (r.hours ?? 0));
      nameByClient.set(key, r.client_name);
    }
    const result: { clientKey: string; clientName: string; gp: number; hours: number; gph: number }[] = [];
    for (const [key, hours] of hByClient.entries()) {
      const gp = gpByClient.get(key) ?? 0;
      const gph = hours > 0 ? gp / hours : 0;
      result.push({
        clientKey: key,
        clientName: nameByClient.get(key) ?? nameByGp.get(key) ?? key,
        gp,
        hours,
        gph,
      });
    }
    return result;
  }, [sales, mch]);

  // Filter to low-profit clients
  const lowProfitClients = useMemo(() => {
    return clientStats
      .filter((c) => c.hours > 0 && c.gph > 0 && c.gph <= threshold)
      .sort((a, b) => a.gph - b.gph);
  }, [clientStats, threshold]);

  // Aggregate task logs per low-profit client × major category
  const { matrix, categories, kpis } = useMemo(() => {
    const lowKeys = new Set(lowProfitClients.map((c) => c.clientName));
    const lowLogs = taskLogs.filter((r) => lowKeys.has(r.client_name));

    const catSet = new Set<string>();
    const m = new Map<string, Map<string, number>>(); // clientName → cat → hours
    for (const r of lowLogs) {
      const cat = extractMajorCategory(r.task_category);
      catSet.add(cat);
      if (!m.has(r.client_name)) m.set(r.client_name, new Map());
      const inner = m.get(r.client_name)!;
      inner.set(cat, (inner.get(cat) ?? 0) + (r.hours ?? 0));
    }
    const cats = sortCategories(Array.from(catSet));

    // Self work aggregation across ALL logs (org-wide)
    const totalHours = taskLogs.reduce((s, r) => s + (r.hours ?? 0), 0);
    const selfHours = taskLogs.filter((r) => r.is_self_work).reduce((s, r) => s + (r.hours ?? 0), 0);

    return {
      matrix: m,
      categories: cats,
      kpis: {
        lowClientCount: lowProfitClients.length,
        totalHours,
        selfHours,
        selfRate: totalHours > 0 ? (selfHours / totalHours) * 100 : 0,
      },
    };
  }, [taskLogs, lowProfitClients]);

  // Member × major category heatmap (across all logs) + drill-down by task_category
  const memberMatrix = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    const catSet = new Set<string>();
    for (const r of taskLogs) {
      const cat = extractMajorCategory(r.task_category);
      catSet.add(cat);
      if (!m.has(r.member_name)) m.set(r.member_name, new Map());
      const inner = m.get(r.member_name)!;
      inner.set(cat, (inner.get(cat) ?? 0) + (r.hours ?? 0));
    }
    const cats = sortCategories(Array.from(catSet));
    const rows = Array.from(m.entries())
      .map(([name, byCat]) => {
        const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
        return { name, byCat, total };
      })
      .sort((a, b) => b.total - a.total);
    return { rows, cats };
  }, [taskLogs]);

  const isLoading = taskLogsQuery.isLoading || salesQuery.isLoading || mchQuery.isLoading;

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (taskLogs.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-8 text-center">
        <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-semibold mb-1">業務ログデータがありません</p>
        <p className="text-xs text-muted-foreground">Pace CSVをアップロードすると、業務分析が表示されます。</p>
      </div>
    );
  }

  const heatColor = (h: number, max: number) => {
    if (h <= 0 || max <= 0) return "";
    const ratio = h / max;
    if (ratio >= 0.75) return "bg-primary/40";
    if (ratio >= 0.5) return "bg-primary/25";
    if (ratio >= 0.25) return "bg-primary/15";
    if (ratio > 0) return "bg-primary/5";
    return "";
  };

  const matrixMax = Math.max(
    ...lowProfitClients.flatMap((c) => categories.map((cat) => matrix.get(c.clientName)?.get(cat) ?? 0)),
    1,
  );

  const memberMax = Math.max(
    ...memberMatrix.rows.flatMap((r) => memberMatrix.cats.map((cat) => r.byCat.get(cat) ?? 0)),
    1,
  );

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox label="低収益クライアント数" value={`${kpis.lowClientCount}社`} icon={<Building2 className="h-4 w-4" />} sub={`${fmtY(threshold)}以下`} />
        <KpiBox label="期間内 総工数" value={fmtH(kpis.totalHours)} icon={<Clock className="h-4 w-4" />} />
        <KpiBox label="うち社内業務" value={fmtH(kpis.selfHours)} icon={<Briefcase className="h-4 w-4" />} sub="Off Beat株式会社" />
        <KpiBox label="社内業務比率" value={fmtPct(kpis.selfRate)} icon={<AlertTriangle className="h-4 w-4" />} alert={kpis.selfRate > 30} />
      </div>

      {/* Threshold control */}
      <div className="bg-card rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">案件粗利工数単価しきい値：</span>
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="w-32 font-mono-num text-sm"
              step={1000}
            />
            <span className="text-xs text-muted-foreground">円以下</span>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <Slider
              value={[threshold]}
              onValueChange={(v) => setThreshold(v[0])}
              min={5000}
              max={50000}
              step={1000}
            />
          </div>
        </div>
      </div>

      {/* Low profit clients × task category heatmap */}
      <div className="bg-card rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">低収益クライアント × 業務カテゴリ ヒートマップ</h3>
            <p className="text-xs text-muted-foreground mt-0.5">案件粗利工数単価が {fmtY(threshold)} 以下のクライアントの業務内訳</p>
          </div>
        </div>
        {lowProfitClients.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">該当するクライアントがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">クライアント</TableHead>
                  <TableHead className="text-xs text-right">粗利工数単価</TableHead>
                  <TableHead className="text-xs text-right">合計工数</TableHead>
                  {categories.map((cat) => (
                    <TableHead key={cat} className="text-xs text-center">{cat}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowProfitClients.map((c) => {
                  const inner = matrix.get(c.clientName);
                  const totalH = inner ? Array.from(inner.values()).reduce((s, v) => s + v, 0) : 0;
                  return (
                    <ClientDrillRow
                      key={c.clientKey}
                      client={c}
                      totalH={totalH}
                      categories={categories}
                      inner={inner}
                      matrixMax={matrixMax}
                      heatColor={heatColor}
                      taskLogs={taskLogs.filter((r) => r.client_name === c.clientName)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Member × task category heatmap */}
      <div className="bg-card rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-3">メンバー × 業務カテゴリ ヒートマップ</h3>
        <p className="text-xs text-muted-foreground mb-3">行をクリックすると、作業区分別の内訳を表示します</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">メンバー</TableHead>
                <TableHead className="text-xs text-right">合計工数</TableHead>
                {memberMatrix.cats.map((cat) => (
                  <TableHead key={cat} className="text-xs text-center">{cat}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberMatrix.rows.map((r) => (
                <MemberDrillRow
                  key={r.name}
                  row={r}
                  cats={memberMatrix.cats}
                  memberMax={memberMax}
                  heatColor={heatColor}
                  taskLogs={taskLogs}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function MemberDrillRow({
  row,
  cats,
  memberMax,
  heatColor,
  taskLogs,
}: {
  row: { name: string; byCat: Map<string, number>; total: number };
  cats: string[];
  memberMax: number;
  heatColor: (h: number, max: number) => string;
  taskLogs: TaskLogRow[];
}) {
  const [open, setOpen] = useState(false);

  const sortedTaskCats = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const r of taskLogs) {
      if (r.member_name !== row.name) continue;
      const tc = r.task_category || "未分類";
      catMap.set(tc, (catMap.get(tc) ?? 0) + (r.hours ?? 0));
    }
    return Array.from(catMap.entries())
      .map(([taskCat, hours]) => ({ taskCat, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [taskLogs, row.name]);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-secondary/30" onClick={() => setOpen(!open)}>
        <TableCell className="text-xs font-medium whitespace-nowrap">
          <div className="flex items-center gap-1">
            <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
            {row.name}
          </div>
        </TableCell>
        <TableCell className="text-xs text-right font-mono-num">{fmtH(row.total)}</TableCell>
        {cats.map((cat) => {
          const h = row.byCat.get(cat) ?? 0;
          return (
            <TableCell key={cat} className={cn("text-xs text-center font-mono-num", heatColor(h, memberMax))}>
              {h > 0 ? fmtH(h) : "─"}
            </TableCell>
          );
        })}
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={2 + cats.length} className="bg-secondary/20 p-0">
            <div className="p-4">
              <h4 className="text-xs font-semibold mb-2">{row.name} の作業区分別内訳</h4>
              <div className="space-y-2">
                {sortedTaskCats.map((tc) => {
                  const pct = row.total > 0 ? (tc.hours / row.total) * 100 : 0;
                  return (
                    <div key={tc.taskCat} className="flex items-center gap-2 text-xs">
                      <div className="w-56 truncate" title={tc.taskCat}>{tc.taskCat}</div>
                      <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-20 text-right font-mono-num">{fmtH(tc.hours)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function KpiBox({ label, value, sub, icon, alert }: { label: string; value: string; sub?: string; icon: React.ReactNode; alert?: boolean }) {
  return (
    <div className={cn("bg-card rounded-lg shadow-sm p-4", alert && "ring-1 ring-destructive/40")}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-xl font-semibold font-mono-num", alert && "text-destructive")}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ClientDrillRow({
  client,
  totalH,
  categories,
  inner,
  matrixMax,
  heatColor,
  taskLogs,
}: {
  client: { clientKey: string; clientName: string; gp: number; hours: number; gph: number };
  totalH: number;
  categories: string[];
  inner: Map<string, number> | undefined;
  matrixMax: number;
  heatColor: (h: number, max: number) => string;
  taskLogs: TaskLogRow[];
}) {
  const [open, setOpen] = useState(false);

  // Drill-down: detail by task_category (full string) and by member
  const { byDetail, byMember } = useMemo(() => {
    const detailMap = new Map<string, number>();
    const memberMap = new Map<string, { total: number }>();
    for (const r of taskLogs) {
      const detail = r.task_category || "未分類";
      detailMap.set(detail, (detailMap.get(detail) ?? 0) + r.hours);
      if (!memberMap.has(r.member_name)) memberMap.set(r.member_name, { total: 0 });
      const mm = memberMap.get(r.member_name)!;
      mm.total += r.hours;
    }
    return {
      byDetail: Array.from(detailMap.entries()).map(([k, v]) => ({ key: k, hours: v })).sort((a, b) => b.hours - a.hours),
      byMember: Array.from(memberMap.entries()).map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total),
    };
  }, [taskLogs]);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-secondary/30" onClick={() => setOpen(!open)}>
        <TableCell className="text-xs font-medium whitespace-nowrap">
          <div className="flex items-center gap-1">
            <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
            {client.clientName}
          </div>
        </TableCell>
        <TableCell className="text-xs text-right font-mono-num text-destructive font-semibold">{fmtY(client.gph)}</TableCell>
        <TableCell className="text-xs text-right font-mono-num">{fmtH(totalH)}</TableCell>
        {categories.map((cat) => {
          const h = inner?.get(cat) ?? 0;
          return (
            <TableCell key={cat} className={cn("text-xs text-center font-mono-num", heatColor(h, matrixMax))}>
              {h > 0 ? fmtH(h) : "─"}
            </TableCell>
          );
        })}
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={3 + categories.length} className="bg-secondary/20 p-0">
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-2">作業区分別 内訳</h4>
                <div className="space-y-1">
                  {byDetail.slice(0, 15).map((d) => {
                    const pct = totalH > 0 ? (d.hours / totalH) * 100 : 0;
                    return (
                      <div key={d.key} className="flex items-center gap-2 text-xs">
                        <div className="w-56 truncate" title={d.key}>{d.key}</div>
                        <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                          <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-20 text-right font-mono-num">{fmtH(d.hours)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2">担当メンバー別内訳</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">メンバー</TableHead>
                      <TableHead className="text-xs text-right">合計</TableHead>
                      <TableHead className="text-xs text-right">社内業務</TableHead>
                      <TableHead className="text-xs text-right">社内率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byMember.map((m) => (
                      <TableRow key={m.name}>
                        <TableCell className="text-xs">{m.name}</TableCell>
                        <TableCell className="text-xs text-right font-mono-num">{fmtH(m.total)}</TableCell>
                        <TableCell className="text-xs text-right font-mono-num">{fmtH(m.self)}</TableCell>
                        <TableCell className="text-xs text-right font-mono-num">{m.total > 0 ? fmtPct((m.self / m.total) * 100) : "─"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
