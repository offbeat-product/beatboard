
ALTER TABLE public.kpi_snapshots
  ALTER COLUMN metric_name DROP NOT NULL,
  ALTER COLUMN actual_value DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
