ALTER TABLE plan_settings
  ADD COLUMN IF NOT EXISTS sga_allocation_rates jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_sga_overrides jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS annual_sga_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_revenue_plan jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';