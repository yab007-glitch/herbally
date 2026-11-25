-- 00100_pediatric_containment_dosage_calculations.sql
-- EXPAND-PHASE deterministic database-level pediatric dosage containment.
--
-- Expand/Contract Rollout Compatibility:
--   - Enum value 'adult_reference' is added in 00099b_formula_type_adult_reference_enum.sql
--     so this file runs cleanly inside a single BEGIN; ... COMMIT; transaction.
--   - This expand migration adds `dosage_calculations.is_legacy_pediatric_quarantined`,
--     `patient_profiles.adult_dosing_eligible`, `herbs.name_fr`,
--     `herbs_pediatric_quarantine`, PostgreSQL-16-compatible `strip_pediatric_dosage_text()`,
--     sanitized `*_public` views, and bundle/RPC redaction WITHOUT revoking base-table
--     SELECT or blocking old-image calculator writes yet, so the previous app image
--     remains compatible for both reads and writes during rolling switch.
--   - Post-switch `00104_pediatric_boundary_contract.sql` enforces the adult-only
--     `dosage_calculations` constraint/trigger/policy lockdown and revokes direct
--     anon/authenticated SELECT on raw pediatric/prose/dose/source columns once the
--     new app image is healthy.

BEGIN;

-- 1) Add quarantine flag and tag existing legacy non-adult / unknown-age / scaling-formula
-- rows without deleting historical user data and without blocking old-image expand writes.
ALTER TABLE public.dosage_calculations
  ADD COLUMN IF NOT EXISTS is_legacy_pediatric_quarantined BOOLEAN NOT NULL DEFAULT false;

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

-- 3) Add computed eligibility column on patient_profiles without deleting legacy rows.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS adult_dosing_eligible BOOLEAN
  GENERATED ALWAYS AS (
    age_years IS NOT NULL
    AND age_years >= 18
    AND age_years <= 120
    AND relationship <> 'child'
    AND age_months IS NULL
  ) STORED;

-- 4) Quarantine public.herbs.dosage_child & translations.fr.dosage_child at DB boundary,
-- and add stored generated name_fr so post-contract interaction queries never need raw translations.
ALTER TABLE public.herbs
  ADD COLUMN IF NOT EXISTS name_fr TEXT
  GENERATED ALWAYS AS (NULLIF(translations->'fr'->>'name', '')) STORED;

COMMENT ON COLUMN public.herbs.dosage_child IS
  'QUARANTINED NON-PUBLIC LEGACY FIELD: archived to herbs_pediatric_quarantine, excluded from public views/RPCs, and revoked from anon/authenticated in contract 00104.';

CREATE TABLE IF NOT EXISTS public.herbs_pediatric_quarantine (
  herb_id UUID PRIMARY KEY REFERENCES public.herbs(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  dosage_child TEXT,
  fr_dosage_child TEXT,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.herbs_pediatric_quarantine ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.herbs_pediatric_quarantine FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.herbs_pediatric_quarantine TO service_role;

INSERT INTO public.herbs_pediatric_quarantine (herb_id, dosage_child, fr_dosage_child, quarantined_at)
SELECT
  h.id,
  h.dosage_child,
  NULLIF(h.translations->'fr'->>'dosage_child', ''),
  now()
FROM public.herbs h
WHERE h.dosage_child IS NOT NULL
   OR (jsonb_typeof(h.translations->'fr') = 'object' AND (h.translations->'fr' ? 'dosage_child'))
ON CONFLICT (herb_id) DO UPDATE
SET
  dosage_child = COALESCE(EXCLUDED.dosage_child, public.herbs_pediatric_quarantine.dosage_child),
  fr_dosage_child = COALESCE(EXCLUDED.fr_dosage_child, public.herbs_pediatric_quarantine.fr_dosage_child),
  quarantined_at = now();

UPDATE public.herbs
SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb),
  '{fr}',
  (translations->'fr') - 'dosage_child',
  true
)
WHERE jsonb_typeof(translations->'fr') = 'object'
  AND (translations->'fr' ? 'dosage_child');

CREATE OR REPLACE FUNCTION public.quarantine_herb_pediatric_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fr_child TEXT;
BEGIN
  IF jsonb_typeof(NEW.translations->'fr') = 'object' AND (NEW.translations->'fr' ? 'dosage_child') THEN
    v_fr_child := NULLIF(NEW.translations->'fr'->>'dosage_child', '');
    NEW.translations := jsonb_set(
      COALESCE(NEW.translations, '{}'::jsonb),
      '{fr}',
      (NEW.translations->'fr') - 'dosage_child',
      true
    );
  END IF;

  IF NEW.dosage_child IS NOT NULL OR v_fr_child IS NOT NULL THEN
    INSERT INTO public.herbs_pediatric_quarantine (herb_id, dosage_child, fr_dosage_child, quarantined_at)
    VALUES (NEW.id, NEW.dosage_child, v_fr_child, now())
    ON CONFLICT (herb_id) DO UPDATE
    SET
      dosage_child = COALESCE(EXCLUDED.dosage_child, public.herbs_pediatric_quarantine.dosage_child),
      fr_dosage_child = COALESCE(EXCLUDED.fr_dosage_child, public.herbs_pediatric_quarantine.fr_dosage_child),
      quarantined_at = now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.quarantine_herb_pediatric_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_herbs_quarantine_pediatric ON public.herbs;
CREATE TRIGGER trg_herbs_quarantine_pediatric
  BEFORE INSERT OR UPDATE ON public.herbs
  FOR EACH ROW EXECUTE FUNCTION public.quarantine_herb_pediatric_fields();

