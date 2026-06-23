-- 00049: unique constraint on health_profiles.user_id so the saveHealthProfile
-- upsert (onConflict: "user_id") is valid. (Audit C2.)
--
-- Without a unique/exclusion constraint on user_id, PostgREST's
-- `INSERT ... ON CONFLICT (user_id) DO UPDATE` raises:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- and every add-condition / add-allergy call silently fails — conditions and
-- allergies that drive personalized safety warnings were never persisted.
--
-- Guests have user_id IS NULL and are keyed by guest_id, so the index is partial
-- (only where user_id IS NOT NULL) — multiple guest rows remain allowed.
--
-- Before adding the index, collapse any duplicate rows that accumulated while
-- the upsert was broken (keep the most recently updated row per user).

DO $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.health_profiles
  WHERE ctid IN (
    SELECT ctid
    FROM (
      SELECT ctid,
             ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, created_at DESC
             ) AS rn
      FROM public.health_profiles
      WHERE user_id IS NOT NULL
    ) t
    WHERE rn > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate health_profiles rows', deleted_count;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_profiles_user_unique
  ON public.health_profiles(user_id)
  WHERE user_id IS NOT NULL;