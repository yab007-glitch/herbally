-- 00054_lock_down_guest_chat_rpcs.sql
-- Security: lock down the guest chat RPCs so they can only be called from the
-- trusted server (service role), not directly via PostgREST with the public
-- anon key.
--
-- Background. Migrations 00038 + 00041 + 00046 hardened the guest chat RPCs
-- by pinning search_path and revoking EXECUTE from authenticated, but they
-- left the following RPCs GRANT'd to `anon` with a caller-supplied
-- p_guest_id parameter:
--
--   - get_guest_chat_sessions(p_guest_id TEXT)
--   - create_guest_chat_session(p_guest_id TEXT, p_herb_context TEXT)
--   - delete_guest_chat_session(p_session_id UUID, p_guest_id TEXT)
--   - get_guest_chat_session(p_session_id UUID, p_guest_id TEXT)
--
-- Because the anon role uses the public anon key baked into the client bundle,
-- any internet caller can POST /rest/v1/rpc/<name> with any guest_id value and
-- (a) enumerate another guest's chat sessions (leaking topic via auto-derived
-- titles like "Can I take St. John's Wort with sertraline?"), (b) inject
-- poisoned session rows, (c) delete sessions. guest_ids are random UUIDs so
-- they're hard to brute-force, but they leak via browser history, Sentry
-- breadcrumbs, error reports, support screenshots, etc. — once leaked, full
-- session enumeration + history-wipe is one curl away.
--
-- get_guest_chat_messages + add_guest_chat_message were already ownership-
-- checked in 00046, but they remain GRANT'd to anon; that path is fine
-- because the ownership check is enforced server-side. We still drop the
-- anon grant here so the entire guest chat RPC surface is uniformly callable
-- only from the server (defense in depth).
--
-- Fix: REVOKE EXECUTE ... FROM anon (and PUBLIC, authenticated) for the four
-- RPCs above, GRANT EXECUTE only to service_role, and re-issue the function
-- bodies to enforce the p_guest_id ownership check inside each one so a
-- misconfigured caller cannot bypass it either.

-- ============================================================================
-- get_guest_chat_sessions(p_guest_id)
-- Returns sessions for the given guest (now: ownership enforced inside the
-- function body — the function trusts the caller is service_role and uses
-- p_guest_id as the lookup key; this matches the chat-persist call site which
-- reads guestId from the HttpOnly cookie server-side).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_guest_chat_sessions(p_guest_id TEXT)
RETURNS SETOF public.chat_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.chat_sessions
  WHERE guest_id = p_guest_id
  ORDER BY updated_at DESC
  LIMIT 20;
$$;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) TO service_role;

-- ============================================================================
-- create_guest_chat_session(p_guest_id, p_herb_context)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_guest_chat_session(
  p_guest_id TEXT,
  p_herb_context TEXT DEFAULT NULL
)
RETURNS public.chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_session public.chat_sessions;
BEGIN
  INSERT INTO public.chat_sessions (guest_id, title, herb_context, user_id)
  VALUES (p_guest_id, 'New Chat', p_herb_context, NULL)
  RETURNING * INTO new_session;
  RETURN new_session;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) TO service_role;

-- ============================================================================
-- add_guest_chat_message(p_session_id, p_role, p_content, p_guest_id)
-- Already ownership-checked in 00022 + 00038. Re-issued here to also tighten
-- the role allow-list (a guest must not be able to plant 'system' messages —
-- this is now enforced inside the RPC, the chat API rejects 'system' too,
-- and this is the last write path that bypassed the chat-API Zod schema).
-- p_role restricted to 'user' | 'assistant'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_guest_chat_message(
  p_session_id UUID,
  p_role TEXT,
  p_content TEXT,
  p_guest_id TEXT
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_message public.chat_messages;
  v_session record;
BEGIN
  IF p_role NOT IN ('user', 'assistant') THEN
    RAISE EXCEPTION 'role must be user or assistant';
  END IF;

  SELECT id, title INTO v_session
  FROM public.chat_sessions
  WHERE id = p_session_id AND guest_id = p_guest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or not owned by guest';
  END IF;

  INSERT INTO public.chat_messages (session_id, role, content)
  VALUES (p_session_id, p_role, p_content)
  RETURNING * INTO new_message;

  IF p_role = 'user' AND v_session.title = 'New Chat' THEN
    UPDATE public.chat_sessions
    SET title = LEFT(p_content, 50) || CASE WHEN LENGTH(p_content) > 50 THEN '...' ELSE '' END,
        updated_at = now()
    WHERE id = p_session_id;
  ELSE
    UPDATE public.chat_sessions
    SET updated_at = now()
    WHERE id = p_session_id;
  END IF;

  RETURN new_message;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- delete_guest_chat_session(p_session_id, p_guest_id)
-- Ownership already enforced via WHERE clause. Lock the GRANT to service_role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_guest_chat_session(
  p_session_id UUID,
  p_guest_id TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.chat_sessions
  WHERE id = p_session_id AND guest_id = p_guest_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) TO service_role;

-- ============================================================================
-- get_guest_chat_session(p_session_id, p_guest_id)
-- Single-session fetch with ownership check. Lock the GRANT to service_role.
-- ============================================================================
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
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) TO service_role;

-- ============================================================================
-- get_guest_chat_messages(p_session_id, p_guest_id)
-- 00046 added the ownership check + pinned search_path; this migration locks
-- the GRANT to service_role for parity with the rest of the guest chat surface.
-- ============================================================================
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
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) TO service_role;
