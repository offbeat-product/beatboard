
CREATE POLICY "allow_all_kpi_snapshots"
  ON public.kpi_snapshots
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
