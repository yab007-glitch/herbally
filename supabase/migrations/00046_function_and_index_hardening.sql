-- 00046_function_and_index_hardening.sql
-- M-4 / L-2 / L-5 / L-6 / L-7 (audit 2026-06-22). Idempotent.

-- ── M-4: get_guest_chat_messages must require ownership proof ───────────────
-- 00038 made p_guest_id OPTIONAL (DEFAULT NULL) for backward compatibility,
-- with the comment that callers verify ownership themselves. But an attacker
-- with the public anon key can call the RPC directly via PostgREST and skip
-- the app-level check — reading any session's messages by id. Make p_guest_id
-- REQUIRED and enforce ownership server-side. The matching caller fix is in
-- src/lib/actions/chat-persist.ts (passes p_guest_id now).
DROP FUNCTION IF EXISTS public.get_guest_chat_messages(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.get_guest_chat_messages(
  p_session_id UUID,
  p_guest_id TEXT
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
    AND s.guest_id = p_guest_id
  ORDER BY m.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) TO anon;

-- ── L-2: increment_herb_view is anon-executable (view-count inflation) ──────
-- SECURITY DEFINER + default EXECUTE grant to anon/authenticated meant any
-- client could call it in a tight loop to inflate the popularity count. The
-- page-view path now calls it via the service role (src/app/(main)/herbs/
-- [slug]/page.tsx), so revoke from anon/authenticated and grant to service_role.
REVOKE EXECUTE ON FUNCTION public.increment_herb_view(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_herb_view(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_herb_view(UUID) TO service_role;

-- ── L-5: handle_new_user trigger function — pin search_path ─────────────────
-- SECURITY DEFINER without a pinned search_path (only references public.profiles
-- and NEW, so low risk, but hygiene). 00038 pinned the guest chat functions.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- ── L-6: drop the dead guest SELECT policy on chat_sessions ─────────────────
-- References request.jwt.claims ->> 'guest_id', a claim that is never set for
-- anon. The migration's own comments acknowledge it's non-functional; guests
-- read via the get_guest_chat_session SECURITY DEFINER function instead.
DROP POLICY IF EXISTS "Guests can view own chat sessions" ON public.chat_sessions;

-- ── L-7: drop redundant indexes backing already-UNIQUE columns ──────────────
-- herbs.slug is UNIQUE (00005) → its backing index makes idx_herbs_slug redundant.
-- ai_response_cache.prompt_hash is UNIQUE (00035) → idx_ai_response_cache_prompt_hash redundant.
DROP INDEX IF EXISTS public.idx_herbs_slug;
DROP INDEX IF EXISTS public.idx_ai_response_cache_prompt_hash;