-- 00102_scientific_governance_and_incidents.sql
-- Additive scientific validation, attribution fail-closed governance,
-- immutable clinical revision audit trail, and safety-incident / corrections intake.
-- Adds schema plumbing only; invents no medical claims, reviewers, or compliance status.

BEGIN;

-- 1) Reviewer registry with editorial vs clinical role separation, verified licence & consent gate
CREATE TABLE IF NOT EXISTS public.reviewer_registry (
  reviewer_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('editorial', 'clinical')),
  consent_recorded BOOLEAN NOT NULL DEFAULT false,
  public_attribution_allowed BOOLEAN NOT NULL DEFAULT false,
  licence_number_verified BOOLEAN NOT NULL DEFAULT false,
  licence_jurisdiction TEXT,
  licence_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviewer_registry
  ADD COLUMN IF NOT EXISTS licence_number_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS licence_jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS licence_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_reviewer_registry_updated_at ON public.reviewer_registry;
CREATE TRIGGER trg_reviewer_registry_updated_at
  BEFORE UPDATE ON public.reviewer_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Claim-level citations distinct from herb-level evidence grades
CREATE TABLE IF NOT EXISTS public.claim_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_slug TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'regulatory_monograph',
      'systematic_review',
      'clinical_trial',
      'clinical_study',
      'pharmacovigilance_case',
      'preclinical_study'
    )
  ),
  source_name TEXT NOT NULL,
  source_licence TEXT NOT NULL DEFAULT 'unspecified',
  source_url TEXT NOT NULL,
  published_at DATE,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  species_match BOOLEAN NOT NULL DEFAULT false,
  preparation_match BOOLEAN NOT NULL DEFAULT false,
  evidence_quality TEXT NOT NULL CHECK (
    evidence_quality IN ('high', 'moderate', 'low', 'very_low', 'unassessed')
  ),
  retraction_status TEXT NOT NULL DEFAULT 'active' CHECK (
    retraction_status IN ('active', 'corrected', 'expression_of_concern', 'retracted')
  ),
  reviewer_id TEXT REFERENCES public.reviewer_registry(reviewer_id),
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('editorial', 'clinical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_citations
  ADD COLUMN IF NOT EXISTS source_licence TEXT NOT NULL DEFAULT 'unspecified';

CREATE OR REPLACE FUNCTION public.validate_claim_citation_reviewer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF NEW.reviewer_id IS NOT NULL THEN
    SELECT reviewer_role INTO v_role
    FROM public.reviewer_registry
    WHERE reviewer_id = NEW.reviewer_id;

    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Unknown reviewer_id: %', NEW.reviewer_id USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF v_role <> NEW.reviewer_role THEN
      RAISE EXCEPTION 'claim_citations.reviewer_role (%) does not match reviewer_registry.reviewer_role (%)', NEW.reviewer_role, v_role
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_claim_citation_reviewer_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_claim_citations_reviewer_role ON public.claim_citations;
CREATE TRIGGER trg_claim_citations_reviewer_role
  BEFORE INSERT OR UPDATE ON public.claim_citations
  FOR EACH ROW EXECUTE FUNCTION public.validate_claim_citation_reviewer_role();

-- 3) Immutable clinical content revision history + triggers resetting clinical review on edits
CREATE TABLE IF NOT EXISTS public.clinical_content_revisions (
  revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  record_slug TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'UPDATE' CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  previous_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,
  clinical_fields_changed BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.clinical_content_revisions
  ADD COLUMN IF NOT EXISTS record_id UUID,
  ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT 'UPDATE',
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.reset_herb_clinical_review_on_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clinical_changed BOOLEAN := false;
BEGIN
  clinical_changed :=
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.scientific_name IS DISTINCT FROM NEW.scientific_name
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.dosage_adult IS DISTINCT FROM NEW.dosage_adult
    OR OLD.dosage_child IS DISTINCT FROM NEW.dosage_child
    OR OLD.dosage_forms IS DISTINCT FROM NEW.dosage_forms
    OR OLD.preparation_notes IS DISTINCT FROM NEW.preparation_notes
    OR OLD.contraindications IS DISTINCT FROM NEW.contraindications
    OR OLD.side_effects IS DISTINCT FROM NEW.side_effects
    OR OLD.pregnancy_safe IS DISTINCT FROM NEW.pregnancy_safe
    OR OLD.nursing_safe IS DISTINCT FROM NEW.nursing_safe
    OR OLD.pregnancy_safe_oral IS DISTINCT FROM NEW.pregnancy_safe_oral
    OR OLD.pregnancy_safe_topical IS DISTINCT FROM NEW.pregnancy_safe_topical
    OR OLD.nursing_safe_oral IS DISTINCT FROM NEW.nursing_safe_oral
    OR OLD.nursing_safe_topical IS DISTINCT FROM NEW.nursing_safe_topical
    OR OLD.evidence_level IS DISTINCT FROM NEW.evidence_level
    OR OLD.citations IS DISTINCT FROM NEW.citations
    OR OLD.translations IS DISTINCT FROM NEW.translations;

  IF clinical_changed THEN
    -- Reset clinical attribution & provenance review status unless the same
    -- transaction explicitly sets a fresh last_reviewed timestamp.
    IF NEW.last_reviewed IS NOT DISTINCT FROM OLD.last_reviewed THEN
      NEW.reviewed_by := NULL;
      NEW.reviewer_credentials := NULL;
      NEW.last_reviewed := NULL;
      NEW.provenance := COALESCE(NEW.provenance, '{}'::jsonb) || jsonb_build_object(
        'review_status', 'needs_re_review',
        'reviewed_by_name', NULL,
        'reviewed_on', NULL
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_herb_clinical_review_on_edit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_herb_clinical_revisions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_changed TEXT[];
  v_non_trivial TEXT[];
  v_record_id UUID;
  v_record_slug TEXT;
  v_clinical_changed BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old := '{}'::jsonb;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_record_slug := NEW.slug;
    v_changed := public.jsonb_changed_keys(v_old, v_new);
    v_clinical_changed := true;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := '{}'::jsonb;
    v_record_id := OLD.id;
    v_record_slug := OLD.slug;
    v_changed := public.jsonb_changed_keys(v_old, v_new);
    v_clinical_changed := true;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_record_slug := NEW.slug;
    v_changed := public.jsonb_changed_keys(v_old, v_new);

    SELECT COALESCE(array_agg(k), '{}'::text[]) INTO v_non_trivial
    FROM unnest(v_changed) AS k
    WHERE k NOT IN ('view_count', 'updated_at');

    IF cardinality(v_non_trivial) = 0 THEN
      RETURN NULL;
    END IF;

    v_old := public.jsonb_pick_keys(v_old, v_non_trivial);
    v_new := public.jsonb_pick_keys(v_new, v_non_trivial);
    v_changed := v_non_trivial;
    v_clinical_changed := v_changed && ARRAY[
      'name','scientific_name','description','dosage_adult','dosage_child','dosage_forms',
      'preparation_notes','contraindications','side_effects','pregnancy_safe','nursing_safe',
      'pregnancy_safe_oral','pregnancy_safe_topical','nursing_safe_oral','nursing_safe_topical',
      'evidence_level','citations','translations'
    ]::text[];
  END IF;

  INSERT INTO public.clinical_content_revisions (
    table_name,
    record_id,
    record_slug,
    operation,
    changed_by,
    changed_fields,
    previous_snapshot,
    new_snapshot,
    clinical_fields_changed
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    v_record_slug,
    TG_OP,
    auth.uid()::text,
    v_changed,
    v_old,
    v_new,
    v_clinical_changed
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_herb_clinical_revisions() FROM PUBLIC, anon, authenticated;

-- Tag bulk 00079 editorial verification rows BEFORE attaching clinical edit-reset
-- and audit triggers so existing bulk editorial rows are explicitly distinguished
-- from clinical review without resetting or bloating revisions.
UPDATE public.herbs
SET provenance = provenance || jsonb_build_object(
  'review_role', 'editorial',
  'bulk_editorial_import', true
)
WHERE provenance->>'review_status' = 'human_reviewed'
  AND provenance->>'reviewed_by_name' = 'Yasser Bheekun'
  AND provenance->>'reviewed_on' = '2026-11-18'
  AND COALESCE(provenance->>'review_role', '') <> 'clinical';

DROP TRIGGER IF EXISTS trg_reset_clinical_review_on_edit ON public.herbs;
CREATE TRIGGER trg_reset_clinical_review_on_edit
  BEFORE UPDATE ON public.herbs
  FOR EACH ROW EXECUTE FUNCTION public.reset_herb_clinical_review_on_edit();

DROP TRIGGER IF EXISTS trg_audit_herb_clinical_revisions ON public.herbs;
CREATE TRIGGER trg_audit_herb_clinical_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.herbs
  FOR EACH ROW EXECUTE FUNCTION public.audit_herb_clinical_revisions();

-- 4) Safety incidents, triage/SLA audit trail, and public corrections log
CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (
    category IN (
      'pediatric_safety',
      'interaction_conflict_or_error',
      'toxic_herb_exposure_risk',
      'broken_or_retracted_citation',
      'translation_clinical_mismatch',
      'privacy_or_data_concern',
      'other'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  surface_url TEXT,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  triage_status TEXT NOT NULL DEFAULT 'open_triage' CHECK (
    triage_status IN (
      'open_triage',
      'investigating',
      'mitigated_pending_review',
      'resolved_corrected',
      'closed_not_confirmed'
    )
  ),
  sla_due_at TIMESTAMPTZ NOT NULL,
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_safety_incidents_updated_at ON public.safety_incidents;
CREATE TRIGGER trg_safety_incidents_updated_at
  BEFORE UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.safety_incident_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.safety_incidents(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_corrections_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.safety_incidents(id) ON DELETE SET NULL,
  affected_surface TEXT NOT NULL,
  correction_summary TEXT NOT NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT
);

CREATE OR REPLACE FUNCTION public.create_safety_incident_with_audit(
  p_category TEXT,
  p_severity TEXT,
  p_surface_url TEXT,
  p_summary TEXT,
  p_details TEXT,
  p_triage_status TEXT,
  p_sla_due_at TIMESTAMPTZ,
  p_actor TEXT DEFAULT 'public_intake'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO public.safety_incidents (
    category,
    severity,
    surface_url,
    summary,
    details,
    triage_status,
    sla_due_at
  ) VALUES (
    p_category,
    p_severity,
    p_surface_url,
    p_summary,
    p_details,
    p_triage_status,
    p_sla_due_at
  )
  RETURNING id INTO v_incident_id;

  INSERT INTO public.safety_incident_audit_log (
    incident_id,
    actor,
    action,
    note
  ) VALUES (
    v_incident_id,
    COALESCE(NULLIF(trim(p_actor), ''), 'public_intake'),
    'created',
    format('severity=%s; triage=%s', p_severity, p_triage_status)
  );

  RETURN v_incident_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_safety_incident_with_audit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_safety_incident_with_audit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

-- 5) Performance indexes
CREATE INDEX IF NOT EXISTS idx_claim_citations_herb_claim
  ON public.claim_citations (herb_slug, claim_key);
CREATE INDEX IF NOT EXISTS idx_claim_citations_retraction
  ON public.claim_citations (retraction_status);
CREATE INDEX IF NOT EXISTS idx_clinical_content_revisions_lookup
  ON public.clinical_content_revisions (table_name, record_slug, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_content_revisions_changed_at
  ON public.clinical_content_revisions (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_triage_sla
  ON public.safety_incidents (triage_status, sla_due_at);
CREATE INDEX IF NOT EXISTS idx_safety_incident_audit_incident
  ON public.safety_incident_audit_log (incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_corrections_log_corrected_at
  ON public.public_corrections_log (corrected_at DESC);

-- 6) RLS hardening: public read only for consented/verified/licensed reviewers,
-- public corrections log, and public claim citations (excluding raw reviewer_id).
ALTER TABLE public.reviewer_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_content_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incident_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_corrections_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view consented verified reviewers" ON public.reviewer_registry;
CREATE POLICY "Public can view consented verified reviewers"
  ON public.reviewer_registry FOR SELECT
  USING (
    consent_recorded = true
    AND public_attribution_allowed = true
    AND verified_at IS NOT NULL
    AND (
      reviewer_role <> 'clinical'
      OR (
        licence_number_verified = true
        AND (licence_expires_at IS NULL OR licence_expires_at > now())
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage reviewer registry" ON public.reviewer_registry;
CREATE POLICY "Admins can manage reviewer registry"
  ON public.reviewer_registry FOR ALL TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Public can view active claim citations" ON public.claim_citations;
CREATE POLICY "Public can view active claim citations"
  ON public.claim_citations FOR SELECT
  USING (retraction_status <> 'retracted');

DROP POLICY IF EXISTS "Admins can manage claim citations" ON public.claim_citations;
CREATE POLICY "Admins can manage claim citations"
  ON public.claim_citations FOR ALL TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());

-- Protect raw reviewer_id on claim_citations from unauthenticated/non-admin exposure.
REVOKE SELECT ON public.claim_citations FROM anon, authenticated;
GRANT SELECT (
  id, herb_slug, claim_key, source_type, source_name, source_licence,
  source_url, published_at, retrieved_at, species_match, preparation_match,
  evidence_quality, retraction_status, reviewer_role, created_at
) ON public.claim_citations TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_claim_citations
WITH (security_invoker = true) AS
SELECT
  id,
  herb_slug,
  claim_key,
  source_type,
  source_name,
  source_licence,
  source_url,
  published_at,
  retrieved_at,
  species_match,
  preparation_match,
  evidence_quality,
  retraction_status,
  reviewer_role,
  created_at
FROM public.claim_citations
WHERE retraction_status <> 'retracted';

GRANT SELECT ON public.public_claim_citations TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can view corrections log" ON public.public_corrections_log;
CREATE POLICY "Public can view corrections log"
  ON public.public_corrections_log FOR SELECT
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.clinical_content_revisions FROM anon, authenticated;
REVOKE ALL ON public.safety_incidents FROM anon, authenticated;
REVOKE ALL ON public.safety_incident_audit_log FROM anon, authenticated;

COMMIT;
