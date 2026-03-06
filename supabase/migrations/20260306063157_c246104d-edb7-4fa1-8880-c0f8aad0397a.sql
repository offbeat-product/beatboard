CREATE TABLE IF NOT EXISTS quality_monthly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT,
  total_deliveries INT DEFAULT 0,
  on_time_deliveries INT DEFAULT 0,
  revision_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, year_month, client_id)
);

ALTER TABLE quality_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all quality_monthly" ON quality_monthly FOR ALL USING (true) WITH CHECK (true);