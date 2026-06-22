-- 00042_herb_monographs_rls.sql
-- C-1 (audit 2026-06-22): herb_monographs was created in 00019/00024 with NO
-- `ENABLE ROW LEVEL SECURITY` and zero policies. With RLS off, Supabase's
-- default Postgres grants give anon/authenticated full DML on public tables —
-- so anyone with the public anon key (shipped to the browser) could
-- INSERT/UPDATE/DELETE any monograph, including `status='published'` rows:
-- altering safety_notes, pregnancy_category, drug_interactions guidance, or
-- replacing key_citations/provenance with attacker-controlled values.
--
-- Fix: enable RLS and mirror the herbs/herb_faqs access model —
--   * anyone can SELECT published monographs (public catalog)
--   * admins can SELECT all and do all DML, gated by profiles.role='admin'
-- Idempotent (DROP POLICY IF EXISTS before each CREATE).

ALTER TABLE public.herb_monographs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published monographs" ON public.herb_monographs;
CREATE POLICY "Anyone can view published monographs"
  ON public.herb_monographs FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Admins can view all monographs" ON public.herb_monographs;
CREATE POLICY "Admins can view all monographs"
  ON public.herb_monographs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can insert monographs" ON public.herb_monographs;
CREATE POLICY "Admins can insert monographs"
  ON public.herb_monographs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update monographs" ON public.herb_monographs;
CREATE POLICY "Admins can update monographs"
  ON public.herb_monographs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete monographs" ON public.herb_monographs;
CREATE POLICY "Admins can delete monographs"
  ON public.herb_monographs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );