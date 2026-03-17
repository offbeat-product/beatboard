-- Add DELETE policy for kpi_snapshots
CREATE POLICY "auth_del_kpi" ON public.kpi_snapshots
FOR DELETE TO authenticated
USING (true);

-- Clean up duplicate kpi_snapshots, keeping only the latest per metric+date
DELETE FROM public.kpi_snapshots a
USING public.kpi_snapshots b
WHERE a.org_id = b.org_id
  AND a.metric_name = b.metric_name
  AND a.snapshot_date = b.snapshot_date
  AND a.created_at < b.created_at;