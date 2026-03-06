
-- Remove ALL duplicates, keep only one record per (snapshot_date, metric_name, org_id)
DELETE FROM public.kpi_snapshots a
USING public.kpi_snapshots b
WHERE a.org_id = '00000000-0000-0000-0000-000000000001'
  AND a.org_id = b.org_id
  AND a.snapshot_date = b.snapshot_date
  AND a.metric_name = b.metric_name
  AND a.id > b.id;
