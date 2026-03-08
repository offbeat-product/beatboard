CREATE TABLE public.member_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  member_name text NOT NULL,
  employment_type text NOT NULL,
  start_month text,
  end_month text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (org_id, member_name)
);

ALTER TABLE public.member_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all member_classifications" ON public.member_classifications
  FOR ALL USING (true) WITH CHECK (true);