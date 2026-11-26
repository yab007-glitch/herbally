-- 00106_interaction_evidence_note_reconciliation.sql
-- Reconcile contradictory "Grade lowered from moderate to mild" statements in
-- drug_interactions.evidence_note (including Ginger + Warfarin) where the
-- assigned severity remains severe or moderate, so page text never contradicts
-- the severity badge. Preserves human study context accurately without
-- fabricating clinical approval or changing severity without clinician review.

BEGIN;

-- 1) Reconcile Ginger + Warfarin evidence_note (EN & FR translations JSONB)
UPDATE public.drug_interactions di
SET
  evidence_note = 'Jiang et al. (Br J Clin Pharmacol, 2005; 12 healthy male volunteers) found no statistically significant change in warfarin pharmacokinetics or INR at tested single/short-term doses, while explicitly cautioning that findings cannot settle safety across clinical patients, long-term use, or concentrated ginger extracts. Current severity classification remains conservative pending formal clinician review.',
  translations = CASE
    WHEN jsonb_typeof(di.translations) = 'object'
      AND jsonb_typeof(di.translations->'fr') = 'object'
    THEN jsonb_set(
      di.translations,
      '{fr,evidence_note}',
      to_jsonb(
        'Jiang et al. (Br J Clin Pharmacol, 2005 ; 12 volontaires masculins sains) n''ont observé aucun changement significatif de la pharmacocinétique ou de l''INR aux doses testées à court terme, tout en soulignant que ces résultats ne s''appliquent pas automatiquement aux patients sous warfarine, à un usage prolongé ou aux extraits concentrés. La gravité affichée reste prudente en attente de révision clinique.'::text
      ),
      true
    )
    ELSE di.translations
  END
FROM public.herbs h
WHERE di.herb_id = h.id
  AND h.slug = 'ginger'
  AND di.drug_name ILIKE 'Warfarin%'
  AND (
    di.evidence_note IS NULL
    OR di.evidence_note ~* 'grade\s+lowered\s+from'
    OR di.evidence_note NOT ILIKE '%Jiang et al.%'
  );

-- 2) Strip contradictory "Grade lowered from ..." sentences on any other
-- severe/contraindicated/moderate record where the severity classification was
-- not actually lowered (PG16-safe POSIX regex without lookbehinds).
UPDATE public.drug_interactions
SET
  evidence_note = NULLIF(
    trim(
      regexp_replace(
        evidence_note,
        '\s*Grade\s+lowered\s+from\s+[^.]+\.?',
        '',
        'gi'
      )
    ),
    ''
  ),
  translations = CASE
    WHEN jsonb_typeof(translations) = 'object'
      AND jsonb_typeof(translations->'fr') = 'object'
      AND (translations->'fr'->>'evidence_note') ~* '(grade\s+lowered|note\s+abaiss|gravité\s+abaiss|niveau\s+abaiss)'
    THEN jsonb_set(
      translations,
      '{fr,evidence_note}',
      to_jsonb(
        NULLIF(
          trim(
            regexp_replace(
              translations->'fr'->>'evidence_note',
              '\s*(Grade\s+lowered|Note\s+abaiss|Gravité\s+abaiss|Niveau\s+abaiss)[^.]*\.?',
              '',
              'gi'
            )
          ),
          ''
        )
      ),
      true
    )
    ELSE translations
  END
WHERE severity IN ('contraindicated', 'severe', 'moderate')
  AND (
    evidence_note ~* 'grade\s+lowered\s+from'
    OR (
      jsonb_typeof(translations->'fr') = 'object'
      AND (translations->'fr'->>'evidence_note') ~* '(grade\s+lowered|note\s+abaiss|gravité\s+abaiss|niveau\s+abaiss)'
    )
  );

COMMIT;
