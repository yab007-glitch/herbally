-- 00104_pediatric_boundary_contract.sql
-- POST-SWITCH CONTRACT MIGRATION:
-- Applied ONLY AFTER the updated app image is deployed, healthy, and smoke-tested.
-- 0) Enforces adult-only `dosage_calculations` constraint/trigger/policy lockdown
--    (re-quarantining any old-image rows inserted during the expand window).
-- 1-6) Revokes direct anon/authenticated SELECT access to raw pediatric/prose/dose/
--    source-array columns on public base tables while keeping all sanitized
--    `*_public` views and RPCs readable.
--
-- Emergency rollback: run `scripts/rollback-00104-contract.sql` (or
-- `scripts/apply-pending-migrations.sh --rollback-contract`) if an image rollback
-- to a pre-contract container is required after contract has executed.

BEGIN;

-- 0) Post-switch dosage_calculations adult-only write lockdown.
-- Re-quarantine any legacy/non-adult/scaling rows written by the old image during expand.
UPDATE public.dosage_calculations
SET is_legacy_pediatric_quarantined = true
WHERE is_legacy_pediatric_quarantined = false
  AND (
    patient_age IS NULL
    OR patient_age < 18
    OR patient_age > 120
    OR formula_used <> 'adult_reference'
    OR (patient_weight_kg IS NOT NULL AND (patient_weight_kg < 20 OR patient_weight_kg > 350))
  );

DROP POLICY IF EXISTS "Anonymous can insert calculations" ON public.dosage_calculations;
REVOKE INSERT ON public.dosage_calculations FROM anon;

ALTER TABLE public.dosage_calculations
  DROP CONSTRAINT IF EXISTS dosage_calculations_adult_only_check;

ALTER TABLE public.dosage_calculations
  ADD CONSTRAINT dosage_calculations_adult_only_check CHECK (
    is_legacy_pediatric_quarantined
    OR (
      patient_age IS NOT NULL
      AND patient_age >= 18
      AND patient_age <= 120
      AND formula_used = 'adult_reference'
      AND (
        patient_weight_kg IS NULL
        OR (patient_weight_kg >= 20 AND patient_weight_kg <= 350)
      )
    )
  ) NOT VALID;

ALTER TABLE public.dosage_calculations
  VALIDATE CONSTRAINT dosage_calculations_adult_only_check;

CREATE OR REPLACE FUNCTION public.enforce_adult_only_dosage_calculations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_legacy_pediatric_quarantined THEN
      RAISE EXCEPTION 'Cannot insert quarantined calculation row' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.patient_age IS NULL OR NEW.patient_age < 18 OR NEW.patient_age > 120 THEN
      RAISE EXCEPTION 'Dosage calculations require confirmed adult age between 18 and 120' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.formula_used <> 'adult_reference' THEN
      RAISE EXCEPTION 'Only adult_reference formula is permitted; scaling formulas are disabled' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.patient_weight_kg IS NOT NULL AND (NEW.patient_weight_kg < 20 OR NEW.patient_weight_kg > 350) THEN
      RAISE EXCEPTION 'Adult weight must be between 20 and 350 kg when provided' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_legacy_pediatric_quarantined AND NOT NEW.is_legacy_pediatric_quarantined THEN
      RAISE EXCEPTION 'Quarantined legacy calculation rows cannot be un-quarantined' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT NEW.is_legacy_pediatric_quarantined THEN
      IF NEW.patient_age IS NULL OR NEW.patient_age < 18 OR NEW.patient_age > 120 THEN
        RAISE EXCEPTION 'Dosage calculations require confirmed adult age between 18 and 120' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.formula_used <> 'adult_reference' THEN
        RAISE EXCEPTION 'Only adult_reference formula is permitted; scaling formulas are disabled' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.patient_weight_kg IS NOT NULL AND (NEW.patient_weight_kg < 20 OR NEW.patient_weight_kg > 350) THEN
        RAISE EXCEPTION 'Adult weight must be between 20 and 350 kg when provided' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_adult_only_dosage_calculations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dosage_calculations_adult_only ON public.dosage_calculations;
