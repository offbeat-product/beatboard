ALTER TABLE plan_settings
  ADD COLUMN IF NOT EXISTS revenue_distribution_pattern text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS revenue_growth_factor numeric DEFAULT 1.5;

NOTIFY pgrst, 'reload schema';