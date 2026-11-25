-- 00101_interaction_publication_contract.sql
-- Additive, reversible publication & scientific truthfulness contract for
-- herb-drug interactions. Does NOT add clinical interaction rows and does NOT
-- delete or mutate existing curated severity or clinical prose.

BEGIN;

-- Reconcile pre-existing schema drift: evidence_note was referenced by 00079/00082
-- without an ADD COLUMN migration in this repo.
ALTER TABLE public.drug_interactions
  ADD COLUMN IF NOT EXISTS evidence_note TEXT;

-- Remove unsafe legacy severity default ('mild') so new inserts must supply explicit severity.
ALTER TABLE public.drug_interactions
  ALTER COLUMN severity DROP DEFAULT;

-- 1) Normalized drug entities & aliases (prevents class/member & ingredient conflation)
CREATE TABLE IF NOT EXISTS public.drug_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_slug TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  is_drug_class BOOLEAN NOT NULL DEFAULT false,
  drug_class_name TEXT,
  single_ingredient_rxcui TEXT,
  atc_class_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drug_entities_class_rxcui_check CHECK (
    NOT (is_drug_class AND single_ingredient_rxcui IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_drug_entities_updated_at ON public.drug_entities;
CREATE TRIGGER trg_drug_entities_updated_at
  BEFORE UPDATE ON public.drug_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.drug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_entity_id UUID NOT NULL REFERENCES public.drug_entities(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (
    alias_type IN ('generic', 'brand', 'french_name', 'class_label', 'abbreviation')
  ),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drug_entity_id, normalized_alias, locale)
);

-- 1b) Idempotent reviewer registry creation so drug_interactions.clinical_reviewer_id
-- can reference verified, consented, licensed clinicians via FK and publication trigger.
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

-- 2) Additive governance, applicability & publication columns on drug_interactions.
ALTER TABLE public.drug_interactions
  ADD COLUMN IF NOT EXISTS drug_entity_id UUID REFERENCES public.drug_entities(id),
  ADD COLUMN IF NOT EXISTS is_drug_class BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_ingredient_rxcui TEXT,
  ADD COLUMN IF NOT EXISTS botanical_applicability TEXT NOT NULL DEFAULT 'unspecified' CHECK (
    botanical_applicability IN (
      'unspecified',
      'oral_standardized_extract',
      'oral_whole_herb_or_tea',
      'essential_oil_oral',
      'topical_external_only',
      'multiple_preparations'
    )
  ),
  ADD COLUMN IF NOT EXISTS mechanism_category TEXT NOT NULL DEFAULT 'unspecified' CHECK (
    mechanism_category IN (
      'unspecified',
      'cyp450_induction',
      'cyp450_inhibition',
      'p_glycoprotein_modulation',
      'pharmacodynamic_additive',
      'pharmacodynamic_antagonistic',
      'absorption_chelation_motility',
      'hepatotoxic_synergy',
      'other_documented'
    )
  ),
  ADD COLUMN IF NOT EXISTS evidence_tier TEXT NOT NULL DEFAULT 'unknown' CHECK (
    evidence_tier IN (
      'systematic_review_or_rct',
      'clinical_trial',
      'cohort_or_case_control',
      'case_series_or_case_report',
      'regulatory_label_extrapolation',
      'in_vivo_animal',
      'in_vitro',
      'theoretical',
      'unknown'
    )
  ),
  ADD COLUMN IF NOT EXISTS extrapolation_scope TEXT NOT NULL DEFAULT 'unverified' CHECK (
    extrapolation_scope IN (
      'human_clinical',
      'mixed_clinical_and_preclinical',
      'nonclinical_extrapolated',
      'theoretical_only',
      'unverified'
    )
  ),
  ADD COLUMN IF NOT EXISTS evidence_consistency TEXT NOT NULL DEFAULT 'unassessed' CHECK (
    evidence_consistency IN (
      'consistent',
      'mixed_or_conflicting',
      'negative_clinical_study',
      'single_report_only',
      'unassessed'
    )
  ),
  ADD COLUMN IF NOT EXISTS clinical_action_status TEXT NOT NULL DEFAULT 'unreviewed_blocked' CHECK (
    clinical_action_status IN (
      'unreviewed_blocked',
      'draft_pending_review',
      'clinician_approved',
      'suspended_collision_conflict'
    )
  ),
  ADD COLUMN IF NOT EXISTS pair_specific_clinical_action TEXT,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'legacy_unreviewed' CHECK (
    publication_status IN (
      'legacy_unreviewed',
      'draft',
      'clinically_verified',
      'published',
      'quarantined_collision',
      'retracted_hold'
    )
  ),
  ADD COLUMN IF NOT EXISTS clinical_reviewer_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_due_at TIMESTAMPTZ;

