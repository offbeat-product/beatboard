
ALTER TABLE public.plan_settings
  ADD COLUMN IF NOT EXISTS monthly_clients jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sga_categories jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_sga jsonb DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
