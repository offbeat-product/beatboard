
-- Create invite_links table
CREATE TABLE IF NOT EXISTS public.invite_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  token TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by UUID,
  used_by UUID,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all invite_links" ON public.invite_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read invite_links" ON public.invite_links FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update invite_links" ON public.invite_links FOR UPDATE TO anon USING (true);

-- Add org_id to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT '00000000-0000-0000-0000-000000000001';

-- Update handle_new_user to include org_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, status, org_id)
  VALUES (NEW.id, NEW.email, 'active', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO UPDATE SET status = 'active', email = NEW.email;
  RETURN NEW;
END;
$$;

-- Allow anon to insert profiles (for invite signup)
CREATE POLICY "Allow anon insert profiles" ON public.profiles FOR INSERT TO anon WITH CHECK (true);
-- Allow anon to read profiles by id
CREATE POLICY "Allow anon read own profile" ON public.profiles FOR SELECT TO anon USING (true);
