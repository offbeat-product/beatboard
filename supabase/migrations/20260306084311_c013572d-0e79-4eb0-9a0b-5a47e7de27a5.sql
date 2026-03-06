
-- Fix remaining restrictive policies on profiles
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon read own profile" ON public.profiles;

CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Service role full access" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anon insert profiles" ON public.profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read profiles" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Anon update profiles" ON public.profiles FOR UPDATE TO anon USING (true);