CREATE TRIGGER trg_dosage_calculations_adult_only
  BEFORE INSERT OR UPDATE ON public.dosage_calculations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_adult_only_dosage_calculations();

DROP POLICY IF EXISTS "Users can insert own calculations" ON public.dosage_calculations;
CREATE POLICY "Users can insert own calculations"
  ON public.dosage_calculations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_legacy_pediatric_quarantined = false
    AND patient_age IS NOT NULL
    AND patient_age >= 18
    AND patient_age <= 120
    AND formula_used = 'adult_reference'
    AND (patient_weight_kg IS NULL OR (patient_weight_kg >= 20 AND patient_weight_kg <= 350))
  );

-- 1) public.herbs: revoke table-level SELECT and grant only non-prose metadata columns
-- (excludes dosage_child, dosage_adult, translations, preparation_notes, description,
-- traditional_uses, modern_uses, contraindications, side_effects).
REVOKE SELECT ON public.herbs FROM anon, authenticated;
GRANT SELECT (
  id,
  name,
  slug,
  scientific_name,
  common_names,
  active_compounds,
  dosage_forms,
  pregnancy_safe,
  nursing_safe,
  pregnancy_safe_oral,
  pregnancy_safe_topical,
  nursing_safe_oral,
  nursing_safe_topical,
  category_id,
  image_url,
  pubchem_cid,
  is_published,
  evidence_level,
  citations,
  reviewed_by,
  reviewer_credentials,
  last_reviewed,
  symptom_keywords,
  provenance,
  view_count,
  name_fr,
  created_at,
  updated_at
) ON public.herbs TO anon, authenticated;

-- 2) public.herb_faqs: exclude raw question, answer, translations
REVOKE SELECT ON public.herb_faqs FROM anon, authenticated;
GRANT SELECT (id, herb_id, category, sort_order) ON public.herb_faqs TO anon, authenticated;

-- 3) public.herb_monographs: exclude raw summary, mechanism, claims, safety_notes, drug_interactions
REVOKE SELECT ON public.herb_monographs FROM anon, authenticated;
GRANT SELECT (
  id,
  herb_id,
  herb_slug,
  pregnancy_category,
  key_citations,
  status,
  generation_method,
  reviewed_by,
  reviewer_credentials,
  last_reviewed_at,
  provenance,
  created_at,
  updated_at
) ON public.herb_monographs TO anon, authenticated;

-- 4) public.herb_regulatory_evidence: exclude raw purposes, doses, risks
REVOKE SELECT ON public.herb_regulatory_evidence FROM anon, authenticated;
GRANT SELECT (
  id,
  herb_slug,
  source,
  source_licence,
  products_sampled,
  source_urls,
  retrieved_at
) ON public.herb_regulatory_evidence TO anon, authenticated;

-- 5) public.herb_monograph_sources: exclude raw claims, safety, doses
REVOKE SELECT ON public.herb_monograph_sources FROM anon, authenticated;
GRANT SELECT (
  id,
  herb_slug,
  source,
  licence,
  attribution,
  url,
  generation_method,
  monograph_date,
  retrieved_at
) ON public.herb_monograph_sources TO anon, authenticated;

-- 6) public.herb_pubmed_monographs: exclude raw content
REVOKE SELECT ON public.herb_pubmed_monographs FROM anon, authenticated;
GRANT SELECT (
  id,
  slug,
  citations,
  pmids,
  article_count,
  model,
  status,
  last_reviewed,
  reviewed_by,
  updated_at
) ON public.herb_pubmed_monographs TO anon, authenticated;

-- Confirm sanitized public views remain selectable by anon, authenticated, service_role.
GRANT SELECT ON public.herbs_public TO anon, authenticated, service_role;
GRANT SELECT ON public.herb_faqs_public TO anon, authenticated, service_role;
GRANT SELECT ON public.herb_monographs_public TO anon, authenticated, service_role;
GRANT SELECT ON public.herb_regulatory_evidence_public TO anon, authenticated, service_role;
GRANT SELECT ON public.herb_monograph_sources_public TO anon, authenticated, service_role;
GRANT SELECT ON public.herb_pubmed_monographs_public TO anon, authenticated, service_role;

COMMIT;