-- 5) SQL-level PostgreSQL-16-compatible pediatric dosing clause stripper & public redaction.
CREATE OR REPLACE FUNCTION public.strip_pediatric_dosage_text(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_marked TEXT;
  sentences TEXT[];
  v_sentence TEXT;
  v_term_punct TEXT;
  clauses TEXT[];
  part TEXT;
  cleaned TEXT;
  kept_clauses TEXT[];
  kept TEXT[] := ARRAY[]::TEXT[];
  sentence_has_ped_ctx BOOLEAN;
  has_ped BOOLEAN;
  effective_has_ped BOOLEAN;
  has_adult BOOLEAN;
  has_explicit_adult_age BOOLEAN;
  cleaned_has_under18 BOOLEAN;
  has_dose BOOLEAN;
  has_numeric_dose BOOLEAN;
  has_negation BOOLEAN;
  has_affirmative_prescriptive_ped_dose BOOLEAN;
  is_warning BOOLEAN;
  v_sentence_out TEXT;
  v_joined TEXT;
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- PostgreSQL 16 ARE does not support regex lookbehind assertions.
  -- Mark sentence/newline boundaries with Unit Separator (0x1F) without breaking
  -- decimals like "1.5 g", then split semicolon clauses with Record Separator (0x1E)
  -- so pediatric context propagates across adjacent semicolon clauses in a sentence.
  v_marked := regexp_replace(trim(p_text), E'([.!?]+)\\s+', E'\\1\x1F', 'g');
  v_marked := regexp_replace(v_marked, E'\\n+', E'\x1F', 'g');
  sentences := string_to_array(v_marked, E'\x1F');

  FOREACH v_sentence IN ARRAY sentences LOOP
    v_sentence := trim(v_sentence);
    IF v_sentence = '' THEN
      CONTINUE;
    END IF;

    v_term_punct := substring(v_sentence FROM '([.!?]+)$');
    clauses := string_to_array(regexp_replace(v_sentence, E'\\s*;\\s*', E'\x1E', 'g'), E'\x1E');
    sentence_has_ped_ctx := false;
    kept_clauses := ARRAY[]::TEXT[];

    FOREACH part IN ARRAY clauses LOOP
      part := trim(part);
      IF part = '' THEN
        CONTINUE;
      END IF;

      has_ped := part ~* '(\y(?:infant|infants|newborn|newborns|neonate|neonates|toddler|toddlers|child|children|kid|kids|minors|adolescent|adolescents|teen|teens|teenager|teenagers|pediatric|paediatric|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18(?:\s*(?:years?|yrs?))?|b[eé]b[eé]s?|enfant|enfants|nourrisson|nourrissons|nouveau-n[eé]s?|mineur|mineurs|ado|ados|adolescente?s?|p[eé]diatrique|moins\s+de\s+18(?:\s*ans?)?)\y|\yminor\y(?!\s+(?:side\s+effects?|adverse|gastrointestinal|gi|stomach|digestive|skin|oral|throat|mouth|urinary|muscular|articular|sprains?|bruises?|ulcers?|bleeding|headaches?|nausea|upset|irritation|inflammation|symptoms?|complaints?|reactions?|interactions?|discomfort)\y)|\y(?:up\s+to\s+(?:age\s+)?18|jusqu[''’][aà]\s+18(?:\s*ans?)?)\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\y)|\y18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\y|\y18\s*ans?\s+et\s+moins\y|(?:<=|≤)\s*18\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\y)|\y(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\y|<\s*18\s*(?:years?|yrs?|ans?)\y|\y(?:ages?|aged|de|entre)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\y|\y(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?|\)|:)|\y(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)\s*(?:-?\s*old|of age|:|\s*(?:and\s+(?:older|younger|under)|or\s+(?:older|younger)|et\s+plus|et\s+moins))?|\y\d{1,2}\s*-?\s*(?:months?|mos?|weeks?|wks?|mois|semaines?)\s*(?:-?\s*old|of age|:)?)';
      has_adult := part ~* '(\y(?:adult|adults|adulte|adultes)\y|\y18\+|\y18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\y|\y18\s*(?:years?|yrs?|ans?)\s*\+|\y18\s+ans\s+et\s+plus\y|\y(?:over|above)\s+(?:age\s+)?18\y|\y(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\y|(?:>=|≥)\s*18\y)';
      has_numeric_dose := part ~* '\y\d+(?:[.,]\d+)?\s*(mg|mcg|ug|g|ml|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|g[eé]lules?|comprim[eé]s?|tasses?)\y';
      has_dose := has_numeric_dose OR part ~* '\y(dose|dosage|dosing|posologie|administer|take|give|donner|donnez|administrez|prenez|prendre)\y';
      has_negation := part ~* '\y(never|do\s+not|don''t|should\s+not|shouldn''t|must\s+not|mustn''t|not\s+for\s+use|not\s+suitable|avoid|contraindicated|contre-indiqu[eé]e?s?|not\s+recommended|non\s+recommand[eé]e?s?|ne\s+pas|ne\s+jamais|ne\s+doiv(?:ent|e)\s+pas|ne\s+devrai(?:t|ent)\s+pas|ne\s+convien(?:t|nent)\s+pas|d[eé]conseill[eé]e?s?|interdit)\y';
      is_warning := part ~* '\y(poison|poisoning|overdose|fatal|lethal|death|die|emergency|hospital|call\s*911|poison\s+control|centre\s+antipoison|liver\s+failure|kidney\s+failure|toxicity|toxic|harm|hazard|swallow|swallowed|ingest|ingested|avale|aval[eé]|intoxication|mortel|urgence|ne\s+pas\s+(?:donner|utiliser|prendre|administrer)|ne\s+jamais\s+(?:donner|utiliser|prendre|administrer)|ne\s+doiv(?:ent|e)\s+pas|ne\s+devrai(?:t|ent)\s+pas|ne\s+convien(?:t|nent)\s+pas|never\s+(?:give|use|take|administer)|do\s+not\s+(?:give|use|take|administer)|should\s+not|shouldn''t|must\s+not|mustn''t|not\s+for\s+use|not\s+suitable|avoid\s+in|contraindicated|contre-indiqu[eé]e?s?|not\s+recommended|non\s+recommand[eé]e?s?|d[eé]conseill[eé]e?s?|interdit|keep\s+out\s+of\s+reach|hors\s+de\s+port[eé]e)\y';

      IF has_ped AND NOT has_adult THEN
        sentence_has_ped_ctx := true;
      ELSIF has_adult AND NOT has_ped THEN
        sentence_has_ped_ctx := false;
      END IF;

      effective_has_ped := has_ped OR sentence_has_ped_ctx;

      has_affirmative_prescriptive_ped_dose :=
        effective_has_ped
        AND NOT has_adult
        AND has_numeric_dose
        AND NOT has_negation
        AND (
          part ~* '\y(give|administer|take|recommend|prescribe|suggested?|donnez|donner|administrez|prenez)\y'
          OR part ~* '\y(for|in|pour|chez)\s+(a|an|the|your|un|une|les?)?\s*(infant|infants|newborn|newborns|toddler|toddlers|child|children|kid|kids|minor|minors|adolescent|adolescents|teen|teens|teenager|teenagers|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|moins\s+de\s+18(?:\s*ans?)?|jusqu[''’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins|b[eé]b[eé]s?|enfant|enfants|nourrisson|adolescente?s?|(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?|ans?))?|\d+\s*-?\s*(years?|yrs?|ans?|months?|mos?|mois)\s*(old)?)\y'
          OR part ~* '(\y(?:children|child|enfant|enfants|adolescents?|infants?|toddlers?|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|moins\s+de\s+18(?:\s*ans?)?|jusqu[''’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins)\y|(?:<=|≤)\s*18\y|\y(?:ages?\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?|ans?))?)[^:]{0,30}:\s*[^.!?;]*\d+'
          OR (sentence_has_ped_ctx AND NOT is_warning)
        );

      IF has_affirmative_prescriptive_ped_dose THEN
        CONTINUE;
      END IF;

      IF is_warning THEN
        kept_clauses := array_append(kept_clauses, part);
        CONTINUE;
      END IF;

      IF NOT effective_has_ped THEN
        kept_clauses := array_append(kept_clauses, part);
        CONTINUE;
      END IF;

      IF has_adult THEN
        cleaned := part;
        -- Strip adult-first pediatric conjunct ("and adolescents over 12 years", "and adolescents 12 years and older", "et adolescents de 12 à 17 ans")
        cleaned := regexp_replace(
          cleaned,
          '\y(?:and|et|or|ou)\s+(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?',
          '',
          'gi'
        );
        -- Strip pediatric-first conjunct ("adolescents de 12 à 17 ans et les adultes" -> "les adultes")
        cleaned := regexp_replace(
          cleaned,
          '\y(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?\s+(?:and|et)\s+(les\s+)?(adults?|adultes?)',
          '\1\2',
          'gi'
        );
        cleaned := regexp_replace(cleaned, '\y(les)\s+\1\y', '\1', 'gi');
        -- Clean punctuation spacing left by inline removal
        cleaned := regexp_replace(cleaned, '\s+([:;,.?)])', '\1', 'g');
        cleaned := regexp_replace(cleaned, '\(\s+', '(', 'g');
        cleaned := trim(regexp_replace(cleaned, '\s{2,}', ' ', 'g'));
        cleaned_has_under18 := cleaned ~* '(\y(?:under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18(?:\s*(?:years?|yrs?))?|moins\s+de\s+18(?:\s*ans?)?)\y|\y(?:up\s+to\s+(?:age\s+)?18|jusqu[''’][aà]\s+18(?:\s*ans?)?)\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\y)|\y18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\y|\y18\s*ans?\s+et\s+moins\y|(?:<=|≤)\s*18\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\y)|\y(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\y|<\s*18\s*(?:years?|yrs?|ans?)\y|\y(?:ages?|aged|de|entre)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\y|\y(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?|\)|:)|\y(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)\s*(?:-?\s*old|of age|:|\s*(?:and\s+(?:older|younger|under)|or\s+(?:older|younger)|et\s+plus|et\s+moins))|\y\d{1,2}\s*-?\s*(?:months?|mos?|weeks?|wks?|mois|semaines?)\s*(?:-?\s*old|of age|:))';
        has_explicit_adult_age := cleaned ~* '(\y18\+|\y18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\y|\y18\s*(?:years?|yrs?|ans?)\s*\+|\y18\s+ans\s+et\s+plus\y|\y(?:over|above)\s+(?:age\s+)?18\y|\y(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\y|(?:>=|≥)\s*18\y)';
        IF cleaned <> '' AND (NOT cleaned_has_under18 OR has_explicit_adult_age) THEN
          kept_clauses := array_append(kept_clauses, cleaned);
        END IF;
      ELSIF NOT has_dose THEN
        kept_clauses := array_append(kept_clauses, part);
      END IF;
    END LOOP;

    IF array_length(kept_clauses, 1) IS NOT NULL THEN
      v_sentence_out := trim(array_to_string(kept_clauses, '; '));
      v_sentence_out := regexp_replace(v_sentence_out, ';+$', '', 'g');
      IF v_term_punct IS NOT NULL AND v_sentence_out !~ '[.!?]$' THEN
        v_sentence_out := v_sentence_out || v_term_punct;
      END IF;
      IF v_sentence_out <> '' THEN
        kept := array_append(kept, v_sentence_out);
      END IF;
    END IF;
  END LOOP;

  IF array_length(kept, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  v_joined := trim(array_to_string(kept, ' '));
  v_joined := regexp_replace(v_joined, ';\s*$', '.', 'g');
  RETURN NULLIF(trim(v_joined), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_text_array(p_arr TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item TEXT;
  v_clean TEXT;
  v_out TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_arr IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH v_item IN ARRAY p_arr LOOP
    v_clean := public.strip_pediatric_dosage_text(v_item);
    IF v_clean IS NOT NULL AND v_clean <> '' THEN
      v_out := array_append(v_out, v_clean);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_text_array_jsonb(p_arr JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_out JSONB := '[]'::jsonb;
  v_txt TEXT;
  v_k TEXT;
BEGIN
  IF p_arr IS NULL OR jsonb_typeof(p_arr) <> 'array' THEN
    RETURN COALESCE(p_arr, '[]'::jsonb);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_arr) LOOP
    IF jsonb_typeof(v_item) = 'string' THEN
      v_txt := public.strip_pediatric_dosage_text(v_item #>> '{}');
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        v_out := v_out || jsonb_build_array(to_jsonb(v_txt));
      END IF;
    ELSIF jsonb_typeof(v_item) = 'object' THEN
      FOREACH v_k IN ARRAY ARRAY[
        'text', 'claim', 'description', 'note', 'dose', 'safety', 'risk',
        'purpose', 'indication', 'value', 'detail', 'details', 'interaction',
        'mechanism', 'management', 'recommendation', 'finding', 'summary', 'condition'
      ] LOOP
        IF (v_item ? v_k) AND jsonb_typeof(v_item->v_k) = 'string' THEN
          v_txt := public.strip_pediatric_dosage_text(v_item->>v_k);
          v_item := jsonb_set(v_item, ARRAY[v_k], to_jsonb(COALESCE(v_txt, '')), true);
        END IF;
      END LOOP;
      v_out := v_out || jsonb_build_array(v_item);
    ELSE
      v_out := v_out || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_public_herb_jsonb(p_herb JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out JSONB;
  v_fr JSONB;
  v_fr_adult TEXT;
  v_fr_prep TEXT;
  v_fr_desc TEXT;
BEGIN
  IF p_herb IS NULL THEN
    RETURN NULL;
  END IF;

  v_out := p_herb || jsonb_build_object(
    'dosage_child', NULL,
    'dosage_adult', public.strip_pediatric_dosage_text(p_herb->>'dosage_adult'),
    'preparation_notes', public.strip_pediatric_dosage_text(p_herb->>'preparation_notes'),
    'description', public.strip_pediatric_dosage_text(p_herb->>'description')
  );

  IF jsonb_typeof(v_out->'traditional_uses') = 'array' THEN
    v_out := jsonb_set(v_out, '{traditional_uses}', public.redact_text_array_jsonb(v_out->'traditional_uses'), true);
  END IF;
  IF jsonb_typeof(v_out->'modern_uses') = 'array' THEN
    v_out := jsonb_set(v_out, '{modern_uses}', public.redact_text_array_jsonb(v_out->'modern_uses'), true);
  END IF;
  IF jsonb_typeof(v_out->'contraindications') = 'array' THEN
    v_out := jsonb_set(v_out, '{contraindications}', public.redact_text_array_jsonb(v_out->'contraindications'), true);
  END IF;
  IF jsonb_typeof(v_out->'side_effects') = 'array' THEN
    v_out := jsonb_set(v_out, '{side_effects}', public.redact_text_array_jsonb(v_out->'side_effects'), true);
  END IF;

  IF jsonb_typeof(v_out->'translations'->'fr') = 'object' THEN
    v_fr := (v_out->'translations'->'fr') - 'dosage_child';
    IF v_fr ? 'dosage_adult' THEN
      v_fr_adult := public.strip_pediatric_dosage_text(v_fr->>'dosage_adult');
      v_fr := jsonb_set(v_fr, '{dosage_adult}', COALESCE(to_jsonb(v_fr_adult), 'null'::jsonb), true);
    END IF;
    IF v_fr ? 'preparation_notes' THEN
      v_fr_prep := public.strip_pediatric_dosage_text(v_fr->>'preparation_notes');
      v_fr := jsonb_set(v_fr, '{preparation_notes}', COALESCE(to_jsonb(v_fr_prep), 'null'::jsonb), true);
    END IF;
    IF v_fr ? 'description' THEN
      v_fr_desc := public.strip_pediatric_dosage_text(v_fr->>'description');
      v_fr := jsonb_set(v_fr, '{description}', COALESCE(to_jsonb(v_fr_desc), 'null'::jsonb), true);
    END IF;
    IF jsonb_typeof(v_fr->'traditional_uses') = 'array' THEN
      v_fr := jsonb_set(v_fr, '{traditional_uses}', public.redact_text_array_jsonb(v_fr->'traditional_uses'), true);
    END IF;
    IF jsonb_typeof(v_fr->'modern_uses') = 'array' THEN
      v_fr := jsonb_set(v_fr, '{modern_uses}', public.redact_text_array_jsonb(v_fr->'modern_uses'), true);
    END IF;
    IF jsonb_typeof(v_fr->'contraindications') = 'array' THEN
      v_fr := jsonb_set(v_fr, '{contraindications}', public.redact_text_array_jsonb(v_fr->'contraindications'), true);
    END IF;
    IF jsonb_typeof(v_fr->'side_effects') = 'array' THEN
      v_fr := jsonb_set(v_fr, '{side_effects}', public.redact_text_array_jsonb(v_fr->'side_effects'), true);
    END IF;
    v_out := jsonb_set(v_out, '{translations,fr}', v_fr, true);
  END IF;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_herb_translations_jsonb(p_translations JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fr JSONB;
BEGIN
  IF p_translations IS NULL OR jsonb_typeof(p_translations->'fr') <> 'object' THEN
    RETURN p_translations;
  END IF;

  v_fr := (p_translations->'fr') - 'dosage_child';
  IF v_fr ? 'dosage_adult' THEN
    v_fr := jsonb_set(v_fr, '{dosage_adult}', COALESCE(to_jsonb(public.strip_pediatric_dosage_text(v_fr->>'dosage_adult')), 'null'::jsonb), true);
  END IF;
  IF v_fr ? 'preparation_notes' THEN
    v_fr := jsonb_set(v_fr, '{preparation_notes}', COALESCE(to_jsonb(public.strip_pediatric_dosage_text(v_fr->>'preparation_notes')), 'null'::jsonb), true);
  END IF;
  IF v_fr ? 'description' THEN
    v_fr := jsonb_set(v_fr, '{description}', COALESCE(to_jsonb(public.strip_pediatric_dosage_text(v_fr->>'description')), 'null'::jsonb), true);
  END IF;
  IF jsonb_typeof(v_fr->'traditional_uses') = 'array' THEN
    v_fr := jsonb_set(v_fr, '{traditional_uses}', public.redact_text_array_jsonb(v_fr->'traditional_uses'), true);
  END IF;
  IF jsonb_typeof(v_fr->'modern_uses') = 'array' THEN
    v_fr := jsonb_set(v_fr, '{modern_uses}', public.redact_text_array_jsonb(v_fr->'modern_uses'), true);
  END IF;
  IF jsonb_typeof(v_fr->'contraindications') = 'array' THEN
    v_fr := jsonb_set(v_fr, '{contraindications}', public.redact_text_array_jsonb(v_fr->'contraindications'), true);
  END IF;
  IF jsonb_typeof(v_fr->'side_effects') = 'array' THEN
    v_fr := jsonb_set(v_fr, '{side_effects}', public.redact_text_array_jsonb(v_fr->'side_effects'), true);
  END IF;

  RETURN jsonb_set(p_translations, '{fr}', v_fr, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.faq_question_has_numeric_pediatric_dose(p_question TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trimmed TEXT;
  v_stripped TEXT;
BEGIN
  IF p_question IS NULL THEN
    RETURN false;
  END IF;
  v_trimmed := trim(p_question);
  IF v_trimmed = '' THEN
    RETURN false;
  END IF;
  IF NOT (v_trimmed ~* '\y\d+(?:[.,]\d+)?\s*(mg|mcg|ug|g|ml|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|g[eé]lules?|comprim[eé]s?|tasses?)\y') THEN
    RETURN false;
  END IF;
  v_stripped := COALESCE(public.strip_pediatric_dosage_text(v_trimmed), '');
  RETURN v_stripped IS DISTINCT FROM v_trimmed;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_faq_question_text(p_question TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trimmed TEXT;
  v_stripped TEXT;
BEGIN
  IF p_question IS NULL THEN
    RETURN NULL;
  END IF;
  v_trimmed := trim(p_question);
  IF v_trimmed = '' THEN
    RETURN '';
  END IF;
  v_stripped := public.strip_pediatric_dosage_text(v_trimmed);
  IF NOT (v_trimmed ~* '\y\d+(?:[.,]\d+)?\s*(mg|mcg|ug|g|ml|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|g[eé]lules?|comprim[eé]s?|tasses?)\y') THEN
    RETURN COALESCE(NULLIF(v_stripped, ''), v_trimmed);
  END IF;
  RETURN COALESCE(v_stripped, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_faq_translations_jsonb(p_translations JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fr JSONB;
  v_raw_q TEXT;
  v_q TEXT;
  v_ans TEXT;
BEGIN
  IF p_translations IS NULL OR jsonb_typeof(p_translations->'fr') <> 'object' THEN
    RETURN p_translations;
  END IF;

  v_fr := p_translations->'fr';
  v_raw_q := v_fr->>'question';
  v_q := CASE
    WHEN v_fr ? 'question' THEN COALESCE(public.sanitize_faq_question_text(v_raw_q), '')
    ELSE ''
  END;
  v_ans := CASE
    WHEN v_fr ? 'answer' THEN COALESCE(public.strip_pediatric_dosage_text(v_fr->>'answer'), '')
    ELSE ''
  END;

  IF v_ans = '' THEN
    v_q := '';
  ELSIF v_q = '' THEN
    v_q := 'Information de sécurité';
  END IF;

  IF v_fr ? 'question' OR v_q <> '' THEN
    v_fr := jsonb_set(v_fr, '{question}', to_jsonb(v_q), true);
  END IF;
  IF v_fr ? 'answer' THEN
    v_fr := jsonb_set(v_fr, '{answer}', to_jsonb(v_ans), true);
  END IF;

  RETURN jsonb_set(p_translations, '{fr}', v_fr, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_herb_faqs_jsonb(p_faqs JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_out JSONB := '[]'::jsonb;
  v_raw_q TEXT;
  v_q TEXT;
  v_ans TEXT;
  v_trans JSONB;
  v_fr_ans TEXT;
BEGIN
  IF p_faqs IS NULL OR jsonb_typeof(p_faqs) <> 'array' THEN
    RETURN COALESCE(p_faqs, '[]'::jsonb);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_faqs) LOOP
    IF jsonb_typeof(v_item) = 'object' THEN
      v_raw_q := v_item->>'question';
      IF v_item ? 'question' THEN
        v_q := COALESCE(public.sanitize_faq_question_text(v_raw_q), '');
      ELSE
        v_q := '';
      END IF;
      IF v_item ? 'answer' THEN
        v_ans := COALESCE(public.strip_pediatric_dosage_text(v_item->>'answer'), '');
      ELSE
        v_ans := '';
      END IF;
      IF jsonb_typeof(v_item->'translations') = 'object' THEN
        v_trans := public.redact_faq_translations_jsonb(v_item->'translations');
        v_fr_ans := CASE
          WHEN jsonb_typeof(v_trans->'fr') = 'object' THEN COALESCE(v_trans->'fr'->>'answer', '')
          ELSE ''
        END;
      ELSE
        v_trans := NULL;
        v_fr_ans := '';
      END IF;
      IF v_ans = '' AND v_fr_ans = '' THEN
        CONTINUE;
      END IF;
      IF v_ans = '' OR v_q = '' THEN
        v_q := 'Safety information';
      END IF;
      v_item := jsonb_set(v_item, '{question}', to_jsonb(v_q), true);
      v_item := jsonb_set(v_item, '{answer}', to_jsonb(v_ans), true);
      IF v_trans IS NOT NULL THEN
        v_item := jsonb_set(v_item, '{translations}', v_trans, true);
      END IF;
    END IF;
    v_out := v_out || jsonb_build_array(v_item);
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_herb_monograph_jsonb(p_monograph JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out JSONB := p_monograph;
BEGIN
  IF p_monograph IS NULL OR jsonb_typeof(p_monograph) <> 'object' THEN
    RETURN p_monograph;
  END IF;

  IF v_out ? 'summary' THEN
    v_out := jsonb_set(v_out, '{summary}', to_jsonb(COALESCE(public.strip_pediatric_dosage_text(v_out->>'summary'), '')), true);
  END IF;
  IF v_out ? 'mechanism' THEN
    v_out := jsonb_set(v_out, '{mechanism}', to_jsonb(COALESCE(public.strip_pediatric_dosage_text(v_out->>'mechanism'), '')), true);
  END IF;
  IF jsonb_typeof(v_out->'safety_notes') = 'array' THEN
    v_out := jsonb_set(v_out, '{safety_notes}', public.redact_text_array_jsonb(v_out->'safety_notes'), true);
  END IF;
  IF jsonb_typeof(v_out->'safetyNotes') = 'array' THEN
    v_out := jsonb_set(v_out, '{safetyNotes}', public.redact_text_array_jsonb(v_out->'safetyNotes'), true);
  END IF;
  IF jsonb_typeof(v_out->'claims') = 'array' THEN
    v_out := jsonb_set(v_out, '{claims}', public.redact_text_array_jsonb(v_out->'claims'), true);
  END IF;
  IF jsonb_typeof(v_out->'drug_interactions') = 'array' THEN
    v_out := jsonb_set(v_out, '{drug_interactions}', public.redact_text_array_jsonb(v_out->'drug_interactions'), true);
  END IF;
  IF jsonb_typeof(v_out->'drugInteractions') = 'array' THEN
    v_out := jsonb_set(v_out, '{drugInteractions}', public.redact_text_array_jsonb(v_out->'drugInteractions'), true);
  END IF;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_pubmed_sheet_object_jsonb(p_obj JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
  v_out JSONB;
  v_k TEXT;
  v_norm_k TEXT;
  v_val JSONB;
  v_elem JSONB;
  v_txt TEXT;
  v_arr JSONB;
BEGIN
  IF p_obj IS NULL THEN
    RETURN NULL;
  END IF;

  v_type := jsonb_typeof(p_obj);
  IF v_type = 'string' THEN
    v_txt := public.strip_pediatric_dosage_text(p_obj #>> '{}');
    IF v_txt IS NULL OR v_txt = '' THEN
      RETURN NULL;
    END IF;
    RETURN to_jsonb(v_txt);
  ELSIF v_type = 'array' THEN
    v_out := '[]'::jsonb;
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_obj) LOOP
      v_elem := public.redact_pubmed_sheet_object_jsonb(v_elem);
      IF v_elem IS NOT NULL THEN
        v_out := v_out || jsonb_build_array(v_elem);
      END IF;
    END LOOP;
    RETURN v_out;
  ELSIF v_type <> 'object' THEN
    RETURN p_obj;
  END IF;

  v_out := '{}'::jsonb;
  FOR v_k, v_val IN SELECT key, value FROM jsonb_each(p_obj) LOOP
    v_norm_k := lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(v_k, '([A-Z]+)([A-Z][a-z])', '\1 \2', 'g'),
          '([a-z0-9])([A-Z])',
          '\1 \2',
          'g'
        ),
        '[_-]+',
        ' ',
        'g'
      )
    );
    IF (
      v_norm_k ~* '\y(pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(ren|hood)?|infants?|minors?|enfants?|nourrissons?)\y'
      AND v_norm_k ~* '\y(doses?|dosages?|dosing|uses?|usage|administration|posolog(y|ie)?)\y'
    ) OR v_k ~* '^(?:(?:pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(?:ren)?|infants?|minors?|enfants?|nourrissons?)(?:doses?|dosages?|dosing|uses?|usage|administration|posolog(?:y|ie)?)|(?:doses?|dosages?|dosing|uses?|usage|administration|posolog(?:y|ie)?)(?:in|for|of|to)?(?:pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(?:ren)?|infants?|minors?|enfants?|nourrissons?))$' THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_val) = 'string' THEN
      v_txt := public.strip_pediatric_dosage_text(v_val #>> '{}');
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        v_out := v_out || jsonb_build_object(v_k, to_jsonb(v_txt));
      END IF;
    ELSIF jsonb_typeof(v_val) = 'array' THEN
      IF v_k ~* '^(dosage_?and_?administration|dosage|dose|doses|dosing|recommended_?dosage|adult_?dosage|administration|posology|posologie)$' THEN
        v_arr := public.filter_public_doses_jsonb(v_val);
        v_out := v_out || jsonb_build_object(v_k, public.redact_pubmed_sheet_object_jsonb(v_arr));
      ELSE
        v_out := v_out || jsonb_build_object(v_k, public.redact_pubmed_sheet_object_jsonb(v_val));
      END IF;
    ELSIF jsonb_typeof(v_val) = 'object' THEN
      v_out := v_out || jsonb_build_object(v_k, public.redact_pubmed_sheet_object_jsonb(v_val));
    ELSE
      v_out := v_out || jsonb_build_object(v_k, v_val);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_pubmed_content_jsonb(p_content JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object' THEN
    RETURN p_content;
  END IF;

  RETURN public.redact_pubmed_sheet_object_jsonb(p_content);
END;
$$;

-- Sanitized public views (security_invoker = false so they continue serving
-- published, pediatric-stripped rows after contract 00104 revokes raw columns).
CREATE OR REPLACE VIEW public.herbs_public AS
SELECT
  h.id,
  h.name,
  h.slug,
  h.scientific_name,
  h.common_names,
  public.strip_pediatric_dosage_text(h.description) AS description,
  h.active_compounds,
  public.redact_text_array(h.traditional_uses) AS traditional_uses,
  public.redact_text_array(h.modern_uses) AS modern_uses,
  public.strip_pediatric_dosage_text(h.dosage_adult) AS dosage_adult,
  NULL::text AS dosage_child,
  h.dosage_forms,
  public.strip_pediatric_dosage_text(h.preparation_notes) AS preparation_notes,
  public.redact_text_array(h.contraindications) AS contraindications,
  public.redact_text_array(h.side_effects) AS side_effects,
  h.pregnancy_safe,
  h.nursing_safe,
  h.pregnancy_safe_oral,
  h.pregnancy_safe_topical,
  h.nursing_safe_oral,
  h.nursing_safe_topical,
  h.category_id,
  h.image_url,
  h.pubchem_cid,
  h.is_published,
  h.evidence_level,
  h.citations,
  h.reviewed_by,
  h.reviewer_credentials,
  h.last_reviewed,
  h.symptom_keywords,
  h.provenance,
  h.view_count,
  h.name_fr,
  public.redact_herb_translations_jsonb(h.translations) AS translations,
  h.created_at,
  h.updated_at
FROM public.herbs h
WHERE h.is_published = true;

GRANT SELECT ON public.herbs_public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_pediatric_only_dose_jsonb(p_dose JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pop TEXT;
  v_txt TEXT;
  v_combined TEXT;
  v_cleaned_pop TEXT;
  v_age NUMERIC;
  v_has_adult BOOLEAN;
  v_has_explicit_adult_age BOOLEAN;
  v_has_ped BOOLEAN;
  v_pop_under18 BOOLEAN;
BEGIN
  IF p_dose IS NULL OR jsonb_typeof(p_dose) <> 'object' THEN
    RETURN false;
  END IF;

  v_pop := COALESCE(p_dose->>'population', '');
  v_txt := COALESCE(p_dose->>'text', '');
  v_combined := v_pop || ' ' || v_txt;

  v_has_adult := v_combined ~* '(\y(?:adult|adults|adulte|adultes)\y|\y18\+|\y18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\y|\y18\s*(?:years?|yrs?|ans?)\s*\+|\y18\s+ans\s+et\s+plus\y|\y(?:over|above)\s+(?:age\s+)?18\y|\y(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\y|(?:>=|≥)\s*18\y)';

  IF v_has_adult THEN
    IF trim(v_pop) <> '' THEN
      v_cleaned_pop := regexp_replace(
        v_pop,
        '\y(?:and|et|or|ou)\s+(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?',
        '',
        'gi'
      );
      v_cleaned_pop := regexp_replace(
        v_cleaned_pop,
        '\y(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d[''’]|entre|plus\s+de|moins\s+de|jusqu[''’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?\s+(?:and|et)\s+(les\s+)?(adults?|adultes?)',
        '\1\2',
        'gi'
      );
      v_cleaned_pop := trim(regexp_replace(v_cleaned_pop, '\s{2,}', ' ', 'g'));
      v_pop_under18 := v_cleaned_pop ~* '(\y(?:under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18(?:\s*(?:years?|yrs?))?|moins\s+de\s+18(?:\s*ans?)?)\y|\y(?:up\s+to\s+(?:age\s+)?18|jusqu[''’][aà]\s+18(?:\s*ans?)?)\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\y)|\y18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\y|\y18\s*ans?\s+et\s+moins\y|(?:<=|≤)\s*18\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\y)|\y(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\y|<\s*18\s*(?:years?|yrs?|ans?)\y|\y(?:ages?|aged|de|entre)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\y|\y(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?|\)|:|$)|\y(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)\s*(?:-?\s*old|of age|:|\s*(?:and\s+(?:older|younger|under)|or\s+(?:older|younger)|et\s+plus|et\s+moins))|\y\d{1,2}\s*-?\s*(?:months?|mos?|weeks?|wks?|mois|semaines?)\s*(?:-?\s*old|of age|:))';
      v_has_explicit_adult_age := v_cleaned_pop ~* '(\y18\+|\y18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\y|\y18\s*(?:years?|yrs?|ans?)\s*\+|\y18\s+ans\s+et\s+plus\y|\y(?:over|above)\s+(?:age\s+)?18\y|\y(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\y|(?:>=|≥)\s*18\y)';
      IF v_cleaned_pop <> '' AND v_pop_under18 AND NOT v_has_explicit_adult_age THEN
        RETURN true;
      END IF;
    END IF;
    IF trim(v_txt) <> '' AND COALESCE(public.strip_pediatric_dosage_text(v_txt), '') = '' THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF p_dose ? 'age_minimum' AND jsonb_typeof(p_dose->'age_minimum') = 'number' THEN
    v_age := (p_dose->>'age_minimum')::numeric;
    IF v_age >= 0 AND v_age < 18 THEN
      RETURN true;
    END IF;
  END IF;

  v_has_ped :=
    v_pop ~* '^\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?)?\s*$'
    OR v_combined ~* '(\y(?:infant|infants|newborn|newborns|neonate|neonates|toddler|toddlers|child|children|kid|kids|minors|adolescent|adolescents|teen|teens|teenager|teenagers|pediatric|paediatric|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18(?:\s*(?:years?|yrs?))?|b[eé]b[eé]s?|enfant|enfants|nourrisson|nourrissons|nouveau-n[eé]s?|mineur|mineurs|ado|ados|adolescente?s?|p[eé]diatrique|moins\s+de\s+18(?:\s*ans?)?)\y|\yminor\y(?!\s+(?:side\s+effects?|adverse|gastrointestinal|gi|stomach|digestive|skin|oral|throat|mouth|urinary|muscular|articular|sprains?|bruises?|ulcers?|bleeding|headaches?|nausea|upset|irritation|inflammation|symptoms?|complaints?|reactions?|interactions?|discomfort)\y)|\y(?:up\s+to\s+(?:age\s+)?18|jusqu[''’][aà]\s+18(?:\s*ans?)?)\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\y)|\y18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\y|\y18\s*ans?\s+et\s+moins\y|(?:<=|≤)\s*18\y(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\y)|\y(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\y|<\s*18\s*(?:years?|yrs?|ans?)\y|\y(?:ages?|aged|de|entre)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\y|\y(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?|\)|:)|\y(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)\s*(?:-?\s*old|of age|:|\s*(?:and\s+(?:older|younger|under)|or\s+(?:older|younger)|et\s+plus|et\s+moins))?|\y\d{1,2}\s*-?\s*(?:months?|mos?|weeks?|wks?|mois|semaines?)\s*(?:-?\s*old|of age|:)?)';

  RETURN v_has_ped;
END;
$$;

CREATE OR REPLACE FUNCTION public.filter_public_doses_jsonb(p_doses JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elem JSONB;
  v_text TEXT;
  v_pop TEXT;
  v_out JSONB := '[]'::jsonb;
BEGIN
  IF p_doses IS NULL OR jsonb_typeof(p_doses) <> 'array' THEN
    RETURN COALESCE(p_doses, '[]'::jsonb);
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_doses) LOOP
    IF jsonb_typeof(v_elem) = 'string' THEN
      v_text := public.strip_pediatric_dosage_text(v_elem #>> '{}');
      IF v_text IS NOT NULL AND v_text <> '' THEN
        v_out := v_out || jsonb_build_array(to_jsonb(v_text));
      END IF;
    ELSIF jsonb_typeof(v_elem) = 'object' THEN
      IF NOT public.is_pediatric_only_dose_jsonb(v_elem) THEN
        v_text := public.strip_pediatric_dosage_text(v_elem->>'text');
        v_pop := COALESCE(v_elem->>'population', '');
        IF v_pop ~* '(\y(?:adult|adults|adulte|adultes)\y|\y18\+|\y18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\y|\y18\s+ans\s+et\s+plus\y)'
           AND v_pop ~* '(\y(?:adolescent|adolescents|children|child|enfant|enfants|under[\s-]+(?:age[\s-]+)?18|moins\s+de\s+18)\y|\y(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8]))' THEN
          v_elem := jsonb_set(v_elem, '{population}', to_jsonb('Adults (18+)'::text), true);
        END IF;
        IF v_elem ? 'age_minimum' AND jsonb_typeof(v_elem->'age_minimum') = 'number' AND (v_elem->>'age_minimum')::numeric < 18 THEN
          v_elem := jsonb_set(v_elem, '{age_minimum}', to_jsonb(18), true);
        END IF;
        IF v_text IS NOT NULL AND v_text <> '' THEN
          v_elem := jsonb_set(v_elem, '{text}', to_jsonb(v_text), true);
          v_out := v_out || jsonb_build_array(v_elem);
        ELSIF NOT (v_elem ? 'text') THEN
          v_out := v_out || jsonb_build_array(v_elem);
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE VIEW public.herb_faqs_public AS
SELECT
  f.id,
  f.herb_id,
  CASE
    WHEN COALESCE(public.strip_pediatric_dosage_text(f.answer), '') = ''
      OR COALESCE(public.sanitize_faq_question_text(f.question), '') = ''
      THEN 'Safety information'
    ELSE public.sanitize_faq_question_text(f.question)
  END AS question,
  COALESCE(public.strip_pediatric_dosage_text(f.answer), '') AS answer,
  f.category,
  public.redact_faq_translations_jsonb(f.translations) AS translations,
  f.sort_order
FROM public.herb_faqs f
JOIN public.herbs h ON h.id = f.herb_id
WHERE h.is_published = true
  AND (
    COALESCE(public.strip_pediatric_dosage_text(f.answer), '') <> ''
    OR (
      jsonb_typeof(f.translations->'fr') = 'object'
      AND COALESCE(public.strip_pediatric_dosage_text(f.translations->'fr'->>'answer'), '') <> ''
    )
  );

GRANT SELECT ON public.herb_faqs_public TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.herb_monographs_public AS
SELECT
  m.id,
  m.herb_id,
  m.herb_slug,
  public.strip_pediatric_dosage_text(m.summary) AS summary,
  public.strip_pediatric_dosage_text(m.mechanism) AS mechanism,
  public.redact_text_array_jsonb(m.claims) AS claims,
  public.redact_text_array_jsonb(m.safety_notes) AS safety_notes,
  public.redact_text_array_jsonb(m.drug_interactions) AS drug_interactions,
  m.pregnancy_category,
  m.key_citations,
  m.status,
  m.generation_method,
  m.reviewed_by,
  m.reviewer_credentials,
  m.last_reviewed_at,
  m.provenance,
  m.created_at,
  m.updated_at
FROM public.herb_monographs m
JOIN public.herbs h ON h.id = m.herb_id
WHERE m.status = 'published'
  AND h.is_published = true;

GRANT SELECT ON public.herb_monographs_public TO anon, authenticated, service_role;

-- 00066a keys this table by herb_slug, while hosted projects also carry an id
-- column created outside the migration chain. Ensure it exists before the
-- public view and the 00104 column grants reference it.
ALTER TABLE public.herb_regulatory_evidence
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

CREATE OR REPLACE VIEW public.herb_regulatory_evidence_public AS
SELECT
  r.id,
  r.herb_slug,
  r.source,
  r.source_licence,
  public.redact_text_array_jsonb(r.purposes) AS purposes,
  public.filter_public_doses_jsonb(r.doses) AS doses,
  public.redact_text_array_jsonb(r.risks) AS risks,
  r.products_sampled,
  r.source_urls,
  r.retrieved_at
FROM public.herb_regulatory_evidence r
JOIN public.herbs h ON h.slug = r.herb_slug
WHERE h.is_published = true;

GRANT SELECT ON public.herb_regulatory_evidence_public TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.herb_monograph_sources_public AS
SELECT
  s.id,
  s.herb_slug,
  s.source,
  s.licence,
  s.attribution,
  s.url,
  public.redact_text_array_jsonb(s.claims) AS claims,
  public.redact_text_array_jsonb(s.safety) AS safety,
  public.filter_public_doses_jsonb(s.doses) AS doses,
  s.generation_method,
  s.monograph_date,
  s.retrieved_at
FROM public.herb_monograph_sources s
JOIN public.herbs h ON h.slug = s.herb_slug
WHERE h.is_published = true;

GRANT SELECT ON public.herb_monograph_sources_public TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.herb_pubmed_monographs_public AS
SELECT
  p.id,
  p.slug,
  public.redact_pubmed_content_jsonb(p.content) AS content,
  p.citations,
  p.pmids,
  p.article_count,
  p.model,
  p.status,
  p.last_reviewed,
  p.reviewed_by,
  p.updated_at
FROM public.herb_pubmed_monographs p
JOIN public.herbs h ON h.slug = p.slug
WHERE h.is_published = true
  AND COALESCE(p.status, 'compiled') IN ('compiled', 'reviewed');

GRANT SELECT ON public.herb_pubmed_monographs_public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redact_herb_page_bundle(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out JSONB := p_payload;
  v_sources JSONB := '[]'::jsonb;
  v_src JSONB;
  v_pubmed JSONB;
BEGIN
  IF p_payload IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(v_out->'herb') = 'object' THEN
    v_out := jsonb_set(v_out, '{herb}', public.redact_public_herb_jsonb(v_out->'herb'), true);
  END IF;

  IF jsonb_typeof(v_out->'regulatory') = 'object' THEN
    IF v_out->'regulatory' ? 'doses' THEN
      v_out := jsonb_set(
        v_out,
        '{regulatory,doses}',
        public.filter_public_doses_jsonb(v_out->'regulatory'->'doses'),
        true
      );
    END IF;
    IF jsonb_typeof(v_out->'regulatory'->'purposes') = 'array' THEN
      v_out := jsonb_set(
        v_out,
        '{regulatory,purposes}',
        public.redact_text_array_jsonb(v_out->'regulatory'->'purposes'),
        true
      );
    END IF;
    IF jsonb_typeof(v_out->'regulatory'->'risks') = 'array' THEN
      v_out := jsonb_set(
        v_out,
        '{regulatory,risks}',
        public.redact_text_array_jsonb(v_out->'regulatory'->'risks'),
        true
      );
    END IF;
  END IF;

  IF jsonb_typeof(v_out->'sources') = 'array' THEN
    FOR v_src IN SELECT value FROM jsonb_array_elements(v_out->'sources') LOOP
      IF jsonb_typeof(v_src) = 'object' THEN
        IF v_src ? 'doses' THEN
          v_src := jsonb_set(v_src, '{doses}', public.filter_public_doses_jsonb(v_src->'doses'), true);
        END IF;
        IF jsonb_typeof(v_src->'claims') = 'array' THEN
          v_src := jsonb_set(v_src, '{claims}', public.redact_text_array_jsonb(v_src->'claims'), true);
        END IF;
        IF jsonb_typeof(v_src->'safety') = 'array' THEN
          v_src := jsonb_set(v_src, '{safety}', public.redact_text_array_jsonb(v_src->'safety'), true);
        END IF;
      END IF;
      v_sources := v_sources || jsonb_build_array(v_src);
    END LOOP;
    v_out := jsonb_set(v_out, '{sources}', v_sources, true);
  END IF;

  IF jsonb_typeof(v_out->'pubmed') = 'object' THEN
    IF COALESCE(NULLIF(v_out->'pubmed'->>'status', ''), 'compiled') NOT IN ('compiled', 'reviewed') THEN
      v_out := jsonb_set(v_out, '{pubmed}', 'null'::jsonb, true);
    ELSIF jsonb_typeof(v_out->'pubmed'->'content') = 'object' THEN
      v_pubmed := jsonb_set(
        v_out->'pubmed',
        '{content}',
        public.redact_pubmed_content_jsonb(v_out->'pubmed'->'content'),
        true
      );
      v_out := jsonb_set(v_out, '{pubmed}', v_pubmed, true);
    END IF;
  END IF;

  IF jsonb_typeof(v_out->'faqs') = 'array' THEN
    v_out := jsonb_set(v_out, '{faqs}', public.redact_herb_faqs_jsonb(v_out->'faqs'), true);
  END IF;

  IF jsonb_typeof(v_out->'monograph') = 'object' THEN
    v_out := jsonb_set(v_out, '{monograph}', public.redact_herb_monograph_jsonb(v_out->'monograph'), true);
  END IF;

  RETURN v_out;
END;
$$;

-- Update build_herb_page_bundle & herb_page_bundle so DB RPC never returns raw
-- dosage_child or pediatric dosing fields, and scrub existing cached rows.
CREATE OR REPLACE FUNCTION public.build_herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_herb record;
  v_category jsonb;
  v_interactions jsonb;
  v_prev jsonb;
  v_next jsonb;
  v_symptom_peers jsonb;
  v_related jsonb;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_herb
  FROM public.herbs
  WHERE slug = p_slug AND is_published
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_herb.category_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_category
    FROM public.herb_categories c
    WHERE c.id = v_herb.category_id
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(di)), '[]'::jsonb)
  INTO v_interactions
  FROM public.drug_interactions di
  WHERE di.herb_id = v_herb.id;

  SELECT jsonb_build_object('slug', p.slug, 'name', p.name, 'scientific_name', p.scientific_name)
  INTO v_prev
  FROM public.herbs p
  WHERE p.is_published AND p.name < v_herb.name AND p.slug <> p_slug
  ORDER BY p.name DESC
  LIMIT 1;

  SELECT jsonb_build_object('slug', n.slug, 'name', n.name, 'scientific_name', n.scientific_name)
  INTO v_next
  FROM public.herbs n
  WHERE n.is_published AND n.name > v_herb.name AND n.slug <> p_slug
  ORDER BY n.name ASC
  LIMIT 1;

  IF v_herb.symptom_keywords IS NOT NULL AND cardinality(v_herb.symptom_keywords) > 0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
    INTO v_symptom_peers
    FROM (
      SELECT h2.slug, h2.name, h2.scientific_name
      FROM public.herbs h2
      WHERE h2.is_published
        AND h2.slug <> p_slug
        AND h2.symptom_keywords @> v_herb.symptom_keywords[1:least(2, cardinality(v_herb.symptom_keywords))]
      LIMIT 6
    ) p;
  ELSE
    v_symptom_peers := '[]'::jsonb;
  END IF;

  IF v_herb.related_slugs IS NOT NULL AND cardinality(v_herb.related_slugs) > 0 THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('name', r.name, 'slug', r.slug, 'scientific_name', r.scientific_name)
        ORDER BY array_position(v_herb.related_slugs, r.slug)
      ),
      '[]'::jsonb
    )
    INTO v_related
    FROM public.herbs r
    WHERE r.is_published AND r.slug = ANY(v_herb.related_slugs);
  END IF;

  IF v_related IS NULL OR jsonb_array_length(v_related) = 0 THEN
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('name', elem->>'name', 'slug', elem->>'slug', 'scientific_name', elem->>'scientific_name')),
      '[]'::jsonb
    )
    INTO v_related
    FROM (
      SELECT elem FROM jsonb_array_elements(v_symptom_peers) AS elem LIMIT 3
    ) sub;
  END IF;

  v_payload := jsonb_build_object(
    'herb', to_jsonb(v_herb) || jsonb_build_object(
      'herb_categories', v_category,
      'drug_interactions', v_interactions
    ),
    'regulatory', (
      SELECT to_jsonb(r)
      FROM public.herb_regulatory_evidence r
      WHERE r.herb_slug = p_slug
      LIMIT 1
    ),
    'monograph', (
      SELECT to_jsonb(m)
      FROM public.herb_monographs m
      WHERE m.herb_slug = p_slug AND m.status = 'published'
      LIMIT 1
    ),
    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'source', s.source,
        'licence', s.licence,
        'attribution', s.attribution,
        'url', s.url,
        'claims', s.claims,
        'safety', s.safety,
        'doses', s.doses,
        'monograph_date', s.monograph_date
      ) ORDER BY s.source)
      FROM public.herb_monograph_sources s
      WHERE s.herb_slug = p_slug
    ), '[]'::jsonb),
    'pubmed', (
      SELECT to_jsonb(p)
      FROM public.herb_pubmed_monographs p
      WHERE p.slug = p_slug
        AND COALESCE(p.status, 'compiled') IN ('compiled', 'reviewed')
      LIMIT 1
    ),
    'faqs', coalesce((
      SELECT jsonb_agg(to_jsonb(f) ORDER BY f.sort_order)
      FROM (
        SELECT question, answer, category, translations, sort_order
        FROM public.herb_faqs
        WHERE herb_id = v_herb.id
        ORDER BY sort_order
        LIMIT 6
      ) f
    ), '[]'::jsonb),
    'related', coalesce(v_related, '[]'::jsonb),
    'neighbours', jsonb_build_object('prev', v_prev, 'next', v_next),
    'symptom_peers', v_symptom_peers
  );

  RETURN public.redact_herb_page_bundle(v_payload);
END;
$function$;

REVOKE ALL ON FUNCTION public.build_herb_page_bundle(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_herb_page_bundle(text) TO service_role;

CREATE OR REPLACE FUNCTION public.herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_payload jsonb;
  v_id uuid;
  v_name text;
  v_cat_id uuid;
  v_keywords text[];
  v_category jsonb;
  v_interactions jsonb;
  v_prev jsonb;
  v_next jsonb;
  v_symptom_peers jsonb;
  v_related jsonb;
BEGIN
  SELECT b.payload INTO v_payload
  FROM public.herb_page_bundles b
  WHERE b.slug = p_slug;

  IF v_payload IS NULL
     OR EXISTS (SELECT 1 FROM public.herb_bundle_dirty d WHERE d.slug = p_slug) THEN
    v_payload := public.build_herb_page_bundle(p_slug);

    IF v_payload IS NULL THEN
      DELETE FROM public.herb_page_bundles b WHERE b.slug = p_slug;
    ELSE
      INSERT INTO public.herb_page_bundles (slug, payload, built_at)
      VALUES (p_slug, v_payload, now())
      ON CONFLICT (slug) DO UPDATE
        SET payload = excluded.payload,
            built_at = excluded.built_at;
    END IF;

    DELETE FROM public.herb_bundle_dirty d WHERE d.slug = p_slug;
    RETURN v_payload;
  END IF;

  IF NOT (v_payload ? 'neighbours') THEN
    v_id := NULLIF(v_payload->'herb'->>'id', '')::uuid;
    v_name := v_payload->'herb'->>'name';
    v_cat_id := NULLIF(v_payload->'herb'->>'category_id', '')::uuid;

    IF v_cat_id IS NOT NULL THEN
      SELECT to_jsonb(c) INTO v_category
      FROM public.herb_categories c
      WHERE c.id = v_cat_id
      LIMIT 1;
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(di)), '[]'::jsonb)
    INTO v_interactions
    FROM public.drug_interactions di
    WHERE di.herb_id = v_id;

    SELECT jsonb_build_object('slug', p.slug, 'name', p.name, 'scientific_name', p.scientific_name)
    INTO v_prev
    FROM public.herbs p
    WHERE p.is_published AND p.name < v_name AND p.slug <> p_slug
    ORDER BY p.name DESC
    LIMIT 1;

    SELECT jsonb_build_object('slug', n.slug, 'name', n.name, 'scientific_name', n.scientific_name)
    INTO v_next
    FROM public.herbs n
    WHERE n.is_published AND n.name > v_name AND n.slug <> p_slug
    ORDER BY n.name ASC
    LIMIT 1;

    SELECT ARRAY(
      SELECT jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_payload->'herb'->'symptom_keywords') = 'array'
            THEN v_payload->'herb'->'symptom_keywords'
          ELSE '[]'::jsonb
        END
      )
    ) INTO v_keywords;

    IF v_keywords IS NOT NULL AND cardinality(v_keywords) > 0 THEN
      SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      INTO v_symptom_peers
      FROM (
        SELECT h2.slug, h2.name, h2.scientific_name
        FROM public.herbs h2
        WHERE h2.is_published
          AND h2.slug <> p_slug
          AND h2.symptom_keywords @> v_keywords[1:least(2, cardinality(v_keywords))]
        LIMIT 6
      ) p;
    ELSE
      v_symptom_peers := '[]'::jsonb;
    END IF;

    v_related := coalesce(v_payload->'related', '[]'::jsonb);
    IF jsonb_typeof(v_related) <> 'array' OR jsonb_array_length(v_related) = 0 THEN
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('name', elem->>'name', 'slug', elem->>'slug', 'scientific_name', elem->>'scientific_name')),
        '[]'::jsonb
      )
      INTO v_related
      FROM (
        SELECT elem FROM jsonb_array_elements(v_symptom_peers) AS elem LIMIT 3
      ) sub;
    END IF;

    v_payload := jsonb_set(
      v_payload,
      '{herb}',
      (v_payload->'herb') || jsonb_build_object(
        'herb_categories', v_category,
        'drug_interactions', v_interactions
      )
    ) || jsonb_build_object(
      'related', v_related,
      'neighbours', jsonb_build_object('prev', v_prev, 'next', v_next),
      'symptom_peers', v_symptom_peers
    );

    v_payload := public.redact_herb_page_bundle(v_payload);

    UPDATE public.herb_page_bundles
    SET payload = v_payload,
        built_at = now()
    WHERE slug = p_slug;
  END IF;

  RETURN public.redact_herb_page_bundle(v_payload);
END;
$function$;

REVOKE ALL ON FUNCTION public.herb_page_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.herb_page_bundle(text) TO anon, authenticated, service_role;

UPDATE public.herb_page_bundles
SET payload = public.redact_herb_page_bundle(payload),
    built_at = now();

-- Update search_herbs_by_symptom so it never exposes dosage_child or pediatric dosing text.
-- Hosted projects still carry the legacy SETOF herbs signature, which cannot be
-- changed with CREATE OR REPLACE. There are no dependent objects; recreate it
-- with the sanitized table shape.
DROP FUNCTION IF EXISTS public.search_herbs_by_symptom(text);

CREATE OR REPLACE FUNCTION public.search_herbs_by_symptom(search_term text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  scientific_name text,
  common_names text[],
  description text,
  active_compounds text[],
  traditional_uses text[],
  modern_uses text[],
  dosage_adult text,
  dosage_child text,
  dosage_forms text[],
  preparation_notes text,
  contraindications text[],
  side_effects text[],
  pregnancy_safe boolean,
  nursing_safe boolean,
  category_id uuid,
  image_url text,
  pubchem_cid text,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.slug,
    h.scientific_name,
    h.common_names,
    public.strip_pediatric_dosage_text(h.description) AS description,
    h.active_compounds,
    public.redact_text_array(h.traditional_uses) AS traditional_uses,
    public.redact_text_array(h.modern_uses) AS modern_uses,
    public.strip_pediatric_dosage_text(h.dosage_adult) AS dosage_adult,
    NULL::text AS dosage_child,
    h.dosage_forms::text[],
    public.strip_pediatric_dosage_text(h.preparation_notes) AS preparation_notes,
    public.redact_text_array(h.contraindications) AS contraindications,
    public.redact_text_array(h.side_effects) AS side_effects,
    h.pregnancy_safe,
    h.nursing_safe,
    h.category_id,
    h.image_url,
    h.pubchem_cid,
    h.is_published,
    h.created_at,
    h.updated_at
  FROM public.herbs h
  WHERE h.is_published = true
    AND (
      h.name ILIKE '%' || search_term || '%'
      OR h.scientific_name ILIKE '%' || search_term || '%'
      OR h.description ILIKE '%' || search_term || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(h.traditional_uses) t
        WHERE t ILIKE '%' || search_term || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(h.modern_uses) m
        WHERE m ILIKE '%' || search_term || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(h.common_names) c
        WHERE c ILIKE '%' || search_term || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(h.active_compounds) a
        WHERE a ILIKE '%' || search_term || '%'
      )
    )
  ORDER BY
    CASE
      WHEN h.name ILIKE search_term THEN 0
      WHEN h.name ILIKE '%' || search_term || '%' THEN 1
      WHEN h.scientific_name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    h.name;
END;
$$;

REVOKE ALL ON FUNCTION public.search_herbs_by_symptom(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_herbs_by_symptom(text) TO authenticated, anon, service_role;

COMMIT;
