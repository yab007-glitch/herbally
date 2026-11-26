-- 00108_perioperative_and_toxic_safety_reconciliation.sql
-- 1) Replace unqualified blanket perioperative "discontinue 2 weeks before surgery"
--    directives in herbs.contraindications and herbs.preparation_notes (EN + FR)
--    with clinician-coordinated perioperative disclosure language so HerbAlly never
--    issues a raw medication/regimen stoppage order without surgical context.
-- 2) Ensure the high-hazard toxic profile abrus-precatorius leads with an explicit
--    lethal-abrin non-ingestion contraindication (EN + FR) and cannot retain any
--    weakened or benign-sounding leading phrasing.
--
-- PG16-safe: avoids lookbehinds, preserves idempotency, and guards JSONB updates
-- with COALESCE(..., 'null'::jsonb).

BEGIN;

-- 1a) Reconcile herbs.contraindications (TEXT[]) & FR JSONB array
WITH updated_contra AS (
  UPDATE public.herbs
  SET
    contraindications = (
      SELECT ARRAY(
        SELECT CASE
          WHEN elem ~* '(discontinue|stop)[^.]{0,40}\b(1\s*(to|-|–)\s*2|two|2)\s+weeks?\s+(before|prior\s+to)\s+surgery'
          THEN 'Perioperative note: if a scheduled surgery or invasive procedure is planned, disclose use and current dose to your surgeon or anesthesiologist in advance rather than modifying a regimen without guidance.'
          ELSE elem
        END
        FROM unnest(contraindications) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord
      )
    ),
    translations = CASE
      WHEN jsonb_typeof(translations) = 'object'
        AND jsonb_typeof(translations->'fr') = 'object'
        AND jsonb_typeof(translations->'fr'->'contraindications') = 'array'
      THEN jsonb_set(
        translations,
        '{fr,contraindications}',
        COALESCE(
          (
            SELECT jsonb_agg(
              CASE
                WHEN elem ~* '(arr[êe]t|cess|interromp|discontinue|stop)[^.]{0,50}(1\s*(à|-|–)\s*2|deux|2)\s+semaines?\s+avant\s+(une\s+)?chirurgie'
                THEN to_jsonb('Note périopératoire : en cas de chirurgie ou d''intervention invasive planifiée, signalez votre usage et la dose actuelle au chirurgien ou à l''anesthésiste à l''avance plutôt que de modifier un traitement sans avis médical.'::text)
                ELSE to_jsonb(elem::text)
              END
              ORDER BY ord
            )
            FROM jsonb_array_elements_text(translations->'fr'->'contraindications') WITH ORDINALITY AS f(elem, ord)
          ),
          '[]'::jsonb
        ),
        true
      )
      ELSE translations
    END,
    updated_at = now()
  WHERE (
    EXISTS (
      SELECT 1
      FROM unnest(contraindications) AS c
      WHERE c ~* '(discontinue|stop)[^.]{0,40}\b(1\s*(to|-|–)\s*2|two|2)\s+weeks?\s+(before|prior\s+to)\s+surgery'
    )
    OR (
      jsonb_typeof(translations->'fr'->'contraindications') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(translations->'fr'->'contraindications') AS fc
        WHERE fc ~* '(arr[êe]t|cess|interromp|discontinue|stop)[^.]{0,50}(1\s*(à|-|–)\s*2|deux|2)\s+semaines?\s+avant\s+(une\s+)?chirurgie'
      )
    )
  )
  RETURNING id
)
SELECT count(*) FROM updated_contra;

