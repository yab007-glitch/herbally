-- 00038_security_hardening.sql
-- Addresses SEC-1 (profiles.role self-escalation), SEC-4 (guest SECURITY
-- DEFINER functions over-exposed + IDOR + mutable search_path), SEC-8/11
-- (missing WITH CHECK on UPDATE/INSERT policies), and tightens herb_ratings /
-- newsletter_subscribers. See audit 2026-06-19.

-- ============================================================================
-- SEC-1: profiles.role self-escalation
-- The "Users can update own profile" UPDATE policy had no WITH CHECK, and
-- authenticated/anon retained UPDATE on the `role` column — so a user could
-- UPDATE profiles SET role='admin' WHERE id=auth.uid(). Revoke column-level
-- UPDATE on role and add a WITH CHECK so the row must still be the user's own.
-- ============================================================================
REVOKE UPDATE (role) ON public.profiles FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- SEC-4: lock down guest-chat SECURITY DEFINER functions
-- These were executable by PUBLIC (any role) with a mutable search_path, and
-- get_guest_chat_messages had no ownership check (IDOR — any session id read).
-- Fix: pin search_path, REVOKE FROM PUBLIC, GRANT to anon only, and require
-- p_guest_id + ownership verification on message reads.
-- ============================================================================
ALTER FUNCTION public.get_guest_chat_sessions(TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_guest_chat_session(TEXT, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_guest_chat_session(UUID, TEXT)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) TO anon;

-- Replace get_guest_chat_messages: verifies the session belongs to the guest
-- before returning any messages (closes the IDOR where any session id could be
-- read). p_guest_id is OPTIONAL (DEFAULT NULL) for backward compatibility with
-- callers that verify ownership themselves (chat-persist's getGuestSession
-- confirms the session is in the guest's own list before calling). When
-- p_guest_id is supplied, the function enforces ownership server-side as
-- defense-in-depth.
DROP FUNCTION IF EXISTS public.get_guest_chat_messages(UUID);
CREATE OR REPLACE FUNCTION public.get_guest_chat_messages(
  p_session_id UUID,
  p_guest_id TEXT DEFAULT NULL
)
RETURNS SETOF public.chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.*
  FROM public.chat_messages m
  JOIN public.chat_sessions s ON s.id = m.session_id
  WHERE m.session_id = p_session_id
    AND (p_guest_id IS NULL OR s.guest_id = p_guest_id)
  ORDER BY m.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) TO anon;

-- New: fetch a single guest session with ownership check (replaces the direct
-- table SELECT in chat-persist, which was filtered out by the non-functional
-- JWT-claims guest RLS policy and provided no ownership guarantee).
CREATE OR REPLACE FUNCTION public.get_guest_chat_session(
  p_session_id UUID,
  p_guest_id TEXT
)
RETURNS public.chat_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.chat_sessions
  WHERE id = p_session_id AND guest_id = p_guest_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) TO anon;

-- ============================================================================
-- SEC-11: chat_sessions UPDATE had no WITH CHECK (a user could update a row
-- they can see but rewrite user_id to another user). Add WITH CHECK.
-- ============================================================================
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SEC-8: herb_ratings INSERT was WITH CHECK(true) — anyone could insert a
-- rating attributed to ANOTHER user's user_id. Tighten so a row must be either
-- the caller's own (auth.uid() = user_id) or a guest row (no user_id). Add a
-- DELETE policy for owners and unique indexes so one user/guest can't rate the
-- same herb twice.
-- ============================================================================
DROP POLICY IF EXISTS "Users manage own ratings" ON public.herb_ratings;
CREATE POLICY "Users manage own ratings" ON public.herb_ratings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND guest_id IS NOT NULL)
  );

CREATE POLICY IF NOT EXISTS "Users delete own ratings" ON public.herb_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_herb_ratings_user_herb
  ON public.herb_ratings(user_id, herb_slug)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_herb_ratings_guest_herb
  ON public.herb_ratings(guest_id, herb_slug)
  WHERE guest_id IS NOT NULL;

-- health_profiles FOR ALL policy had no WITH CHECK.
DROP POLICY IF EXISTS "Users manage own profile" ON public.health_profiles;
CREATE POLICY "Users manage own profile" ON public.health_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- newsletter_subscribers: add a basic email-format CHECK. Unsubscribe is
-- handled server-side via the service role (setting subscribed=false), so no
-- anon DELETE/UPDATE policy is granted (a permissive one would let anyone
-- delete any subscriber).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletter_email_format'
      AND conrelid = 'public.newsletter_subscribers'::regclass
  ) THEN
    ALTER TABLE public.newsletter_subscribers
      ADD CONSTRAINT newsletter_email_format
      CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  END IF;
END $$;

-- NOTE on donations / garden_herbs (DATA-3): these tables are defined in
-- migrations 00026/00027 with FOR ALL USING(true) WITH CHECK(true) policies,
-- but are ABSENT from production. Their policies are intentionally NOT touched
-- here pending the product decision on whether those features ship. If they
-- do, recreate them with owner-scoped RLS, not USING(true).