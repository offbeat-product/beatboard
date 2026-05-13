
CREATE TABLE public.member_task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id text NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  year_month text NOT NULL,
  work_date date,
  member_name text NOT NULL,
  client_name text NOT NULL,
  client_id text,
  project_no text,
  project_name text,
  project_category text,
  task_category text,
  task_detail text,
  hours numeric NOT NULL DEFAULT 0,
  is_self_work boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_mtl_org_ym ON public.member_task_logs (org_id, year_month);
CREATE INDEX idx_mtl_client ON public.member_task_logs (org_id, year_month, client_name);
CREATE INDEX idx_mtl_member ON public.member_task_logs (org_id, year_month, member_name);
CREATE INDEX idx_mtl_task_cat ON public.member_task_logs (org_id, year_month, task_category);

ALTER TABLE public.member_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all member_task_logs"
ON public.member_task_logs
FOR ALL
USING (true)
WITH CHECK (true);