-- 1b) Reconcile herbs.preparation_notes (TEXT) & FR JSONB string
UPDATE public.herbs
SET
  preparation_notes = trim(
    regexp_replace(
      preparation_notes,
      '(Should\s+be\s+discontinued|Discontinue|Stop\s+taking|Stop\s+use)[^.]{0,45}\b(1\s*(to|-|–)\s*2|two|2)\s+weeks?\s+(before|prior\s+to)\s+surgery\.?',
      'Perioperative note: disclose current use and dose to your surgeon or anesthesiologist well before scheduled surgery.',
      'gi'
    )
  ),
  translations = CASE
    WHEN jsonb_typeof(translations) = 'object'
      AND jsonb_typeof(translations->'fr') = 'object'
      AND jsonb_typeof(translations->'fr'->'preparation_notes') = 'string'
      AND (translations->'fr'->>'preparation_notes') ~* '(arr[êe]t|cess|interromp|discontinue|stop)[^.]{0,55}(1\s*(à|-|–)\s*2|deux|2)\s+semaines?\s+avant\s+(une\s+)?chirurgie'
    THEN jsonb_set(
      translations,
      '{fr,preparation_notes}',
      COALESCE(
        to_jsonb(
          NULLIF(
            trim(
              regexp_replace(
                translations->'fr'->>'preparation_notes',
                '(Doit\s+[êe]tre\s+arr[êe]t[ée]?|Arr[êe]te[rz]|Cesse[rz]|Interrompe[rz])[^.]{0,55}(1\s*(à|-|–)\s*2|deux|2)\s+semaines?\s+avant\s+(une\s+)?chirurgie\.?',
                'Note périopératoire : signalez votre usage et la dose actuelle au chirurgien ou à l''anesthésiste avant toute intervention planifiée.',
                'gi'
              )
            ),
            ''
          )
        ),
        'null'::jsonb
      ),
      true
    )
    ELSE translations
  END,
  updated_at = now()
WHERE (
  preparation_notes ~* '(Should\s+be\s+discontinued|Discontinue|Stop\s+taking|Stop\s+use)[^.]{0,45}\b(1\s*(to|-|–)\s*2|two|2)\s+weeks?\s+(before|prior\s+to)\s+surgery'
  OR (
    jsonb_typeof(translations->'fr'->'preparation_notes') = 'string'
    AND (translations->'fr'->>'preparation_notes') ~* '(arr[êe]t|cess|interromp|discontinue|stop)[^.]{0,55}(1\s*(à|-|–)\s*2|deux|2)\s+semaines?\s+avant\s+(une\s+)?chirurgie'
  )
);

-- 2) Enforce lethal-abrin leading contraindication on abrus-precatorius (EN + FR)
UPDATE public.herbs
SET
  contraindications = ARRAY[
    'Poisonous botanical (contains lethal abrin) — do not ingest or use in any population'
  ] || COALESCE(
    (
      SELECT ARRAY(
        SELECT elem
        FROM unnest(contraindications) WITH ORDINALITY AS t(elem, ord)
        WHERE elem <> 'Poisonous botanical (contains lethal abrin) — do not ingest or use in any population'
          AND elem !~* '^(No known|None known|None established|Not established)'
        ORDER BY ord
      )
    ),
    '{}'::text[]
  ),
  translations = CASE
    WHEN jsonb_typeof(translations) = 'object'
      AND jsonb_typeof(translations->'fr') = 'object'
    THEN jsonb_set(
      translations,
      '{fr,contraindications}',
      COALESCE(
        (
          SELECT to_jsonb(
            ARRAY[
              'Plante toxique (contient de l''abrine mortelle) — ne pas ingérer ni utiliser dans quelque population que ce soit'
            ] || COALESCE(
              (
                SELECT ARRAY(
                  SELECT elem
                  FROM jsonb_array_elements_text(
                    CASE
                      WHEN jsonb_typeof(translations->'fr'->'contraindications') = 'array'
                      THEN translations->'fr'->'contraindications'
                      ELSE '[]'::jsonb
                    END
                  ) WITH ORDINALITY AS f(elem, ord)
                  WHERE elem <> 'Plante toxique (contient de l''abrine mortelle) — ne pas ingérer ni utiliser dans quelque population que ce soit'
                    AND elem !~* '^(Aucune connue|Aucune contre-indication connue|Aucune établie)'
                  ORDER BY ord
                )
              ),
              '{}'::text[]
            )
          )
        ),
        'null'::jsonb
      ),
      true
    )
    ELSE translations
  END,
  updated_at = now()
WHERE slug = 'abrus-precatorius'
  AND (
    COALESCE(contraindications[1], '') <> 'Poisonous botanical (contains lethal abrin) — do not ingest or use in any population'
    OR (
      jsonb_typeof(translations->'fr') = 'object'
      AND COALESCE(translations->'fr'->'contraindications'->>0, '') <> 'Plante toxique (contient de l''abrine mortelle) — ne pas ingérer ni utiliser dans quelque population que ce soit'
    )
  );

COMMIT;