ALTER TABLE public.drug_interactions
  DROP CONSTRAINT IF EXISTS drug_interactions_clinical_reviewer_id_fkey;
ALTER TABLE public.drug_interactions
  ADD CONSTRAINT drug_interactions_clinical_reviewer_id_fkey
  FOREIGN KEY (clinical_reviewer_id)
  REFERENCES public.reviewer_registry(reviewer_id)
  ON DELETE RESTRICT
  NOT VALID;
ALTER TABLE public.drug_interactions
  VALIDATE CONSTRAINT drug_interactions_clinical_reviewer_id_fkey;

ALTER TABLE public.drug_interactions
  DROP CONSTRAINT IF EXISTS drug_interactions_class_rxcui_check;
ALTER TABLE public.drug_interactions
  ADD CONSTRAINT drug_interactions_class_rxcui_check CHECK (
    NOT (is_drug_class AND single_ingredient_rxcui IS NOT NULL)
  ) NOT VALID;
ALTER TABLE public.drug_interactions
  VALIDATE CONSTRAINT drug_interactions_class_rxcui_check;

-- Prevent duplicate published canonical interaction pairs (herb + generic prefix).
CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_interactions_published_canonical
  ON public.drug_interactions (herb_id, lower(trim(split_part(drug_name, ' (', 1))))
  WHERE publication_status = 'published';

-- 3) One-to-many claim-linked citations with source licence, retraction & dates
CREATE TABLE IF NOT EXISTS public.drug_interaction_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES public.drug_interactions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'regulatory_monograph',
      'systematic_review',
      'clinical_study',
      'pharmacovigilance_case',
      'preclinical_study',
      'reference_compendium'
    )
  ),
  source_name TEXT NOT NULL,
  source_licence TEXT NOT NULL,
  identifier TEXT,
  url TEXT,
  published_at DATE,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retraction_status TEXT NOT NULL DEFAULT 'active' CHECK (
    retraction_status IN ('active', 'corrected', 'expression_of_concern', 'retracted')
  ),
  claim_support_anchor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Immutable revision history (retained even on DELETE) & automatic review-reset on clinical edits
CREATE TABLE IF NOT EXISTS public.drug_interaction_revisions (
  revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID REFERENCES public.drug_interactions(id) ON DELETE SET NULL,
  interaction_record_id UUID NOT NULL,
  operation TEXT NOT NULL DEFAULT 'UPDATE' CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  previous_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,
  reason TEXT
);

ALTER TABLE public.drug_interaction_revisions
  ADD COLUMN IF NOT EXISTS interaction_record_id UUID,
  ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT 'UPDATE',
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.drug_interaction_revisions
SET interaction_record_id = COALESCE(interaction_id, revision_id)
WHERE interaction_record_id IS NULL;

ALTER TABLE public.drug_interaction_revisions
  ALTER COLUMN interaction_record_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.jsonb_changed_keys(p_old JSONB, p_new JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(k ORDER BY k), '{}'::text[])
  FROM (
    SELECT key AS k FROM jsonb_object_keys(COALESCE(p_old, '{}'::jsonb)) AS key
    UNION
    SELECT key AS k FROM jsonb_object_keys(COALESCE(p_new, '{}'::jsonb)) AS key
  ) keys
  WHERE (p_old -> k) IS DISTINCT FROM (p_new -> k);
$$;

