-- 00097_admin_aal2_rls.sql
-- Require AAL2 (verified MFA session) in addition to profiles.role = 'admin'
-- for admin-only RLS policies across catalog, clinical, telemetry, chat, and
-- billing tables.
--
-- STATUS: Authored offline in repo; NOT YET APPLIED to production. Live SQL
-- execution and live AAL1 vs AAL2 PostgREST REST verification remain pending
-- owner execution.
--
-- Note: `Users can view own profile` and `Users can update own profile` on
-- `public.profiles` intentionally remain AAL1-accessible so an admin signing
-- in can still pass the role check needed to reach the MFA verification gate.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin_aal2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_aal2() TO authenticated;

-- public.profiles (admin-wide read only; own-profile policies unchanged)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- public.herb_categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.herb_categories;
CREATE POLICY "Admins can manage categories"
  ON public.herb_categories FOR ALL
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

-- public.herbs
DROP POLICY IF EXISTS "Admins can view all herbs" ON public.herbs;
CREATE POLICY "Admins can view all herbs"
  ON public.herbs FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can insert herbs" ON public.herbs;
CREATE POLICY "Admins can insert herbs"
  ON public.herbs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can update herbs" ON public.herbs;
CREATE POLICY "Admins can update herbs"
  ON public.herbs FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can delete herbs" ON public.herbs;
CREATE POLICY "Admins can delete herbs"
  ON public.herbs FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

-- public.drug_interactions
DROP POLICY IF EXISTS "Admins can manage interactions" ON public.drug_interactions;
CREATE POLICY "Admins can manage interactions"
  ON public.drug_interactions FOR ALL
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

-- public.interaction_checks
DROP POLICY IF EXISTS "Admins can view all interaction checks" ON public.interaction_checks;
CREATE POLICY "Admins can view all interaction checks"
  ON public.interaction_checks FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- public.chat_sessions
DROP POLICY IF EXISTS "Admins can view all chat sessions" ON public.chat_sessions;
CREATE POLICY "Admins can view all chat sessions"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- public.chat_messages
DROP POLICY IF EXISTS "Admins can view all chat messages" ON public.chat_messages;
CREATE POLICY "Admins can view all chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- public.herb_faqs
DROP POLICY IF EXISTS "Admins can manage herb FAQs" ON public.herb_faqs;
CREATE POLICY "Admins can manage herb FAQs"
  ON public.herb_faqs FOR ALL
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

-- public.donations
DROP POLICY IF EXISTS "Admins can view donations" ON public.donations;
CREATE POLICY "Admins can view donations"
  ON public.donations FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- public.herb_monographs
DROP POLICY IF EXISTS "Admins can view all monographs" ON public.herb_monographs;
CREATE POLICY "Admins can view all monographs"
  ON public.herb_monographs FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can insert monographs" ON public.herb_monographs;
CREATE POLICY "Admins can insert monographs"
  ON public.herb_monographs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can update monographs" ON public.herb_monographs;
CREATE POLICY "Admins can update monographs"
  ON public.herb_monographs FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can delete monographs" ON public.herb_monographs;
CREATE POLICY "Admins can delete monographs"
  ON public.herb_monographs FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

COMMIT;
