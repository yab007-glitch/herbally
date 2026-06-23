-- 00047_patient_profiles.sql
-- M-3 / M-2 (audit 2026-06-22): patient_profiles is referenced by
-- src/lib/actions/profile.ts and the generated types, but NO migration creates
-- it — the table was either missing (feature broken on fresh DBs) or created
-- out-of-band with untracked RLS (same drift class 00040 fixed for
-- donations/garden). Track it in version control with owner-scoped RLS
-- including WITH CHECK on UPDATE (closes the M-2 row-transfer gap: the
-- updatePatientProfile action now also strips user_id/id/created_at from the
-- payload, but RLS WITH CHECK is the durable control).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE.

CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'self',
  age_years INTEGER,
  age_months INTEGER,
  weight_kg NUMERIC(6,2),
  height_cm NUMERIC(6,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user
  ON public.patient_profiles(user_id);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own patient profiles" ON public.patient_profiles;
CREATE POLICY "Users manage own patient profiles"
  ON public.patient_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_patient_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at ON public.patient_profiles;
CREATE TRIGGER trg_patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_patient_profile_updated_at();