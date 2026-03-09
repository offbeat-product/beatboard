
CREATE TABLE IF NOT EXISTS public.plan_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  annual_revenue_target BIGINT DEFAULT 0,
  cost_rate NUMERIC(5,2) DEFAULT 30,
  gross_profit_rate NUMERIC(5,2) DEFAULT 70,
  operating_profit_rate NUMERIC(5,2) DEFAULT 20,
  personnel_cost_rate NUMERIC(5,2) DEFAULT 50,
  recruitment_rate NUMERIC(5,2) DEFAULT 15,
  office_rate NUMERIC(5,2) DEFAULT 35,
  marketing_rate NUMERIC(5,2) DEFAULT 20,
  it_rate NUMERIC(5,2) DEFAULT 15,
  professional_rate NUMERIC(5,2) DEFAULT 10,
  other_rate NUMERIC(5,2) DEFAULT 5,
  gp_per_hour_target INT DEFAULT 21552,
  gp_per_project_hour_target INT DEFAULT 25000,
  on_time_delivery_target NUMERIC(5,2) DEFAULT 95,
  revision_rate_target NUMERIC(5,2) DEFAULT 20,
  staffing_plan JSONB DEFAULT '[]'::jsonb,
  monthly_revenue_distribution JSONB DEFAULT '[]'::jsonb,
  distribution_mode TEXT DEFAULT 'equal',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, fiscal_year)
);

ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all plan_settings" ON public.plan_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.alert_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  warn_value NUMERIC DEFAULT 0,
  danger_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, metric_key)
);

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all alert_settings" ON public.alert_settings FOR ALL USING (true) WITH CHECK (true);
