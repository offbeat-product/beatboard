
-- Delete existing snapshots for these metrics and months
DELETE FROM public.kpi_snapshots 
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND metric_name IN ('employee_total_hours', 'employee_project_hours', 'parttimer_total_hours', 'parttimer_project_hours')
  AND snapshot_date IN ('2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01');

-- Insert aggregated data
INSERT INTO public.kpi_snapshots (org_id, snapshot_date, metric_name, actual_value) VALUES
-- 11月 (2025-11): 社員3名, パート0名
('00000000-0000-0000-0000-000000000001', '2025-11-01', 'employee_total_hours', 540),
('00000000-0000-0000-0000-000000000001', '2025-11-01', 'employee_project_hours', 392.5),
('00000000-0000-0000-0000-000000000001', '2025-11-01', 'parttimer_total_hours', 0),
('00000000-0000-0000-0000-000000000001', '2025-11-01', 'parttimer_project_hours', 0),
-- 12月 (2025-12): 社員3名, パート0名
('00000000-0000-0000-0000-000000000001', '2025-12-01', 'employee_total_hours', 442.5),
('00000000-0000-0000-0000-000000000001', '2025-12-01', 'employee_project_hours', 311.25),
('00000000-0000-0000-0000-000000000001', '2025-12-01', 'parttimer_total_hours', 0),
('00000000-0000-0000-0000-000000000001', '2025-12-01', 'parttimer_project_hours', 0),
-- 1月 (2026-01): 社員3名, パート0名
('00000000-0000-0000-0000-000000000001', '2026-01-01', 'employee_total_hours', 456.5),
('00000000-0000-0000-0000-000000000001', '2026-01-01', 'employee_project_hours', 341.25),
('00000000-0000-0000-0000-000000000001', '2026-01-01', 'parttimer_total_hours', 0),
('00000000-0000-0000-0000-000000000001', '2026-01-01', 'parttimer_project_hours', 0),
-- 2月 (2026-02): 社員2名(中村+岩谷), パート3名
('00000000-0000-0000-0000-000000000001', '2026-02-01', 'employee_total_hours', 274.5),
('00000000-0000-0000-0000-000000000001', '2026-02-01', 'employee_project_hours', 209.75),
('00000000-0000-0000-0000-000000000001', '2026-02-01', 'parttimer_total_hours', 169.5),
('00000000-0000-0000-0000-000000000001', '2026-02-01', 'parttimer_project_hours', 92.25);
