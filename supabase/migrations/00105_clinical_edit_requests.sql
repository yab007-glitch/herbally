-- 00105_clinical_edit_requests.sql
-- Open clinical reviewer edit-request triage queue validated via LinkedIn OIDC SSO.
-- Fail-closed governance: reviewer submissions never directly mutate live herbs or
-- drug_interactions tables; only AAL2-authenticated admins triage and apply changes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clinical_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_sub TEXT NOT NULL,
  linkedin_name TEXT NOT NULL,
  linkedin_email TEXT NOT NULL,
  linkedin_email_verified BOOLEAN NOT NULL DEFAULT false,
  linkedin_picture TEXT,
  linkedin_profile_url TEXT NOT NULL,
  professional_role TEXT NOT NULL CHECK (
    professional_role IN (
      'pharmacist',
      'physician',
      'nurse_practitioner_rn',
      'naturopathic_doctor',
      'clinical_pharmacologist',
      'medical_lab_technologist',
      'registered_dietitian',
      'clinical_herbalist',
      'other_clinician'
    )
  ),
  credentials TEXT NOT NULL,
  affiliation TEXT,
  licence_number TEXT,
  licence_jurisdiction TEXT,
  conflict_of_interest TEXT NOT NULL,
  attribution_consent BOOLEAN NOT NULL DEFAULT false,
  no_phi_attested BOOLEAN NOT NULL DEFAULT true CHECK (no_phi_attested = true),
  target_type TEXT NOT NULL CHECK (
    target_type IN ('herb', 'interaction', 'medication', 'general')
  ),
  herb_slug TEXT,
  drug_name TEXT,
  surface_url TEXT,
  field_scope TEXT NOT NULL CHECK (
    field_scope IN (
      'dosage_safety',
      'drug_interaction',
      'evidence_grade',
      'contraindications_pregnancy',
      'monograph_narrative',
      'citations_sources',
      'translation_fr',
      'other'
    )
  ),
  summary TEXT NOT NULL,
  current_text TEXT,
  proposed_change TEXT NOT NULL,
  clinical_rationale TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'under_review',
      'needs_info',
      'approved',
      'applied',
      'rejected'
    )
  ),
  admin_notes TEXT,
  reviewed_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_clinical_edit_requests_updated_at ON public.clinical_edit_requests;
CREATE TRIGGER trg_clinical_edit_requests_updated_at
  BEFORE UPDATE ON public.clinical_edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_clinical_edit_requests_status_created
  ON public.clinical_edit_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_edit_requests_linkedin_sub_created
  ON public.clinical_edit_requests (linkedin_sub, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_edit_requests_herb_slug
  ON public.clinical_edit_requests (herb_slug)
  WHERE herb_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.clinical_edit_request_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.clinical_edit_requests(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('linkedin_reviewer', 'admin', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_edit_request_events_request_created
  ON public.clinical_edit_request_events (request_id, created_at DESC);

ALTER TABLE public.clinical_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_edit_request_events ENABLE ROW LEVEL SECURITY;

-- Service role only: requests contain reviewer emails, optional private licence
-- numbers, and unpublished proposed clinical wording. Public/authenticated users
-- interact strictly through Next.js API routes and AAL2 admin server actions.
REVOKE ALL ON public.clinical_edit_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.clinical_edit_request_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.clinical_edit_requests TO service_role;
GRANT ALL ON public.clinical_edit_request_events TO service_role;

COMMIT;
