-- 00051: enforce a single default patient_profile per user at the DB level.
-- (Audit L19.)
--
-- savePatientProfile unsets every other is_default row after insert, but two
-- concurrent "add patient" submissions can both INSERT is_default=true and
-- then each nullify the other → both end up false (zero defaults). A partial
-- unique index on (user_id) WHERE is_default makes the second insert fail
-- loudly instead of silently racing, and lets the action catch the unique
-- violation and retry the nullify. Before creating the index, collapse any
-- pre-existing duplicate defaults (keep the most recently updated). Idempotent.

DO $$
DECLARE
  deleted_count integer;
BEGIN
  -- For users with multiple default profiles, keep only the latest-updated one.
  -- Demote all-but-the-newest default to non-default rather than delete (we
  -- don't want to lose profile rows the user created).
  UPDATE public.patient_profiles pp
  SET is_default = false
  FROM (
    SELECT id, user_id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY updated_at DESC, created_at DESC
           ) AS rn
    FROM public.patient_profiles
    WHERE is_default = true
  ) dups
  WHERE pp.id = dups.id AND dups.rn > 1;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Demoted % duplicate default patient_profiles', deleted_count;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_default
  ON public.patient_profiles(user_id)
  WHERE is_default = true;