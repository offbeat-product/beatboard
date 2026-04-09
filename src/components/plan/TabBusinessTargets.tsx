import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { FieldWithTooltip } from "./FieldWithTooltip";
import { PlanSettings, fmtNum, fmtInputVal, parseInputVal, distributeRevenue, PATTERN_GROWTH_MAP } from "./PlanTypes";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ORG_ID, getMonthLabel } from "@/lib/fiscalYear";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
  fiscalYear: string;
}

export function TabBusinessTargets({ months, settings, update, fiscalYear }: Props) {
  const { unit } = useCurrencyUnit();

  const annualClientUnitPrice = settings.annual_client_target > 0 ? settings.annual_revenue_target / settings.annual_client_target : 0;
  const annualProjectUnitPrice = settings.annual_project_target > 0 ? settings.annual_revenue_target / settings.annual_project_target : 0;

  // Revenue distribution state
  const [firstHalfTarget, setFirstHalfTarget] = useState(30000000);
  const [secondHalfTarget, setSecondHalfTarget] = useState(45000000);
  const [monthOverrides, setMonthOverrides] = useState<Record<number, number>>({});

  const getGrowthFactor = (): number => {
    const pattern = settings.revenue_distribution_pattern || "standard";
    if (pattern === "custom") return settings.revenue_growth_factor || 1.5;
    return PATTERN_GROWTH_MAP[pattern] ?? 1.5;
  };

  useEffect(() => {
    if (settings.distribution_mode === "half_year" && settings.monthly_revenue_distribution.length === 12) {
      const fh = settings.monthly_revenue_distribution.slice(0, 6).reduce((s, v) => s + v, 0);
      const sh = settings.monthly_revenue_distribution.slice(6, 12).reduce((s, v) => s + v, 0);
      if (fh > 0 || sh > 0) {
        setFirstHalfTarget(fh);
        setSecondHalfTarget(sh);
        const g = (settings.revenue_distribution_pattern === "custom")
          ? (settings.revenue_growth_factor || 1.5)
          : (PATTERN_GROWTH_MAP[settings.revenue_distribution_pattern] ?? 1.5);
        if (Math.abs(g - 1.0) > 0.01) {
          const fhSlice = settings.monthly_revenue_distribution.slice(0, 6);
          const isFlat = fhSlice.every(v => Math.abs(v - fhSlice[0]) < 1);
          if (isFlat) {
            const fhDist = distributeRevenue(fh, 6, g);
            const shDist = distributeRevenue(sh, 6, g);
            update("monthly_revenue_distribution", [...fhDist, ...shDist]);
          }
        }
      }
    }
    setMonthOverrides({});
  }, [settings.distribution_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHalfYearDist = (fh: number, sh: number, g?: number) => {
    const gf = g ?? getGrowthFactor();
    const firstHalf = distributeRevenue(fh, 6, gf);
    const secondHalf = distributeRevenue(sh, 6, gf);
    update("monthly_revenue_distribution", [...firstHalf, ...secondHalf]);
    setMonthOverrides({});
  };

  const distSum = settings.distribution_mode === "manual"
    ? settings.monthly_revenue_distribution.reduce((s, v) => s + v, 0)
    : settings.distribution_mode === "half_year"
    ? firstHalfTarget + secondHalfTarget
    : settings.annual_revenue_target;
  const distValid = settings.distribution_mode === "equal" || Math.abs(distSum - settings.annual_revenue_target) < 1;


  return (
    <div className="space-y-8">
      {/* 年間KPI設定 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="年間KPI設定" description="年間の売上・利益目標を設定します" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FieldWithTooltip label={`年間売上目標 (${unit === "thousand" ? "千円" : "円"})`} required tooltip="年間の売上目標額を設定します">
            <Input
              type="text"
              placeholder="例: 75,000,000"
              value={fmtInputVal(settings.annual_revenue_target, unit).toLocaleString()}
              onChange={(e) => update("annual_revenue_target", parseInputVal(e.target.value, unit))}
              className="focus-visible:ring-[hsl(217,91%,60%)]"
            />
          </FieldWithTooltip>
          <FieldWithTooltip label="目標原価率 (%)" required tooltip="売上に対する原価の比率。粗利率は自動計算されます">
            <Input type="number" placeholder="例: 30" value={settings.cost_rate} onChange={(e) => update("cost_rate", parseFloat(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="目標粗利率" autoCalc tooltip="100% - 原価率 で自動計算">
            <div className="h-10 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{settings.gross_profit_rate.toFixed(1)}%</div>
          </FieldWithTooltip>
          <FieldWithTooltip label="目標営業利益率 (%)" required tooltip="売上に対する営業利益の目標比率">
            <Input type="number" placeholder="例: 20" value={settings.operating_profit_rate} onChange={(e) => update("operating_profit_rate", parseFloat(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="販管費率" autoCalc tooltip="粗利率 - 営業利益率 で自動計算">
            <div className="h-10 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{(settings.gross_profit_rate - settings.operating_profit_rate).toFixed(1)}%</div>
          </FieldWithTooltip>
        </div>
      </section>

      {/* 売上目標達成 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="売上目標達成" description="年間売上目標に対する累計進捗を表示します" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">年間売上目標</p>
            <p className="text-lg font-bold">{fmtNum(settings.annual_revenue_target, unit)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">累計実績（{monthsWithData}ヶ月）</p>
            <p className="text-lg font-bold">{fmtNum(totalActualRevenue, unit)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">達成率</p>
            <p className={cn("text-lg font-bold", achievementRate >= 100 ? "text-green-600" : achievementRate >= 80 ? "text-amber-600" : "text-destructive")}>
              {achievementRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">残り必要額</p>
            <p className={cn("text-lg font-bold", totalActualRevenue >= settings.annual_revenue_target ? "text-green-600" : "")}>
              {totalActualRevenue >= settings.annual_revenue_target ? "達成済" : fmtNum(settings.annual_revenue_target - totalActualRevenue, unit)}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", achievementRate >= 100 ? "bg-green-500" : achievementRate >= 80 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${Math.min(achievementRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      {/* 売上目標構成（配分設定） */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="売上目標構成" description="月別の売上配分方法を設定します" />
        <div className="flex items-center gap-3 mb-4">
          <Select value={settings.distribution_mode} onValueChange={(v) => {
            if (v === "equal") {
              update("monthly_revenue_distribution", months.map(() => settings.annual_revenue_target / 12));
            } else if (v === "half_year") {
              applyHalfYearDist(firstHalfTarget, secondHalfTarget);
            }
            update("distribution_mode", v);
          }}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equal">均等割</SelectItem>
              <SelectItem value="half_year">半期別</SelectItem>
              <SelectItem value="manual">手動入力</SelectItem>
            </SelectContent>
          </Select>
          {(settings.distribution_mode === "manual" || settings.distribution_mode === "half_year") && (
            <span className={cn("text-xs font-medium", distValid ? "text-green-600" : "text-destructive")}>
              合計: {fmtNum(distSum, unit)} / {fmtNum(settings.annual_revenue_target, unit)}
            </span>
          )}
        </div>
        {settings.distribution_mode === "half_year" && (
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FieldWithTooltip label={`上半期目標（5月〜10月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="上半期6ヶ月分の売上目標合計">
                <Input type="text" value={fmtInputVal(firstHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setFirstHalfTarget(v); applyHalfYearDist(v, secondHalfTarget); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
              </FieldWithTooltip>
              <FieldWithTooltip label={`下半期目標（11月〜4月）(${unit === "thousand" ? "千円" : "円"})`} tooltip="下半期6ヶ月分の売上目標合計">
                <Input type="text" value={fmtInputVal(secondHalfTarget, unit).toLocaleString()} onChange={(e) => { const v = parseInputVal(e.target.value, unit); setSecondHalfTarget(v); applyHalfYearDist(firstHalfTarget, v); }} className="focus-visible:ring-[hsl(217,91%,60%)]" />
              </FieldWithTooltip>
              <div>
                <Label className="text-xs font-medium">配分パターン</Label>
                <Select value={settings.revenue_distribution_pattern || "standard"} onValueChange={(v) => {
                  update("revenue_distribution_pattern", v);
                  const g = v === "custom" ? (settings.revenue_growth_factor || 1.5) : (PATTERN_GROWTH_MAP[v] ?? 1.5);
                  applyHalfYearDist(firstHalfTarget, secondHalfTarget, g);
                }}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">均等配分 (g=1.0)</SelectItem>
                    <SelectItem value="gentle">緩やかな右肩上がり (g=1.3)</SelectItem>
                    <SelectItem value="standard">標準的な右肩上がり (g=1.5)</SelectItem>
                    <SelectItem value="aggressive">急成長 (g=2.0)</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.revenue_distribution_pattern === "custom" && (
                <div>
                  <Label className="text-xs font-medium">成長係数 (g)</Label>
                  <Input type="number" step="0.1" min="1.0" max="3.0" value={settings.revenue_growth_factor || 1.5}
                    onChange={(e) => {
                      const g = Math.min(3, Math.max(1, parseFloat(e.target.value) || 1.5));
                      update("revenue_growth_factor", g);
                      applyHalfYearDist(firstHalfTarget, secondHalfTarget, g);
                    }}
                    className="mt-1 h-9 text-xs focus-visible:ring-[hsl(217,91%,60%)]" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">最終月が初月の何倍か (1.0〜3.0)</p>
                </div>
              )}
            </div>
            {(() => {
              const dist = settings.monthly_revenue_distribution;
              if (dist.length < 12) return null;
              const fhActual = dist.slice(0, 6).reduce((s, v) => s + v, 0);
              const shActual = dist.slice(6, 12).reduce((s, v) => s + v, 0);
              const fhDiff = fhActual - firstHalfTarget;
              const shDiff = shActual - secondHalfTarget;
              const hasOverrides = Object.keys(monthOverrides).length > 0;
              if (!hasOverrides) return null;
              return (
                <div className="space-y-1">
                  {Math.abs(fhDiff) > 1 && (
                    <p className="text-xs text-destructive">
                      上半期合計: {fmtNum(fhActual, unit)} / 目標 {fmtNum(firstHalfTarget, unit)}（差額 {fhDiff > 0 ? "+" : ""}{fmtNum(fhDiff, unit)}）
                    </p>
                  )}
                  {Math.abs(shDiff) > 1 && (
                    <p className="text-xs text-destructive">
                      下半期合計: {fmtNum(shActual, unit)} / 目標 {fmtNum(secondHalfTarget, unit)}（差額 {shDiff > 0 ? "+" : ""}{fmtNum(shDiff, unit)}）
                    </p>
                  )}
                  {(Math.abs(fhDiff) > 1 || Math.abs(shDiff) > 1) && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyHalfYearDist(firstHalfTarget, secondHalfTarget)}>
                      <RotateCcw className="h-3 w-3 mr-1" />自動再配分
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        {settings.distribution_mode === "manual" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {months.map((m, i) => (
              <div key={m}>
                <Label className="text-xs">{getMonthLabel(m)}</Label>
                <Input type="text" value={fmtInputVal(settings.monthly_revenue_distribution[i] || 0, unit).toLocaleString()} onChange={(e) => { const newDist = [...settings.monthly_revenue_distribution]; newDist[i] = parseInputVal(e.target.value, unit); update("monthly_revenue_distribution", newDist); }} className="h-7 text-xs mt-1 focus-visible:ring-[hsl(217,91%,60%)]" />
              </div>
            ))}
          </div>
        )}
        {settings.distribution_mode !== "manual" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {months.map((m, i) => {
              const val = settings.distribution_mode === "equal" ? settings.annual_revenue_target / 12 : (settings.monthly_revenue_distribution[i] || 0);
              const isOverride = monthOverrides[i] !== undefined;
              const isHalfYear = settings.distribution_mode === "half_year";
              return (
                <div key={m}>
                  <Label className="text-xs text-muted-foreground">{getMonthLabel(m)}</Label>
                  {isHalfYear ? (
                    <div className="mt-1 relative group">
                      <div
                        className={cn(
                          "h-7 flex items-center justify-between px-2 rounded-md text-xs font-medium cursor-pointer hover:bg-muted/70",
                          isOverride ? "bg-card border border-border" : "bg-muted text-muted-foreground"
                        )}
                        onClick={() => {
                          const input = prompt(`${getMonthLabel(m)}の売上計画（円）`, String(Math.round(val)));
                          if (input !== null) {
                            const v = parseInt(input.replace(/,/g, "")) || 0;
                            if (v > 0) {
                              const newDist = [...settings.monthly_revenue_distribution];
                              newDist[i] = v;
                              update("monthly_revenue_distribution", newDist);
                              setMonthOverrides(prev => ({ ...prev, [i]: v }));
                            }
                          }
                        }}
                      >
                        <span>{fmtNum(val, unit)}</span>
                        <Badge variant={isOverride ? "default" : "secondary"} className="text-[7px] px-1 py-0 h-3.5 shrink-0 ml-1">
                          {isOverride ? "手動" : "自動"}
                        </Badge>
                      </div>
                      {isOverride && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newOverrides = { ...monthOverrides };
                            delete newOverrides[i];
                            setMonthOverrides(newOverrides);
                            applyHalfYearDist(firstHalfTarget, secondHalfTarget);
                          }}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="自動値に戻す"
                        >
                          <RotateCcw className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 h-7 flex items-center px-2 rounded-md bg-muted text-xs font-medium">{fmtNum(val, unit)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 顧客指標目標 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="顧客指標目標" description="年間の取引顧客・案件の目標を設定します" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldWithTooltip label="年間取引顧客数目標 (社)" required tooltip="1年間に取引のある顧客社数の目標">
            <Input type="number" placeholder="例: 30" value={settings.annual_client_target} onChange={(e) => update("annual_client_target", parseInt(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="年間顧客単価目標" autoCalc tooltip="年間売上目標 ÷ 年間取引顧客数目標">
            <div className="h-10 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{fmtNum(annualClientUnitPrice, unit)}</div>
          </FieldWithTooltip>
          <FieldWithTooltip label="年間案件数目標 (件)" required tooltip="1年間の案件数の目標">
            <Input type="number" placeholder="例: 250" value={settings.annual_project_target} onChange={(e) => update("annual_project_target", parseInt(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="年間案件単価目標" autoCalc tooltip="年間売上目標 ÷ 年間案件数目標">
            <div className="h-10 flex items-center px-3 rounded-md bg-muted text-sm font-medium">{fmtNum(annualProjectUnitPrice, unit)}</div>
          </FieldWithTooltip>
        </div>
      </section>

      {/* 生産性目標 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="生産性目標" description="工数単価の目標を設定します" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWithTooltip label="粗利工数単価目標 (円)" required tooltip="粗利 ÷ 総労働時間 の目標値">
            <Input type="number" placeholder="例: 21,552" value={settings.gp_per_hour_target} onChange={(e) => update("gp_per_hour_target", parseInt(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="案件粗利工数単価目標 (円)" required tooltip="粗利 ÷ 案件工数 の目標値">
            <Input type="number" placeholder="例: 25,000" value={settings.gp_per_project_hour_target} onChange={(e) => update("gp_per_project_hour_target", parseInt(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
        </div>
      </section>

      {/* 品質目標 */}
      <section className="bg-card rounded-lg shadow-sm border border-border p-5">
        <SectionHeading title="品質目標" description="納品品質の目標を設定します" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWithTooltip label="納期遵守率目標 (%)" required tooltip="納品物のうち期限内に納品された割合の目標">
            <Input type="number" placeholder="例: 95" value={settings.on_time_delivery_target} onChange={(e) => update("on_time_delivery_target", parseFloat(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
          <FieldWithTooltip label="修正発生率目標 (%)" required tooltip="納品物のうち修正が発生した割合の目標（低いほど良い）">
            <Input type="number" placeholder="例: 20" value={settings.revision_rate_target} onChange={(e) => update("revision_rate_target", parseFloat(e.target.value) || 0)} className="focus-visible:ring-[hsl(217,91%,60%)]" />
          </FieldWithTooltip>
        </div>
      </section>
    </div>
  );
}
