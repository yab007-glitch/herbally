-- 00103_privacy_minimization_controls.sql
-- Additive privacy minimization, explicit opt-in consent ledger, and retention
-- metadata. Backward-safe with existing runtime code until deployed.
-- Does NOT claim HIPAA, PIPEDA, Law 25 EFVP, or signed DPA status.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_scope TEXT NOT NULL CHECK (
    consent_scope IN (
      'health_profile',
      'patient_profile',
      'medications_list',
      'dosage_history',
      'ai_personalization'
    )
  ),
  granted BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '2026-11-25-v1',
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_scope)
);

-- Ensure pre-existing installations get the expanded consent_scope constraint.
ALTER TABLE public.user_privacy_consents
  DROP CONSTRAINT IF EXISTS user_privacy_consents_consent_scope_check;
ALTER TABLE public.user_privacy_consents
  ADD CONSTRAINT user_privacy_consents_consent_scope_check CHECK (
    consent_scope IN (
      'health_profile',
      'patient_profile',
      'medications_list',
      'dosage_history',
      'ai_personalization'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_privacy_consents_user_scope_granted
  ON public.user_privacy_consents (user_id, consent_scope, granted);

DROP TRIGGER IF EXISTS trg_user_privacy_consents_updated_at ON public.user_privacy_consents;
CREATE TRIGGER trg_user_privacy_consents_updated_at
  BEFORE UPDATE ON public.user_privacy_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_privacy_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own privacy consents" ON public.user_privacy_consents;
CREATE POLICY "Users manage own privacy consents"
  ON public.user_privacy_consents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Retention metadata columns (additive, nullable for safe live rollout)
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

ALTER TABLE public.dosage_calculations
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

COMMENT ON TABLE public.ai_response_cache IS
  'Server-only shared cache for stateless single-turn public educational queries only. Personalized (medication/herbContext) and multi-turn chats must bypass read and write.';

COMMIT;
