-- Harden SECURITY DEFINER helpers flagged by the Supabase security advisors.
--
-- 1. Pin search_path so a caller-controlled schema cannot shadow the built-ins
--    or tables these functions reference.
-- 2. Revoke EXECUTE on the two auth trigger functions. PostgreSQL invokes
--    trigger functions through the trigger machinery, which does not check
--    EXECUTE, so removing the grant does not affect signup or confirmation.
--    It does remove the public `/rest/v1/rpc/...` surface.
--
-- is_admin() intentionally keeps its EXECUTE grant: RLS policies evaluate it
-- for the querying role, and it only ever returns whether the current
-- authenticated user's profile has role = 'admin'.

ALTER FUNCTION public.auto_confirm_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep the trigger owner able to run them (service_role/postgres own the
-- functions, so no explicit grant is required), but assert the post-state so
-- this migration fails loudly if a later change re-grants them.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.auto_confirm_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'auto_confirm_user is still executable by anon';
  END IF;
  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'handle_new_user is still executable by anon';
  END IF;
  IF has_function_privilege('authenticated', 'public.auto_confirm_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'auto_confirm_user is still executable by authenticated';
  END IF;
  IF has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'handle_new_user is still executable by authenticated';
  END IF;
END $$;
