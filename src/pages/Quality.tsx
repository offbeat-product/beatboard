import { useState, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQualityData } from "@/hooks/useQualityData";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import {
  BarChart, Bar, LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Package, Clock, AlertTriangle, ChevronDown, Plus, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getMonthLabel, getFiscalYearMonths, ORG_ID } from "@/lib/fiscalYear";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Quality = () => {
  usePageTitle("品質指標");
  const queryClient = useQueryClient();
  const d = useQualityData();
  const [tableMode, setTableMode] = useState<"onTime" | "revision">("onTime");

  if (d.isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">品質指標</h2>
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <KpiCardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (d.isError) return <ErrorState onRetry={() => queryClient.invalidateQueries()} />;

  const tableData = tableMode === "onTime" ? d.clientOnTimeData : d.clientRevisionData;

  const rankBg = (idx: number) => {
    if (idx === 0) return "bg-amber-50 dark:bg-amber-950/30";
    if (idx === 1) return "bg-slate-50 dark:bg-slate-800/30";
    if (idx === 2) return "bg-orange-50 dark:bg-orange-950/20";
    if (idx <= 4) return "bg-blue-50 dark:bg-blue-950/20";
    return "";
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">品質指標</h2>

      {/* Section 1: KPI Cards */}
      {/* Row 1: 案件数 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Package className="h-4 w-4" /> 案件数
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 案件数" value={`${d.prevDeliveries}件`} />
          <KpiMiniCard label="今月 案件数" value={`${d.currDeliveries}件`} />
          <GrowthCard label="前月比" value={d.deliveriesGrowth} />
          <KpiMiniCard label="通期 案件数" value={`${d.ytdDeliveries}件`} />
        </div>
      </div>

      {/* Row 2: 納期遵守数/率 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clock className="h-4 w-4" /> 納期遵守数 / 率
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 遵守数/率" value={`${d.prevOnTime}件 / ${d.prevOnTimeRate.toFixed(1)}%`} />
          <KpiMiniCard label="今月 遵守数/率" value={`${d.currOnTime}件 / ${d.currOnTimeRate.toFixed(1)}%`} />
          <DiffCard label="前月比" value={d.onTimeRateDiff} positiveIsGood={true} />
          <KpiMiniCard label="通期 平均遵守率" value={`${d.ytdAvgOnTimeRate.toFixed(1)}%`} />
        </div>
      </div>

      {/* Row 3: 修正発生数/率 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> 修正発生数 / 率
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMiniCard label="前月 修正数/率" value={`${d.prevRevisions}件 / ${d.prevRevisionRate.toFixed(1)}%`} />
          <KpiMiniCard label="今月 修正数/率" value={`${d.currRevisions}件 / ${d.currRevisionRate.toFixed(1)}%`} />
          <DiffCard label="前月比" value={d.revisionRateDiff} positiveIsGood={false} />
          <KpiMiniCard label="通期 平均修正率" value={`${d.ytdAvgRevisionRate.toFixed(1)}%`} />
        </div>
      </div>

      {/* Section 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in">
          <h3 className="text-sm font-semibold mb-4">案件数推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => [`${v}件`, "案件数"]} />
              <Bar dataKey="deliveries" name="案件数" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <h3 className="text-sm font-semibold mb-4">納期遵守率推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "納期遵守率"]} />
              <ReferenceLine y={95} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "目標 95%", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Line type="monotone" dataKey="onTimeRate" name="納期遵守率" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-sm font-semibold mb-4">修正発生率推移</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "修正発生率"]} />
              <ReferenceLine y={20} stroke="hsl(var(--destructive))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "目標 20%", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Line type="monotone" dataKey="revisionRate" name="修正発生率" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 3: Client Quality Table */}
      <div className="bg-card rounded-lg shadow-sm animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center justify-between p-4 pb-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTableMode("onTime")}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tableMode === "onTime" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              納期遵守率
            </button>
            <button
              onClick={() => setTableMode("revision")}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tableMode === "revision" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              修正発生率
            </button>
          </div>
          <div className="flex items-center gap-2">
            <DataEntryModal fiscalMonths={d.fiscalMonths} onSaved={() => d.refetch()} />
            <CsvUploadButton fiscalMonths={d.fiscalMonths} onSaved={() => d.refetch()} />
          </div>
        </div>
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-20 bg-secondary">
              <tr>
                <th className="sticky left-0 z-30 bg-secondary text-left px-3 py-2 font-semibold min-w-[160px] border-b border-border">顧客名</th>
                {d.fiscalMonths.map((ym) => (
                  <th key={ym} className="text-right px-2 py-2 font-semibold whitespace-nowrap border-b border-border">{getMonthLabel(ym)}</th>
                ))}
                <th className="text-right px-3 py-2 font-bold whitespace-nowrap border-b border-border">通期平均</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((client, idx) => (
                <tr key={client.id} className={`${rankBg(idx)} hover:bg-muted/50 transition-colors`}>
                  <td className={`sticky left-0 z-10 ${rankBg(idx) || "bg-card"} px-3 py-1.5 font-medium border-b border-border truncate max-w-[200px]`}>
                    {client.name}
                  </td>
                  {d.fiscalMonths.map((ym) => {
                    const m = client.monthly[ym];
                    const total = m?.total ?? 0;
                    let rate = 0;
                    if (tableMode === "onTime") {
                      rate = total > 0 ? ((m?.onTime ?? 0) / total) * 100 : 0;
                    } else {
                      rate = total > 0 ? ((m?.revisions ?? 0) / total) * 100 : 0;
                    }
                    const isBad = tableMode === "onTime" ? (total > 0 && rate < 95) : (total > 0 && rate > 20);
                    return (
                      <td key={ym} className={`text-right px-2 py-1.5 font-mono text-xs border-b border-border tabular-nums ${isBad ? "bg-destructive/10 text-destructive font-semibold" : ""}`}>
                        {total > 0 ? `${rate.toFixed(1)}%` : <span className="text-muted-foreground">-</span>}
                      </td>
                    );
                  })}
                  <td className={`text-right px-3 py-1.5 font-mono text-xs font-semibold border-b border-border tabular-nums`}>
                    {tableMode === "onTime"
                      ? `${client.avgOnTimeRate.toFixed(1)}%`
                      : `${client.avgRevisionRate.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculation Logic */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className="h-3 w-3" />
          計算ロジック
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs text-muted-foreground bg-secondary rounded-lg p-4 space-y-1">
          <p>・案件数 = quality_monthly.total_deliveriesの月間合計</p>
          <p>・納期遵守率 = 月間on_time_deliveries合計 ÷ 月間total_deliveries合計 × 100（基準: 95%以上が目標）</p>
          <p>・修正発生率 = 月間revision_count合計 ÷ 月間total_deliveries合計 × 100（基準: 20%以下が目標）</p>
          <p>・通期平均 = 会計年度（5月〜当月）の各月の率の単純平均</p>
          <p className="text-muted-foreground/70 italic">※将来的にCheckGo AIと連携後は自動取得に切り替え予定。現在は手動入力。</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/* ── Sub-components ── */

function KpiMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums">{value}</p>
    </div>
  );
}

function GrowthCard({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {isPositive ? <TrendingUp className="h-4 w-4 text-chart-green" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className={`text-lg font-bold font-mono tabular-nums ${isPositive ? "text-chart-green" : "text-destructive"}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function DiffCard({ label, value, positiveIsGood }: { label: string; value: number; positiveIsGood: boolean }) {
  const isGood = positiveIsGood ? value >= 0 : value <= 0;
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 animate-fade-in">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {isGood ? <TrendingUp className="h-4 w-4 text-chart-green" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className={`text-lg font-bold font-mono tabular-nums ${isGood ? "text-chart-green" : "text-destructive"}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(1)}pt
        </span>
      </div>
    </div>
  );
}

function DataEntryModal({ fiscalMonths, onSaved }: { fiscalMonths: string[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [yearMonth, setYearMonth] = useState(fiscalMonths[0]);
  const [clientName, setClientName] = useState("");
  const [totalDeliveries, setTotalDeliveries] = useState("");
  const [onTimeDeliveries, setOnTimeDeliveries] = useState("");
  const [revisionCount, setRevisionCount] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientName.trim() || !totalDeliveries) {
      toast.error("顧客名と納品数は必須です");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("quality_monthly").upsert(
      {
        org_id: ORG_ID,
        year_month: yearMonth,
        client_id: clientName.trim(),
        client_name: clientName.trim(),
        total_deliveries: parseInt(totalDeliveries) || 0,
        on_time_deliveries: parseInt(onTimeDeliveries) || 0,
        revision_count: parseInt(revisionCount) || 0,
      },
      { onConflict: "org_id,year_month,client_id" }
    );
    setSaving(false);
    if (error) {
      toast.error("保存に失敗しました: " + error.message);
    } else {
      toast.success("保存しました");
      setClientName("");
      setTotalDeliveries("");
      setOnTimeDeliveries("");
      setRevisionCount("");
      onSaved();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> データ入力
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>品質データ入力</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>年月</Label>
            <Select value={yearMonth} onValueChange={setYearMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {fiscalMonths.map((ym) => (
                  <SelectItem key={ym} value={ym}>{getMonthLabel(ym)}（{ym}）</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>顧客名</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="例: 株式会社サンプル" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>納品数</Label>
              <Input type="number" value={totalDeliveries} onChange={(e) => setTotalDeliveries(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>納期遵守数</Label>
              <Input type="number" value={onTimeDeliveries} onChange={(e) => setOnTimeDeliveries(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>修正発生数</Label>
              <Input type="number" value={revisionCount} onChange={(e) => setRevisionCount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CsvUploadButton({ fiscalMonths, onSaved }: { fiscalMonths: string[]; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n").slice(1); // skip header
      const records = lines.map((line) => {
        const [year_month, client_name, total_deliveries, on_time_deliveries, revision_count] = line.split(",").map((s) => s.trim());
        return {
          org_id: ORG_ID,
          year_month,
          client_id: client_name,
          client_name,
          total_deliveries: parseInt(total_deliveries) || 0,
          on_time_deliveries: parseInt(on_time_deliveries) || 0,
          revision_count: parseInt(revision_count) || 0,
        };
      }).filter((r) => r.year_month && r.client_name);

      if (records.length === 0) {
        toast.error("有効なデータがありません");
        return;
      }

      const { error } = await supabase.from("quality_monthly").upsert(records, { onConflict: "org_id,year_month,client_id" });
      if (error) throw error;
      toast.success(`${records.length}件のデータをアップロードしました`);
      onSaved();
    } catch (err: any) {
      toast.error("アップロードに失敗しました: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {uploading ? "処理中..." : "CSVアップロード"}
      </Button>
    </>
  );
}

export default Quality;