CREATE OR REPLACE FUNCTION public.jsonb_pick_keys(p_obj JSONB, p_keys TEXT[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_object_agg(k, p_obj -> k), '{}'::jsonb)
  FROM unnest(COALESCE(p_keys, '{}'::text[])) AS k
  WHERE p_obj ? k;
$$;

CREATE OR REPLACE FUNCTION public.reset_drug_interaction_review_on_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clinical_changed BOOLEAN := false;
BEGIN
  clinical_changed :=
    OLD.drug_name IS DISTINCT FROM NEW.drug_name
    OR OLD.drug_entity_id IS DISTINCT FROM NEW.drug_entity_id
    OR OLD.is_drug_class IS DISTINCT FROM NEW.is_drug_class
    OR OLD.rxcui IS DISTINCT FROM NEW.rxcui
    OR OLD.single_ingredient_rxcui IS DISTINCT FROM NEW.single_ingredient_rxcui
    OR OLD.severity IS DISTINCT FROM NEW.severity
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.mechanism IS DISTINCT FROM NEW.mechanism
    OR OLD.mechanism_category IS DISTINCT FROM NEW.mechanism_category
    OR OLD.evidence_level IS DISTINCT FROM NEW.evidence_level
    OR OLD.evidence_tier IS DISTINCT FROM NEW.evidence_tier
    OR OLD.extrapolation_scope IS DISTINCT FROM NEW.extrapolation_scope
    OR OLD.evidence_consistency IS DISTINCT FROM NEW.evidence_consistency
    OR OLD.botanical_applicability IS DISTINCT FROM NEW.botanical_applicability
    OR OLD.pair_specific_clinical_action IS DISTINCT FROM NEW.pair_specific_clinical_action
    OR OLD.source IS DISTINCT FROM NEW.source
    OR OLD.source_url IS DISTINCT FROM NEW.source_url
    OR OLD.evidence_note IS DISTINCT FROM NEW.evidence_note
    OR OLD.translations IS DISTINCT FROM NEW.translations;

  IF clinical_changed AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    IF NEW.publication_status IN ('published', 'clinically_verified') THEN
      NEW.publication_status := 'draft';
    END IF;
    IF NEW.clinical_action_status = 'clinician_approved' THEN
      NEW.clinical_action_status := 'draft_pending_review';
    END IF;
    NEW.verified_at := NULL;
    NEW.clinical_reviewer_id := NULL;
    NEW.next_review_due_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_drug_interaction_review_on_edit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_drug_interaction_publication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_citations INTEGER := 0;
  v_retracted_citations INTEGER := 0;
  v_reviewer RECORD;
BEGIN
  IF NEW.publication_status = 'published' THEN
    IF NEW.severity IS NULL OR length(trim(COALESCE(NEW.description, ''))) = 0 THEN
      RAISE EXCEPTION 'Cannot publish interaction without severity and description' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.botanical_applicability IS NULL OR NEW.botanical_applicability = 'unspecified' THEN
      RAISE EXCEPTION 'Cannot publish interaction with unspecified botanical_applicability' USING ERRCODE = 'check_violation';
    END IF;
    IF length(trim(COALESCE(NEW.clinical_reviewer_id, ''))) = 0 OR NEW.verified_at IS NULL THEN
      RAISE EXCEPTION 'Cannot publish interaction without clinical_reviewer_id and verified_at' USING ERRCODE = 'check_violation';
    END IF;

    SELECT
      reviewer_id,
      reviewer_role,
      consent_recorded,
      licence_number_verified,
      licence_expires_at,
      verified_at
    INTO v_reviewer
    FROM public.reviewer_registry
    WHERE reviewer_id = NEW.clinical_reviewer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown clinical_reviewer_id: %', NEW.clinical_reviewer_id USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF v_reviewer.reviewer_role <> 'clinical' THEN
      RAISE EXCEPTION 'Reviewer % has role %, expected clinical', NEW.clinical_reviewer_id, v_reviewer.reviewer_role
        USING ERRCODE = 'check_violation';
    END IF;
    IF NOT v_reviewer.consent_recorded THEN
      RAISE EXCEPTION 'Clinical reviewer % lacks recorded consent', NEW.clinical_reviewer_id USING ERRCODE = 'check_violation';
    END IF;
    IF NOT v_reviewer.licence_number_verified OR v_reviewer.verified_at IS NULL THEN
      RAISE EXCEPTION 'Clinical reviewer % lacks verified active licence', NEW.clinical_reviewer_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_reviewer.licence_expires_at IS NOT NULL AND v_reviewer.licence_expires_at <= now() THEN
      RAISE EXCEPTION 'Clinical reviewer % licence has expired', NEW.clinical_reviewer_id USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.next_review_due_at IS NULL OR NEW.next_review_due_at <= now() THEN
      RAISE EXCEPTION 'Cannot publish interaction without future next_review_due_at' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.clinical_action_status <> 'clinician_approved'
       OR length(trim(COALESCE(NEW.pair_specific_clinical_action, ''))) = 0 THEN
      RAISE EXCEPTION 'Cannot publish interaction without clinician_approved pair_specific_clinical_action' USING ERRCODE = 'check_violation';
    END IF;

    SELECT
      count(*) FILTER (
        WHERE retraction_status = 'active'
          AND length(trim(COALESCE(url, ''))) > 0
          AND length(trim(COALESCE(source_licence, ''))) > 0
          AND length(trim(COALESCE(claim_support_anchor, ''))) > 0
      ),
      count(*) FILTER (WHERE retraction_status = 'retracted')
    INTO v_active_citations, v_retracted_citations
    FROM public.drug_interaction_citations
    WHERE interaction_id = NEW.id;

    IF v_retracted_citations > 0 THEN
      RAISE EXCEPTION 'Cannot publish interaction with a retracted citation' USING ERRCODE = 'check_violation';
    END IF;
    IF v_active_citations < 1 THEN
      RAISE EXCEPTION 'Cannot publish interaction without at least one active claim-supporting citation' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_drug_interaction_publication_gate() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_interaction_on_citation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_interaction_id UUID;
  v_active_citations INTEGER := 0;
  v_retracted_citations INTEGER := 0;
BEGIN
  v_interaction_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.interaction_id ELSE NEW.interaction_id END;
  IF v_interaction_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*) FILTER (
      WHERE retraction_status = 'active'
        AND length(trim(COALESCE(url, ''))) > 0
        AND length(trim(COALESCE(source_licence, ''))) > 0
        AND length(trim(COALESCE(claim_support_anchor, ''))) > 0
    ),
    count(*) FILTER (WHERE retraction_status = 'retracted')
  INTO v_active_citations, v_retracted_citations
  FROM public.drug_interaction_citations
  WHERE interaction_id = v_interaction_id;

  IF v_retracted_citations > 0 THEN
    UPDATE public.drug_interactions
    SET
      publication_status = 'retracted_hold',
      clinical_action_status = CASE
        WHEN clinical_action_status = 'clinician_approved' THEN 'draft_pending_review'
        ELSE clinical_action_status
      END
    WHERE id = v_interaction_id
      AND publication_status = 'published';
  ELSIF v_active_citations < 1 THEN
    UPDATE public.drug_interactions
    SET
      publication_status = 'draft',
      clinical_action_status = CASE
        WHEN clinical_action_status = 'clinician_approved' THEN 'draft_pending_review'
        ELSE clinical_action_status
      END
    WHERE id = v_interaction_id
      AND publication_status = 'published';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_interaction_on_citation_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_drug_interaction_revision_and_reset()
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
  v_reason TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old := '{}'::jsonb;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_changed := public.jsonb_changed_keys(v_old, v_new);
    v_reason := 'insert';
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := '{}'::jsonb;
    v_record_id := OLD.id;
    v_changed := public.jsonb_changed_keys(v_old, v_new);
    v_reason := 'delete';
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_changed := public.jsonb_changed_keys(v_old, v_new);
    SELECT COALESCE(array_agg(k), '{}'::text[]) INTO v_non_trivial
    FROM unnest(v_changed) AS k
    WHERE k <> 'updated_at';
    IF cardinality(v_non_trivial) = 0 THEN
      RETURN NULL;
    END IF;
    v_old := public.jsonb_pick_keys(v_old, v_non_trivial);
    v_new := public.jsonb_pick_keys(v_new, v_non_trivial);
    v_changed := v_non_trivial;
    v_reason := CASE
      WHEN v_changed && ARRAY[
        'drug_name','drug_entity_id','is_drug_class','rxcui','single_ingredient_rxcui',
        'severity','description','mechanism','mechanism_category','evidence_level',
        'evidence_tier','extrapolation_scope','evidence_consistency','botanical_applicability',
        'pair_specific_clinical_action','source','source_url','evidence_note','translations'
      ]::text[]
      THEN 'clinical_field_update'
      ELSE 'metadata_update'
    END;
  END IF;

  INSERT INTO public.drug_interaction_revisions (
    interaction_id,
    interaction_record_id,
    operation,
    changed_by,
    changed_fields,
    previous_snapshot,
    new_snapshot,
    reason
  ) VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_record_id END,
    v_record_id,
    TG_OP,
    auth.uid()::text,
    v_changed,
    v_old,
    v_new,
    v_reason
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_drug_interaction_revision_and_reset() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_drug_interaction_revision ON public.drug_interactions;
DROP TRIGGER IF EXISTS trg_drug_interaction_reset_review ON public.drug_interactions;
CREATE TRIGGER trg_drug_interaction_reset_review
  BEFORE UPDATE ON public.drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_drug_interaction_review_on_edit();

