CREATE TABLE IF NOT EXISTS client_monthly_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  hours NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, year_month, client_id)
);

ALTER TABLE client_monthly_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all client_monthly_hours" ON client_monthly_hours FOR ALL USING (true) WITH CHECK (true);