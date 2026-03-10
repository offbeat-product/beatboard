
CREATE TABLE public.report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  year_month text NOT NULL,
  report_type text NOT NULL,
  report_content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, year_month, report_type)
);

ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all report_cache" ON public.report_cache
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
