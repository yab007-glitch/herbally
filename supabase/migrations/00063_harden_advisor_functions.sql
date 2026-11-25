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

-- Harden the helpers that exist in this installation. auto_confirm_user() and
-- is_admin() are created outside the migration chain in the hosted project, so
-- a fresh replay must skip them rather than fail on ALTER FUNCTION.
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.auto_confirm_user()',
    'public.is_admin()',
    'public.handle_new_user()'
  ] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_fn);
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.auto_confirm_user()',
    'public.handle_new_user()'
  ] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    END IF;
  END LOOP;
END $$;

-- Keep the trigger owner able to run them (service_role/postgres own the
-- functions, so no explicit grant is required), but assert the post-state so
-- this migration fails loudly if a later change re-grants them.
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.auto_confirm_user()',
    'public.handle_new_user()'
  ] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION '% is still executable by anon', v_fn;
      END IF;
      IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION '% is still executable by authenticated', v_fn;
      END IF;
    END IF;
  END LOOP;
END $$;
