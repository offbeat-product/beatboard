
CREATE TABLE public.member_client_monthly_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  year_month text NOT NULL,
  member_name text NOT NULL,
  client_id text,
  client_name text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, year_month, member_name, client_name)
);

ALTER TABLE public.member_client_monthly_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all member_client_monthly_hours"
  ON public.member_client_monthly_hours
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
