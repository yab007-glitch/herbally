-- 00045_rls_with_check_hardening.sql
-- M-1 / M-2 / M-9 (audit 2026-06-22): add WITH CHECK to UPDATE policies that
-- only had USING, and remove a permissive INSERT policy. Without WITH CHECK,
-- a user who owns a row can UPDATE it and set user_id to another user (the new
-- row is never checked) — a row-transfer / attribution-injection gap reachable
-- via the Supabase REST API with the anon key. 00038 fixed this class of bug
-- for chat_sessions, health_profiles, and the herb_ratings INSERT/DELETE
-- policies, but missed these. Idempotent (DROP POLICY IF EXISTS first).

-- ── M-1: user_medications UPDATE needs WITH CHECK ───────────────────────────
DROP POLICY IF EXISTS "Users can update own medications" ON public.user_medications;
CREATE POLICY "Users can update own medications"
  ON public.user_medications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── M-2: herb_ratings UPDATE needs WITH CHECK ───────────────────────────────
-- Mirror the ownership check used by the 00038 INSERT policy: a user may only
-- update a rating they own; a guest-owned row (user_id NULL, guest_id set)
-- cannot be re-attributed to a user via UPDATE.
DROP POLICY IF EXISTS "Users update own ratings" ON public.herb_ratings;
CREATE POLICY "Users update own ratings"
  ON public.herb_ratings FOR UPDATE
  USING (auth.uid() = user_id OR (user_id IS NULL AND guest_id IS NOT NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND guest_id IS NOT NULL));

-- ── M-9: newsletter_subscribers INSERT was WITH CHECK(true) ─────────────────
-- Any anon client could insert a row with any well-formed email (list
-- poisoning / spam vector). No app code currently inserts into this table
-- (grep confirms only the type definition references it), so the permissive
-- INSERT policy is pure attack surface. Drop it — a future subscribe feature
-- must route through a server action using the service role.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;