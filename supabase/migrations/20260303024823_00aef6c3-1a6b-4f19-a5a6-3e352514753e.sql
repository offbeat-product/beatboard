
-- Clean up previous partial tables
DROP TABLE IF EXISTS public.ai_chat_logs CASCADE;
DROP TABLE IF EXISTS public.ai_reports CASCADE;
DROP TABLE IF EXISTS public.kpi_snapshots CASCADE;
DROP TABLE IF EXISTS public.targets CASCADE;

-- 1. organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  settings_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_org" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_org" ON public.organizations FOR UPDATE TO authenticated USING (true);

-- 2. clients
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('enterprise','pro','standard','other')),
  monthly_fee INTEGER NOT NULL DEFAULT 0,
  contract_start DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_clients" ON public.clients FOR UPDATE TO authenticated USING (true);

-- 3. projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('banner','video','lp','other')),
  unit_price INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_projects" ON public.projects FOR UPDATE TO authenticated USING (true);

-- 4. members
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('executive','employee','part_time')),
  hourly_rate INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_members" ON public.members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_members" ON public.members FOR UPDATE TO authenticated USING (true);

-- 5. monthly_sales
CREATE TABLE public.monthly_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  revenue INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  gross_profit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_ms" ON public.monthly_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_ms" ON public.monthly_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_ms" ON public.monthly_sales FOR UPDATE TO authenticated USING (true);

-- 6. daily_worklogs
CREATE TABLE public.daily_worklogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  hours DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_worklogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_wl" ON public.daily_worklogs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_wl" ON public.daily_worklogs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_wl" ON public.daily_worklogs FOR UPDATE TO authenticated USING (true);

-- 7. quality_records
CREATE TABLE public.quality_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  year_month TEXT NOT NULL,
  first_pass_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quality_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_qr" ON public.quality_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_qr" ON public.quality_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_qr" ON public.quality_records FOR UPDATE TO authenticated USING (true);

-- 8. pl_records
CREATE TABLE public.pl_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  account_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pl_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_pl" ON public.pl_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_pl" ON public.pl_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_pl" ON public.pl_records FOR UPDATE TO authenticated USING (true);

-- 9. targets
CREATE TABLE public.targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  target_value DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_tgt" ON public.targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_tgt" ON public.targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_tgt" ON public.targets FOR UPDATE TO authenticated USING (true);

-- 10. kpi_snapshots
CREATE TABLE public.kpi_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  actual_value DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_kpi" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_kpi" ON public.kpi_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_kpi" ON public.kpi_snapshots FOR UPDATE TO authenticated USING (true);

-- 11. ai_reports
CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly','monthly')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_air" ON public.ai_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_air" ON public.ai_reports FOR INSERT TO authenticated WITH CHECK (true);

-- 12. ai_chat_logs
CREATE TABLE public.ai_chat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sel_acl" ON public.ai_chat_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_ins_acl" ON public.ai_chat_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
