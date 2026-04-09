import { useState, useEffect, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFiscalYearMonths, ORG_ID } from "@/lib/fiscalYear";
import { toast } from "sonner";
import { Save, Download, Copy } from "lucide-react";
import { PlanSettings, DEFAULT_SETTINGS, DEFAULT_STAFFING, DEFAULT_HALF_YEAR_DIST, DEFAULT_SGA_CATEGORIES, DEFAULT_SGA_ALLOCATION_RATES } from "@/components/plan/PlanTypes";
import { TabBusinessTargets } from "@/components/plan/TabBusinessTargets";
import { TabOrganizationPlan } from "@/components/plan/TabOrganizationPlan";
import { TabSgaPlan } from "@/components/plan/TabSgaPlan";
import { TabCustomerPlan } from "@/components/plan/TabCustomerPlan";
import { TabMonthlyPlan } from "@/components/plan/TabMonthlyPlan";

const Plan = () => {
  usePageTitle("事業計画");
  const [fyTab, setFyTab] = useState("2026");
  const [categoryTab, setCategoryTab] = useState("targets");
  const fyEndYear = parseInt(fyTab);
  const months = useMemo(() => getFiscalYearMonths(fyEndYear), [fyEndYear]);
  const fiscalYear = `${fyEndYear}年4月期`;

  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS(months));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [initialSettings, setInitialSettings] = useState<string>("");

  const update = (field: keyof PlanSettings, value: any) => {
    setSettings(prev => {
      const next = { ...prev, [field]: value };
      if (field === "cost_rate") next.gross_profit_rate = 100 - (value as number);
      return next;
    });
    setDirty(true);
  };

  // Load settings from DB
  useEffect(() => {
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from("plan_settings" as any)
        .select("*")
        .eq("org_id", ORG_ID)
        .eq("fiscal_year", fiscalYear)
        .maybeSingle();
      if (data) {
        const d = data as any;
        const loaded: PlanSettings = {
          annual_revenue_target: Number(d.annual_revenue_target) || 0,
          cost_rate: Number(d.cost_rate) || 30,
          gross_profit_rate: Number(d.gross_profit_rate) || 70,
          operating_profit_rate: Number(d.operating_profit_rate) || 20,
          personnel_cost_rate: Number(d.personnel_cost_rate) || 50,
          recruitment_rate: Number(d.recruitment_rate) || 15,
          office_rate: Number(d.office_rate) || 35,
          marketing_rate: Number(d.marketing_rate) || 20,
          it_rate: Number(d.it_rate) || 15,
          professional_rate: Number(d.professional_rate) || 10,
          other_rate: Number(d.other_rate) || 5,
          gp_per_hour_target: Number(d.gp_per_hour_target) || 21552,
          gp_per_project_hour_target: Number(d.gp_per_project_hour_target) || 25000,
          on_time_delivery_target: Number(d.on_time_delivery_target) || 95,
          revision_rate_target: Number(d.revision_rate_target) || 20,
          staffing_plan: Array.isArray(d.staffing_plan) && d.staffing_plan.length > 0 ? d.staffing_plan : DEFAULT_STAFFING(months),
          monthly_revenue_distribution: Array.isArray(d.monthly_revenue_distribution) && d.monthly_revenue_distribution.length > 0 ? d.monthly_revenue_distribution : DEFAULT_HALF_YEAR_DIST(months, Number(d.annual_revenue_target) || 75000000),
          distribution_mode: d.distribution_mode || "half_year",
          annual_client_target: Number(d.annual_client_target) || 30,
          annual_project_target: Number(d.annual_project_target) || 250,
          monthly_clients: (d.monthly_clients && typeof d.monthly_clients === "object" && !Array.isArray(d.monthly_clients)) ? d.monthly_clients : {},
          sga_categories: Array.isArray(d.sga_categories) && d.sga_categories.length > 0 ? d.sga_categories : DEFAULT_SGA_CATEGORIES,
          monthly_sga: (d.monthly_sga && typeof d.monthly_sga === "object" && !Array.isArray(d.monthly_sga)) ? d.monthly_sga : {},
          sga_allocation_rates: (d.sga_allocation_rates && typeof d.sga_allocation_rates === "object" && !Array.isArray(d.sga_allocation_rates)) ? d.sga_allocation_rates : DEFAULT_SGA_ALLOCATION_RATES,
          monthly_sga_overrides: (d.monthly_sga_overrides && typeof d.monthly_sga_overrides === "object" && !Array.isArray(d.monthly_sga_overrides)) ? d.monthly_sga_overrides : {},
          annual_sga_total: Number(d.annual_sga_total) || 0,
          client_revenue_plan: Array.isArray(d.client_revenue_plan) ? d.client_revenue_plan : [],
          revenue_distribution_pattern: d.revenue_distribution_pattern || "standard",
          revenue_growth_factor: Number(d.revenue_growth_factor) || 1.5,
        };
        setSettings(loaded);
        setInitialSettings(JSON.stringify(loaded));
      } else {
        const def = DEFAULT_SETTINGS(months);
        setSettings(def);
        setInitialSettings(JSON.stringify(def));
      }
      setDirty(false);
      setLoaded(true);
    })();
  }, [fyTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        org_id: ORG_ID,
        fiscal_year: fiscalYear,
        annual_revenue_target: settings.annual_revenue_target,
        cost_rate: settings.cost_rate,
        gross_profit_rate: settings.gross_profit_rate,
        operating_profit_rate: settings.operating_profit_rate,
        personnel_cost_rate: settings.personnel_cost_rate,
        recruitment_rate: settings.recruitment_rate,
        office_rate: settings.office_rate,
        marketing_rate: settings.marketing_rate,
        it_rate: settings.it_rate,
        professional_rate: settings.professional_rate,
        other_rate: settings.other_rate,
        gp_per_hour_target: settings.gp_per_hour_target,
        gp_per_project_hour_target: settings.gp_per_project_hour_target,
        on_time_delivery_target: settings.on_time_delivery_target,
        revision_rate_target: settings.revision_rate_target,
        staffing_plan: settings.staffing_plan,
        monthly_revenue_distribution: settings.monthly_revenue_distribution,
        distribution_mode: settings.distribution_mode,
        annual_client_target: settings.annual_client_target,
        annual_project_target: settings.annual_project_target,
        monthly_clients: settings.monthly_clients,
        sga_categories: settings.sga_categories,
        monthly_sga: settings.monthly_sga,
        sga_allocation_rates: settings.sga_allocation_rates,
        monthly_sga_overrides: settings.monthly_sga_overrides,
        annual_sga_total: settings.annual_sga_total,
        client_revenue_plan: settings.client_revenue_plan,
        revenue_distribution_pattern: settings.revenue_distribution_pattern,
        revenue_growth_factor: settings.revenue_growth_factor,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("plan_settings" as any)
        .select("id")
        .eq("org_id", ORG_ID)
        .eq("fiscal_year", fiscalYear)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase.from("plan_settings" as any) as any).update(payload).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("plan_settings" as any) as any).insert(payload);
        if (error) throw error;
      }

      // Save monthly targets
      const monthlyRevenues = settings.distribution_mode === "equal"
        ? months.map(() => settings.annual_revenue_target / 12)
        : settings.monthly_revenue_distribution;

      await supabase.from("targets").delete().eq("org_id", ORG_ID).in("year_month", months);
      const targetInserts = months.flatMap((ym, i) => [
        { org_id: ORG_ID, year_month: ym, metric_name: "monthly_revenue", target_value: monthlyRevenues[i] || 0 },
        { org_id: ORG_ID, year_month: ym, metric_name: "gross_margin_rate", target_value: settings.gross_profit_rate },
        { org_id: ORG_ID, year_month: ym, metric_name: "gross_profit_per_hour", target_value: settings.gp_per_hour_target },
      ]);
      const { error: tErr } = await supabase.from("targets").insert(targetInserts);
      if (tErr) throw tErr;

      setDirty(false);
      setInitialSettings(JSON.stringify(settings));
      toast.success("事業計画を保存しました");
    } catch (e: any) {
      toast.error("保存に失敗しました: " + (e.message || ""));
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    if (initialSettings) {
      setSettings(JSON.parse(initialSettings));
      setDirty(false);
    }
  };

  const handleCopyPreviousYear = async () => {
    const prevFy = `${fyEndYear - 1}年4月期`;
    const { data } = await supabase
      .from("plan_settings" as any)
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("fiscal_year", prevFy)
      .maybeSingle();
    if (!data) {
      toast.error("前年度の計画が見つかりません");
      return;
    }
    const d = data as any;
    setSettings({
      ...settings,
      annual_revenue_target: Number(d.annual_revenue_target) || settings.annual_revenue_target,
      cost_rate: Number(d.cost_rate) || settings.cost_rate,
      gross_profit_rate: Number(d.gross_profit_rate) || settings.gross_profit_rate,
      operating_profit_rate: Number(d.operating_profit_rate) || settings.operating_profit_rate,
      personnel_cost_rate: Number(d.personnel_cost_rate) || settings.personnel_cost_rate,
      recruitment_rate: Number(d.recruitment_rate) || settings.recruitment_rate,
      office_rate: Number(d.office_rate) || settings.office_rate,
      marketing_rate: Number(d.marketing_rate) || settings.marketing_rate,
      it_rate: Number(d.it_rate) || settings.it_rate,
      professional_rate: Number(d.professional_rate) || settings.professional_rate,
      other_rate: Number(d.other_rate) || settings.other_rate,
      gp_per_hour_target: Number(d.gp_per_hour_target) || settings.gp_per_hour_target,
      gp_per_project_hour_target: Number(d.gp_per_project_hour_target) || settings.gp_per_project_hour_target,
      on_time_delivery_target: Number(d.on_time_delivery_target) || settings.on_time_delivery_target,
      revision_rate_target: Number(d.revision_rate_target) || settings.revision_rate_target,
      annual_client_target: Number(d.annual_client_target) || settings.annual_client_target,
      annual_project_target: Number(d.annual_project_target) || settings.annual_project_target,
      sga_categories: Array.isArray(d.sga_categories) && d.sga_categories.length > 0 ? d.sga_categories : settings.sga_categories,
      sga_allocation_rates: (d.sga_allocation_rates && typeof d.sga_allocation_rates === "object") ? d.sga_allocation_rates : settings.sga_allocation_rates,
      annual_sga_total: Number(d.annual_sga_total) || settings.annual_sga_total,
    });
    setDirty(true);
    toast.success("前年度の計画をコピーしました");
  };

  if (!loaded) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">読み込み中...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <PageHeader title="事業計画" description="期別KPI目標と月次展開" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyPreviousYear}>
            <Copy className="h-4 w-4 mr-1.5" />前年度の計画を複製
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="h-4 w-4 mr-1.5" />計画をエクスポート
          </Button>
          <CurrencyToggle />
        </div>
      </div>

      {/* Fiscal Year Tabs (pill style) */}
      <Tabs value={fyTab} onValueChange={(v) => { setFyTab(v); setDirty(false); }}>
        <TabsList className="bg-muted/50 rounded-full p-0.5 h-auto gap-0.5">
          {[
            { value: "2026", label: "当期（2026年4月期）" },
            { value: "2027", label: "来期（2027年4月期）" },
            { value: "2028", label: "3期目" },
            { value: "2029", label: "4期目" },
            { value: "2030", label: "5期目" },
          ].map(fy => (
            <TabsTrigger key={fy.value} value={fy.value} className="rounded-full text-xs px-4 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {fy.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={fyTab}>
          {/* Category Tabs (underline style) */}
          <Tabs value={categoryTab} onValueChange={setCategoryTab} className="mt-4">
            <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 w-full justify-start">
              {[
                { value: "targets", label: "経営目標" },
                { value: "monthly", label: "月次事業計画" },
                { value: "customers", label: "顧客計画" },
                { value: "organization", label: "組織・人員計画" },
                { value: "sga", label: "販管費計画" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 py-2.5 text-sm font-medium"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="targets" className="mt-6">
              <TabBusinessTargets months={months} settings={settings} update={update} fiscalYear={fiscalYear} />
            </TabsContent>
            <TabsContent value="monthly" className="mt-6">
              <TabMonthlyPlan months={months} settings={settings} update={update} fiscalYear={fiscalYear} />
            </TabsContent>
            <TabsContent value="customers" className="mt-6">
              <TabCustomerPlan months={months} settings={settings} update={update} fiscalYear={fiscalYear} />
            </TabsContent>
            <TabsContent value="organization" className="mt-6">
              <TabOrganizationPlan months={months} settings={settings} update={update} />
            </TabsContent>
            <TabsContent value="sga" className="mt-6">
              <TabSgaPlan months={months} settings={settings} update={update} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Floating save bar */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-card border border-border rounded-lg shadow-lg px-4 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm text-muted-foreground">未保存の変更があります</span>
          <Button variant="outline" size="sm" onClick={handleDiscard}>破棄</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "変更内容を保存"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Plan;
