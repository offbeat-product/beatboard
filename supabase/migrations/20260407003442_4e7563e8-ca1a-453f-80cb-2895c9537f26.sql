
-- Step 1: Add new columns
ALTER TABLE public.kpi_snapshots
  ADD COLUMN IF NOT EXISTS ym text,
  ADD COLUMN IF NOT EXISTS revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operating_profit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operating_profit_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit_per_hour numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_pass_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_client_ratio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_of_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sga_total numeric DEFAULT 0;

-- Step 2: Backfill ym
UPDATE public.kpi_snapshots SET ym = to_char(snapshot_date, 'YYYY-MM') WHERE ym IS NULL;

-- Step 3: Delete duplicates, keeping only the row with the latest created_at per (org_id, ym)
DELETE FROM public.kpi_snapshots
WHERE id NOT IN (
  SELECT DISTINCT ON (org_id, ym) id
  FROM public.kpi_snapshots
  ORDER BY org_id, ym, created_at DESC
);

-- Step 4: Add unique constraint
ALTER TABLE public.kpi_snapshots ADD CONSTRAINT kpi_snapshots_org_ym_unique UNIQUE (org_id, ym);

-- Step 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