DROP TRIGGER IF EXISTS trg_drug_interaction_publication_gate ON public.drug_interactions;
CREATE TRIGGER trg_drug_interaction_publication_gate
  BEFORE INSERT OR UPDATE ON public.drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_drug_interaction_publication_gate();

DROP TRIGGER IF EXISTS trg_drug_interaction_audit_revision ON public.drug_interactions;
CREATE TRIGGER trg_drug_interaction_audit_revision
  AFTER INSERT OR UPDATE OR DELETE ON public.drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.log_drug_interaction_revision_and_reset();

DROP TRIGGER IF EXISTS trg_drug_interaction_citations_gate ON public.drug_interaction_citations;
CREATE TRIGGER trg_drug_interaction_citations_gate
  AFTER INSERT OR UPDATE OR DELETE ON public.drug_interaction_citations
  FOR EACH ROW EXECUTE FUNCTION public.sync_interaction_on_citation_change();

-- 5) Performance indexes
CREATE INDEX IF NOT EXISTS idx_drug_aliases_normalized_alias
  ON public.drug_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_publication_status
  ON public.drug_interactions (publication_status);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug_entity_id
  ON public.drug_interactions (drug_entity_id);
CREATE INDEX IF NOT EXISTS idx_drug_interaction_citations_interaction_status
  ON public.drug_interaction_citations (interaction_id, retraction_status);
