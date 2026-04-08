import { Input } from "@/components/ui/input";
import { SectionHeading } from "./SectionHeading";
import { FieldWithTooltip } from "./FieldWithTooltip";
import { PlanSettings, fmtNum, fmtInputVal, parseInputVal } from "./PlanTypes";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";

interface Props {
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
}

export function TabBusinessTargets({ settings, update }: Props) {
  const { unit } = useCurrencyUnit();

  const annualClientUnitPrice = settings.annual_client_target > 0 ? settings.annual_revenue_target / settings.annual_client_target : 0;
  const annualProjectUnitPrice = settings.annual_project_target > 0 ? settings.annual_revenue_target / settings.annual_project_target : 0;

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
