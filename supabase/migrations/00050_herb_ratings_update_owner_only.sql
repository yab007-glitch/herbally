-- 00050: herb_ratings UPDATE policy — authenticated users may only update rows
-- they own. (Audit M1.)
--
-- 00045 added WITH CHECK but kept a guest branch `(user_id IS NULL AND
-- guest_id IS NOT NULL)` in both USING and WITH CHECK. That branch matches ANY
-- guest-owned row — it does not bind guest_id to the caller — so any logged-in
-- user can UPDATE any guest's rating value / experience text. RLS cannot
-- enforce guest ownership (anon role has no auth.uid()), so the safe choice is
-- to make guest rows immutable to authenticated users (guests can still INSERT
-- via the 00038 policy). Idempotent.

DROP POLICY IF EXISTS "Users update own ratings" ON public.herb_ratings;
CREATE POLICY "Users update own ratings"
  ON public.herb_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);