CREATE INDEX IF NOT EXISTS idx_drug_interaction_revisions_interaction_changed
  ON public.drug_interaction_revisions (interaction_record_id, changed_at DESC);

-- 6) RLS hardening (AAL2 admin writes; read-only public catalog tables)
ALTER TABLE public.drug_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interaction_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interaction_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view drug entities" ON public.drug_entities;
CREATE POLICY "Public can view drug entities" ON public.drug_entities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage drug entities" ON public.drug_entities;
CREATE POLICY "Admins can manage drug entities"
  ON public.drug_entities FOR ALL TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Public can view drug aliases" ON public.drug_aliases;
CREATE POLICY "Public can view drug aliases" ON public.drug_aliases FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage drug aliases" ON public.drug_aliases;
CREATE POLICY "Admins can manage drug aliases"
  ON public.drug_aliases FOR ALL TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Public can view interaction citations" ON public.drug_interaction_citations;
CREATE POLICY "Public can view interaction citations" ON public.drug_interaction_citations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage interaction citations" ON public.drug_interaction_citations;
CREATE POLICY "Admins can manage interaction citations"
  ON public.drug_interaction_citations FOR ALL TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());

REVOKE INSERT, UPDATE, DELETE ON public.drug_interaction_revisions FROM anon, authenticated;

COMMIT;
