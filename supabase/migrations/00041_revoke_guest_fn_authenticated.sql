-- 00041_revoke_guest_fn_authenticated.sql
-- Follow-up to 00038 (SEC-4). 00038 did `REVOKE EXECUTE FROM PUBLIC` and
-- `GRANT EXECUTE TO anon` on the guest chat SECURITY DEFINER functions, but the
-- functions' original CREATE statements carried an explicit `GRANT TO
-- authenticated` (Supabase default). REVOKE FROM PUBLIC only strips the
-- PUBLIC-derived grant, not the explicit `authenticated` one — so logged-in
-- users could still call guest functions over the REST RPC surface.
--
-- Guest functions are for anonymous (anon-key) use only; authenticated users
-- use the user-scoped chat_sessions path. Revoke authenticated EXECUTE so the
-- effective access matches the audit's "anon only" intent. The functions
-- already pin search_path and verify guest_id ownership (00038), so this is
-- defense-in-depth, not the sole control. Effective access for anon and
-- service_role is unchanged.

REVOKE EXECUTE ON FUNCTION public.get_guest_chat_sessions(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_guest_chat_session(TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_guest_chat_message(UUID, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_guest_chat_session(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_messages(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_guest_chat_session(UUID, TEXT) FROM authenticated;