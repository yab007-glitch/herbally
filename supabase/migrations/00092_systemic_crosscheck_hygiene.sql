-- Migration 00092: Systemic Cross-Check Hygiene (Batches 1–25 + Toxic Set)
--
-- 1. Sync herb_pubmed_monographs citation counts, remove retracted PMID:36655201
--    (lemon-balm), fix wrong-metadata PMIDs, and relabel 30000xxx LactMed rows.
-- 2. Strip pure botanical taxonomy registries (GBIF/ITIS/NCBI Taxonomy/Wikidata/POWO)
--    from herbs.citations and herb_faqs (uses, safety, dosage; EN + FR).
-- 3. Replace "No specific contraindication is recorded" / "No known contraindications"
--    on dangerous herbs and pregnancy/nursing-unsafe herbs (EN + FR).
-- 4. Clean herb_regulatory_evidence: withhold LNHPD homeopathic doses/claims on
--    DANGEROUS_HERBS, strip TBA/zero/pediatric doses, strip green-tea/iron/foreign-herb
--    pooled risks, and remove wrong-family Asteraceae/Apiaceae allergy boilerplate.
-- 5. Clean confirmed wrong-herb & dangerous 1894-1919 historical blocks in
--    herb_monograph_sources (note: table has no updated_at column).
-- 6. Remove stale fabricated '2026-06-23' last_verified_at on unreviewed herbs.
--
-- NON-NEGOTIABLE: Every modified herb is set to provenance.review_status = 'needs_re_review'
-- (NEVER 'human_reviewed') until Yasser signs off personally.

BEGIN;

-- =====================================================================
-- 0. Reusable temp list of dangerous slugs & touched-slug tracker
-- =====================================================================

CREATE TEMP TABLE IF NOT EXISTS pg_temp.touched_herbs_00092 (
  slug text PRIMARY KEY
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.dangerous_slugs_00092()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'abrus-precatorius', 'aconite-processed', 'acokanthera',
    'aristolochia-clematitis', 'aristolochia-debilis', 'aristolochia-indica',
    'aristolochia-mollissima', 'cipo-mil-homens', 'ma-dou-ling',
    'cao-wu-analgesic', 'chuan-wu-analgesic', 'monkshood', 'yellow-monkshood',
    'lamiaceae-pennyroyal', 'pennyroyal-american', 'atropa-belladonna-herb',
    'digitalis-purpurea-herb', 'digitalis-lanata-herb', 'conium-maculatum-herb',
    'cicuta-virosa', 'nerium-oleander', 'mandragora-officinarum-herb',
    'ricinus-communis', 'strychnos-nux-vomica', 'strychnos-ignatii',
    'taxus-baccata', 'taxus-brevifolia', 'taxus-chinensis',
    'colchicum-autumnale-herb', 'colchicum-speciosum', 'datura-stramonium',
    'datura-metel-herb', 'henbane', 'convallaria-majalis-herb',
    'strophanthus-gratus-herb', 'strophanthus-hispidus', 'veratrum-album-herb',
    'veratrum-viride', 'veratrum-californicum', 'gelsemium-elegans',
    'gelsemium-sempervirens', 'podophyllum-peltatum-herb',
    'podophyllum-hexandrum-herb', 'melanthium-virginicum', 'amaryllis-belladonna',
    'pokeroot', 'sassafras', 'schoenocaulon-officinale', 'secale-cornutum',
    'scilla-maritima', 'senecio-aureus', 'citrullus-colocynthis',
    'papaver-somniferum', 'ignatia-amara', 'duboisia-myoporoides',
    'daphne-mezereum', 'apocynum-cannabinum', 'pheasants-eye',
    'bittersweet-nightshade', 'bryonia-alba', 'calabar-bean',
    'thapsia-garganica', 'wahoo-bark', 'sanguinaria-canadensis-herb',
    'chenopodium-ambrosioides', 'khat', 'cotton-root-bark', 'broom-herb',
    'betel-nut', 'pareira-brava', 'wild-ginger', 'hagenia-abyssinica',
    'asclepias-syriaca', 'piscidia-piscipula', 'artemisia-maritima',
    'cheiranthus-cheiri', 'cephalanthus-occidentalis', 'christmas-rose',
    'jaborandi', 'spigelia', 'tripterygium-wilfordii', 'bitter-almond',
    'cinnamomum-camphora', 'chelidonium-majus', 'kratom', 'blue-cohosh-root',
    'lobelia-inflata', 'tansy', 'rue-herb', 'gaulteria-wintergreen',
    'gobernadora', 'ephedra-sinica', 'germander', 'corynanthe-yohimbe',
    'cinchona', 'cinchona-calisaya', 'prunus-serotina', 'soapwort',
    'annona-muricata', 'ranunculus-bulbosus', 'anagallis-arvensis',
    'acalypha-indica', 'stillingia-root', 'vinca-major', 'wild-indigo-root',
    'lycopodium-clavatum', 'red-poppy-petals', 'veronica-virginica',
    'leptandra-virginica', 'european-mistletoe', 'trailing-arbutus',
    'polygonum-punctatum', 'aletris-farinosa', 'false-unicorn', 'partridge-berry'
  ];
$$;

-- =====================================================================
-- 1. herb_pubmed_monographs: retracted PMID removal, wrong-metadata fixes,
--    30000xxx LactMed relabelling, and article_count sync
-- =====================================================================

-- 1a. Remove retracted PMID:36655201 from lemon-balm (citations, pmids, content)
WITH upd AS (
  UPDATE public.herb_pubmed_monographs
  SET
    citations = COALESCE((
      SELECT jsonb_agg(c ORDER BY ord)
      FROM jsonb_array_elements(citations) WITH ORDINALITY AS t(c, ord)
      WHERE COALESCE(c->>'pmid', '') <> '36655201'
    ), '[]'::jsonb),
    pmids = COALESCE(array_remove(pmids, '36655201'), '{}'::text[]),
    content = (
      WITH cleaned_text AS (
        SELECT regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(content::text, '\[\s*PMID:36655201\s*\]', '', 'g'),
              ',\s*PMID:36655201\b',
              '',
              'g'
            ),
            '\bPMID:36655201\s*,\s*',
            '',
            'g'
          ),
          '\bPMID:36655201\b',
          '',
          'g'
        )::jsonb AS doc
      )
      SELECT
        CASE
          WHEN jsonb_typeof(doc->'fr'->'citedPmids') = 'array' THEN
            jsonb_set(
              CASE
                WHEN jsonb_typeof(doc->'citedPmids') = 'array' THEN
                  jsonb_set(doc, '{citedPmids}', COALESCE((
                    SELECT jsonb_agg(x ORDER BY ord)
                    FROM jsonb_array_elements(doc->'citedPmids') WITH ORDINALITY AS p(x, ord)
                    WHERE x #>> '{}' <> '36655201'
                  ), '[]'::jsonb), true)
                ELSE doc
              END,
              '{fr,citedPmids}',
              COALESCE((
                SELECT jsonb_agg(x ORDER BY ord)
                FROM jsonb_array_elements(doc->'fr'->'citedPmids') WITH ORDINALITY AS p(x, ord)
                WHERE x #>> '{}' <> '36655201'
              ), '[]'::jsonb),
              true
            )
          WHEN jsonb_typeof(doc->'citedPmids') = 'array' THEN
            jsonb_set(doc, '{citedPmids}', COALESCE((
              SELECT jsonb_agg(x ORDER BY ord)
              FROM jsonb_array_elements(doc->'citedPmids') WITH ORDINALITY AS p(x, ord)
              WHERE x #>> '{}' <> '36655201'
            ), '[]'::jsonb), true)
          ELSE doc
        END
      FROM cleaned_text
    ),
    updated_at = now()
  WHERE slug = 'lemon-balm'
    AND (
      citations::text LIKE '%36655201%'
      OR '36655201' = ANY(COALESCE(pmids, '{}'::text[]))
      OR content::text LIKE '%36655201%'
    )
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1b. Replace wrong ephedra-sinica PMID 31644021 -> 34307603 (Ballotin et al., 2021)
WITH upd AS (
  UPDATE public.herb_pubmed_monographs
  SET
    citations = COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(c->>'pmid', '') = '31644021' THEN
            jsonb_build_object(
              'pmid', '34307603',
              'title', 'Herb-induced liver injury: systematic review and meta-analysis (Ballotin et al., 2021)',
              'journal', 'World Journal of Clinical Cases',
              'year', 2021,
              'url', 'https://pubmed.ncbi.nlm.nih.gov/34307603/'
            )
          ELSE c
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(citations) WITH ORDINALITY AS t(c, ord)
    ), citations),
    pmids = ARRAY(
      SELECT CASE WHEN p = '31644021' THEN '34307603' ELSE p END
      FROM unnest(COALESCE(pmids, '{}'::text[])) AS p
    ),
    content = replace(content::text, '31644021', '34307603')::jsonb,
    updated_at = now()
  WHERE slug = 'ephedra-sinica'
    AND (citations::text LIKE '%31644021%' OR '31644021' = ANY(COALESCE(pmids, '{}'::text[])))
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1c. Fix specific confirmed wrong-metadata PMIDs in herb_pubmed_monographs.citations
WITH overrides(slug, pmid, new_title, new_journal, new_year, new_url) AS (
  VALUES
    ('lemon-balm', '38381912', 'Lemon Balm — LiverTox Clinical and Research Information (PMID 38381912)', 'LiverTox, NIH/NIDDK Bookshelf', 2024, 'https://pubmed.ncbi.nlm.nih.gov/38381912/'),
    ('cinnamon', '40986675', 'Cinnamon — Drugs and Lactation Database (LactMed) (PMID 40986675)', 'Drugs and Lactation Database (LactMed), NIH/NLM', 2025, 'https://pubmed.ncbi.nlm.nih.gov/40986675/'),
    ('gymnema', '39666848', 'Gymnema — LiverTox Clinical and Research Information (PMID 39666848)', 'LiverTox, NIH/NIDDK Bookshelf', 2024, 'https://pubmed.ncbi.nlm.nih.gov/39666848/'),
    ('arnica', '37011124', 'Arnica — LiverTox Clinical and Research Information (PMID 37011124)', 'LiverTox, NIH/NIDDK Bookshelf', 2023, 'https://pubmed.ncbi.nlm.nih.gov/37011124/'),
    ('goldenseal', '30725649', 'Herbal Supplements — StatPearls Reference Record (PMID 30725649)', 'StatPearls, NCBI Bookshelf (NIH/NLM)', 2024, 'https://pubmed.ncbi.nlm.nih.gov/30725649/'),
    ('butterbur', '30725845', 'Butterbur Reference Record — StatPearls / NCBI Bookshelf (PMID 30725845)', 'StatPearls, NCBI Bookshelf (NIH/NLM)', 2024, 'https://pubmed.ncbi.nlm.nih.gov/30725845/'),
    ('papaver-somniferum', '28722906', 'Heroin — StatPearls Drug Chapter (PMID 28722906; opiate drug reference, not herbal trial evidence)', 'StatPearls, NCBI Bookshelf (NIH/NLM)', 2024, 'https://pubmed.ncbi.nlm.nih.gov/28722906/')
),
upd AS (
  UPDATE public.herb_pubmed_monographs m
  SET
    citations = (
      SELECT jsonb_agg(
        CASE
          WHEN o.pmid IS NOT NULL THEN
            c || jsonb_build_object(
              'title', o.new_title,
              'journal', o.new_journal,
              'year', o.new_year,
              'url', o.new_url
            )
          ELSE c
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(m.citations) WITH ORDINALITY AS t(c, ord)
      LEFT JOIN overrides o ON o.slug = m.slug AND o.pmid = c->>'pmid'
    ),
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM overrides o2
    WHERE o2.slug = m.slug
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(m.citations, '[]'::jsonb)) x
        WHERE x->>'pmid' = o2.pmid
          AND COALESCE(x->>'title', '') IS DISTINCT FROM o2.new_title
      )
  )
  RETURNING m.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1d. Relabel ALL mislabelled 30000xxx LactMed entries across herb_pubmed_monographs
WITH upd AS (
  UPDATE public.herb_pubmed_monographs m
  SET
    citations = (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(c->>'pmid', '') ~ '^30000[0-9]{3}$'
           AND COALESCE(c->>'journal', '') NOT ILIKE '%LactMed%'
          THEN c || jsonb_build_object(
            'journal', 'Drugs and Lactation Database (LactMed), NIH/NLM',
            'title', 'LactMed Record (PMID ' || (c->>'pmid') || ')',
            'url', COALESCE(NULLIF(c->>'url', ''), 'https://pubmed.ncbi.nlm.nih.gov/' || (c->>'pmid') || '/')
          )
          ELSE c
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(m.citations) WITH ORDINALITY AS t(c, ord)
    ),
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(m.citations, '[]'::jsonb)) c
    WHERE COALESCE(c->>'pmid', '') ~ '^30000[0-9]{3}$'
      AND COALESCE(c->>'journal', '') NOT ILIKE '%LactMed%'
  )
  RETURNING m.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1e. Sync article_count to actual citations array length across all sheets
WITH upd AS (
  UPDATE public.herb_pubmed_monographs
  SET
    article_count = COALESCE(jsonb_array_length(citations), 0),
    updated_at = now()
  WHERE article_count IS DISTINCT FROM COALESCE(jsonb_array_length(citations), 0)
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. Strip pure taxonomy registries from herbs.citations & herb_faqs
--    (category IN ('dosage', 'uses', 'safety'); EN + FR)
-- =====================================================================

WITH upd AS (
  UPDATE public.herbs h
  SET
    citations = COALESCE((
      SELECT jsonb_agg(c ORDER BY ord)
      FROM jsonb_array_elements(h.citations) WITH ORDINALITY AS t(c, ord)
      WHERE COALESCE(c->>'source', '') !~* '^(GBIF|ITIS|NCBI Taxonomy|NCBI|Wikidata|POWO|Kew POWO.*|Plants of the World Online|Catalogue of Life|Encyclopedia of Life|USDA PLANTS)$'
        AND COALESCE(c->>'title', '') !~* '^(GBIF|ITIS|NCBI Taxonomy|Wikidata)\b'
    ), '[]'::jsonb),
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(h.citations, '[]'::jsonb)) c
    WHERE COALESCE(c->>'source', '') ~* '^(GBIF|ITIS|NCBI Taxonomy|NCBI|Wikidata|POWO|Kew POWO.*|Plants of the World Online|Catalogue of Life|Encyclopedia of Life|USDA PLANTS)$'
       OR COALESCE(c->>'title', '') ~* '^(GBIF|ITIS|NCBI Taxonomy|Wikidata)\b'
  )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.clean_taxonomy_attr_00092(p_text text, p_is_fr boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_m text[];
  v_prefix text;
  v_inner text;
  v_lead text := '';
  v_parts text[];
  v_kept text[] := '{}';
  v_item text;
  v_joiner text;
BEGIN
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RETURN p_text;
  END IF;

  -- Match trailing parenthetical citation block: "... (Source1; GBIF; ITIS.)" or "(Recorded from Source1; GBIF.)"
  v_m := regexp_match(p_text, '^(.*)\s+\(([^()]+)\)\s*\.?\s*$');
  IF v_m IS NULL THEN
    RETURN p_text;
  END IF;

  v_prefix := trim(v_m[1]);
  v_inner := trim(both ' .' FROM v_m[2]);

  IF v_inner !~* '(GBIF|ITIS|NCBI Taxonomy|Kew POWO|POWO|Wikidata|Catalogue of Life|Encyclopedia of Life|USDA PLANTS)' THEN
    RETURN p_text;
  END IF;

  IF v_inner ~* '^Recorded from\s+' THEN
    v_lead := 'Recorded from ';
    v_inner := regexp_replace(v_inner, '^Recorded from\s+', '', 'i');
  ELSIF v_inner ~* '^Consign[eé]\s+d''apr[eè]s\s+' THEN
    v_lead := 'Consigné d''après ';
    v_inner := regexp_replace(v_inner, '^Consign[eé]\s+d''apr[eè]s\s+', '', 'i');
  END IF;

  v_parts := regexp_split_to_array(v_inner, '\s*;\s*');
  FOREACH v_item IN ARRAY v_parts LOOP
    v_item := trim(both ' .' FROM v_item);
    IF v_item <> ''
       AND v_item !~* '^(GBIF|ITIS|NCBI Taxonomy|NCBI|Kew POWO.*|POWO|Plants of the World Online|Wikidata|Catalogue of Life|Encyclopedia of Life|USDA PLANTS)$'
    THEN
      v_kept := array_append(v_kept, v_item);
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_kept, 1), 0) = 0 THEN
    RETURN v_prefix;
  END IF;

  v_joiner := CASE WHEN p_is_fr THEN ' ; ' ELSE '; ' END;
  RETURN v_prefix || ' (' || v_lead || array_to_string(v_kept, v_joiner) || '.)';
END $$;

WITH upd AS (
  UPDATE public.herb_faqs f
  SET
    answer = pg_temp.clean_taxonomy_attr_00092(f.answer, false),
    translations = CASE
      WHEN COALESCE(f.translations->'fr'->>'answer', '') ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata|USDA PLANTS)'
      THEN jsonb_set(
        COALESCE(f.translations, '{}'::jsonb),
        '{fr,answer}',
        to_jsonb(pg_temp.clean_taxonomy_attr_00092(f.translations->'fr'->>'answer', true)),
        true
      )
      ELSE f.translations
    END,
    updated_at = now()
  FROM public.herbs h
  WHERE f.herb_id = h.id
    AND f.category IN ('dosage', 'uses', 'safety')
    AND (
      f.answer ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata|USDA PLANTS)'
      OR COALESCE(f.translations->'fr'->>'answer', '') ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata|USDA PLANTS)'
    )
    AND (
      f.answer IS DISTINCT FROM pg_temp.clean_taxonomy_attr_00092(f.answer, false)
      OR COALESCE(f.translations->'fr'->>'answer', '') IS DISTINCT FROM pg_temp.clean_taxonomy_attr_00092(COALESCE(f.translations->'fr'->>'answer', ''), true)
    )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. Replace "No specific contraindication is recorded" / "No known contraindications"
--    on dangerous herbs and pregnancy/nursing-unsafe herbs (EN + FR)
-- =====================================================================

WITH upd AS (
  UPDATE public.herbs h
  SET
    contraindications = ARRAY[
      'Potentially toxic or hazardous plant: contraindicated for self-administration, pregnancy, breastfeeding, and pediatric use unless specifically prescribed in regulated pharmaceutical form.'
    ],
    translations = jsonb_set(
      COALESCE(h.translations, '{}'::jsonb),
      '{fr,contraindications}',
      '["Plante potentiellement toxique ou dangereuse : contre-indiquée en automédication, pendant la grossesse, l''allaitement et chez l''enfant."]'::jsonb,
      true
    ),
    updated_at = now()
  WHERE h.slug = ANY(pg_temp.dangerous_slugs_00092())
    AND (
      COALESCE(array_to_string(h.contraindications, ' '), '') ~* '(no specific contraindication|no known.*contraindication|none well documented|aucune contre-indication)'
      OR COALESCE(array_length(h.contraindications, 1), 0) = 0
    )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

WITH upd AS (
  UPDATE public.herb_faqs f
  SET
    answer = 'Potentially toxic or hazardous plant: do not self-administer. Contraindicated during pregnancy, breastfeeding, in children, and alongside interacting prescription medications; consult a physician or Poison Control immediately for suspected exposure.',
    translations = jsonb_set(
      COALESCE(f.translations, '{}'::jsonb),
      '{fr,answer}',
      to_jsonb('Plante potentiellement toxique ou dangereuse : ne pas utiliser en automédication. Contre-indiquée pendant la grossesse, l''allaitement, chez l''enfant et avec les médicaments à risque d''interaction ; consulter un médecin ou un centre antipoison en cas d''exposition.'::text),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE f.herb_id = h.id
    AND h.slug = ANY(pg_temp.dangerous_slugs_00092())
    AND f.category = 'safety'
    AND (
      f.answer ~* '(no specific contraindication|no known.*contraindication|none well documented|none recorded|aucune contre-indication)'
      OR COALESCE(f.translations->'fr'->>'answer', '') ~* '(aucune contre-indication|no specific contraindication)'
    )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- Non-dangerous herbs flagged pregnancy_safe = false or nursing_safe = false
WITH upd AS (
  UPDATE public.herbs h
  SET
    contraindications = CASE
      WHEN COALESCE(array_length(ARRAY(
        SELECT c FROM unnest(COALESCE(h.contraindications, '{}'::text[])) AS c
        WHERE c !~* '(no specific contraindication|no known.*contraindication|none well documented)'
      ), 1), 0) > 0
      THEN ARRAY(
        SELECT c FROM unnest(COALESCE(h.contraindications, '{}'::text[])) AS c
        WHERE c !~* '(no specific contraindication|no known.*contraindication|none well documented)'
      )
      ELSE ARRAY[
        'Avoid during pregnancy and breastfeeding unless specifically cleared by a qualified clinician; safety in these groups is not established.'
      ]
    END,
    translations = jsonb_set(
      COALESCE(h.translations, '{}'::jsonb),
      '{fr,contraindications}',
      '["Déconseillé pendant la grossesse et l''allaitement faute de données d''innocuité suffisantes, sauf avis médical contraire."]'::jsonb,
      true
    ),
    updated_at = now()
  WHERE NOT (h.slug = ANY(pg_temp.dangerous_slugs_00092()))
    AND (h.pregnancy_safe = false OR h.nursing_safe = false)
    AND COALESCE(array_to_string(h.contraindications, ' '), '') ~* '(no specific contraindication|no known.*contraindication|none well documented)'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

WITH upd AS (
  UPDATE public.herb_faqs f
  SET
    answer = 'Avoid use during pregnancy and breastfeeding unless specifically advised by a qualified healthcare professional, as safety data in these groups are absent or indicate risk. Consult a clinician before use if you take prescription medications or have chronic medical conditions.',
    translations = jsonb_set(
      COALESCE(f.translations, '{}'::jsonb),
      '{fr,answer}',
      to_jsonb('Éviter l''utilisation pendant la grossesse et l''allaitement sauf avis contraire d''un professionnel de santé qualifié, l''innocuité n''étant pas établie ou présentant un risque. Consulter un clinicien en cas de traitement médicamenteux ou de maladie chronique.'::text),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE f.herb_id = h.id
    AND NOT (h.slug = ANY(pg_temp.dangerous_slugs_00092()))
    AND (h.pregnancy_safe = false OR h.nursing_safe = false)
    AND f.category = 'safety'
    AND (
      f.answer ~* '(no specific contraindication|no known.*contraindication|none well documented|aucune contre-indication)'
      OR COALESCE(f.translations->'fr'->>'answer', '') ~* '(aucune contre-indication|no specific contraindication)'
    )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. Systemic herb_regulatory_evidence hygiene
-- =====================================================================

-- 4a. Withhold homeopathic/multi-ingredient LNHPD doses & indications on DANGEROUS_HERBS
WITH upd AS (
  UPDATE public.herb_regulatory_evidence
  SET
    purposes = '[]'::jsonb,
    doses = '[]'::jsonb,
    risks = '["Health Canada LNHPD records under this botanical name reflect ultra-diluted homeopathic preparations or restricted ingredients, not the raw toxic plant. Homeopathic doses and claims are intentionally withheld here; do not self-administer this plant."]'::jsonb,
    updated_at = now()
  WHERE herb_slug = ANY(pg_temp.dangerous_slugs_00092())
    AND (
      purposes IS DISTINCT FROM '[]'::jsonb
      OR doses IS DISTINCT FROM '[]'::jsonb
      OR risks::text NOT LIKE '%ultra-diluted homeopathic%'
    )
  RETURNING herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 4b. Strip TBA, zero-only, and pediatric doses from ALL remaining herb_regulatory_evidence rows
WITH upd AS (
  UPDATE public.herb_regulatory_evidence r
  SET
    doses = COALESCE((
      SELECT jsonb_agg(d ORDER BY ord)
      FROM jsonb_array_elements(r.doses) WITH ORDINALITY AS t(d, ord)
      WHERE COALESCE(d->>'text', '') <> ''
        AND COALESCE(d->>'text', '') !~* '\b(Quantity Unit TBA|Time Unit TBA|Sub Pop to be created|TBA)\b'
        AND COALESCE(d->>'population', '') !~* '\b(Sub Pop to be created|TBA)\b'
        AND COALESCE(d->>'text', '') !~ '^\s*0(?:\.0+)?\s+[a-zA-Z]'
        AND COALESCE(d->>'text', '') !~* '\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b'
        AND COALESCE(d->>'population', '') !~* '\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b'
        AND NOT (
          COALESCE(d->>'age_minimum', '') ~ '^[0-9]+(\.[0-9]+)?$'
          AND (d->>'age_minimum')::numeric > 0
          AND (d->>'age_minimum')::numeric < 18
        )
    ), '[]'::jsonb),
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(r.doses, '[]'::jsonb)) d
    WHERE COALESCE(d->>'text', '') = ''
       OR COALESCE(d->>'text', '') ~* '\b(Quantity Unit TBA|Time Unit TBA|Sub Pop to be created|TBA)\b'
       OR COALESCE(d->>'population', '') ~* '\b(Sub Pop to be created|TBA)\b'
       OR COALESCE(d->>'text', '') ~ '^\s*0(?:\.0+)?\s+[a-zA-Z]'
       OR COALESCE(d->>'text', '') ~* '\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b'
       OR COALESCE(d->>'population', '') ~* '\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b'
       OR (
         COALESCE(d->>'age_minimum', '') ~ '^[0-9]+(\.[0-9]+)?$'
         AND (d->>'age_minimum')::numeric > 0
         AND (d->>'age_minimum')::numeric < 18
       )
  )
  RETURNING r.herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 4c. Strip green-tea-extract liver warning & iron child-poisoning line on mismatched herbs
WITH upd AS (
  UPDATE public.herb_regulatory_evidence r
  SET
    risks = COALESCE((
      SELECT jsonb_agg(elem ORDER BY ord)
      FROM jsonb_array_elements(r.risks) WITH ORDINALITY AS t(elem, ord)
      WHERE NOT (
        r.herb_slug NOT IN ('green-tea', 'thea-sinensis', 'camellia-sinensis', 'black-cohosh', 'kava', 'gobernadora', 'fo-ti-prepared', 'chelidonium-majus', 'germander', 'comfrey', 'senecio-aureus')
        AND (
          elem::text ILIKE '%green tea extract%'
          OR (elem::text ILIKE '%liver injury%' AND elem::text ILIKE '%dark urine%' AND elem::text ILIKE '%jaundice%')
        )
      )
      AND NOT (
        r.herb_slug NOT ILIKE '%iron%'
        AND elem::text ILIKE '%enough drug in this package to seriously harm a child%'
      )
      AND NOT (
        r.herb_slug NOT IN ('bee-pollen', 'propolis', 'royal-jelly')
        AND elem::text ~* '\b(bee venom|allergic to bees)\b'
      )
      AND NOT (
        r.herb_slug NOT ILIKE '%lobelia%'
        AND elem::text ~* '\b(nicotine replacement)\b'
      )
    ), '[]'::jsonb),
    updated_at = now()
  WHERE (
    (r.herb_slug NOT IN ('green-tea', 'thea-sinensis', 'camellia-sinensis', 'black-cohosh', 'kava', 'gobernadora', 'fo-ti-prepared', 'chelidonium-majus', 'germander', 'comfrey', 'senecio-aureus')
      AND (r.risks::text ILIKE '%green tea extract%' OR (r.risks::text ILIKE '%liver injury%' AND r.risks::text ILIKE '%dark urine%' AND r.risks::text ILIKE '%jaundice%')))
    OR (r.herb_slug NOT ILIKE '%iron%' AND r.risks::text ILIKE '%enough drug in this package to seriously harm a child%')
    OR (r.herb_slug NOT IN ('bee-pollen', 'propolis', 'royal-jelly') AND r.risks::text ~* '\b(bee venom|allergic to bees)\b')
    OR (r.herb_slug NOT ILIKE '%lobelia%' AND r.risks::text ~* '\b(nicotine replacement)\b')
  )
  RETURNING r.herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- Strip wrong-herb "green tea extract" liver-injury sentence leaked into ashwagandha safety FAQs
WITH upd AS (
  UPDATE public.herb_faqs f
  SET
    answer = trim(regexp_replace(
      f.answer,
      'Rare,\s+unpredictable cases of liver injury associated with green tea extract-containing products[^.]*\.',
      '',
      'gi'
    )),
    translations = CASE
      WHEN COALESCE(f.translations->'fr'->>'answer', '') ~* 'extrait de th[eé] vert'
      THEN jsonb_set(
        COALESCE(f.translations, '{}'::jsonb),
        '{fr,answer}',
        to_jsonb(trim(regexp_replace(
          f.translations->'fr'->>'answer',
          'De rares cas[^.]*extrait de th[eé] vert[^.]*\.',
          '',
          'gi'
        ))),
        true
      )
      ELSE f.translations
    END,
    updated_at = now()
  FROM public.herbs h
  WHERE f.herb_id = h.id
    AND h.slug NOT IN ('green-tea', 'thea-sinensis', 'camellia-sinensis')
    AND f.category = 'safety'
    AND (f.answer ~* 'green tea extract-containing products' OR COALESCE(f.translations->'fr'->>'answer', '') ~* 'extrait de th[eé] vert')
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 4d. Strip wrong-family Asteraceae & Apiaceae allergy boilerplate on audited non-matching slugs
WITH wrong_aster AS (
  SELECT ARRAY[
    'goldenseal', 'fenugreek', 'bitter-melon-metabolic', 'astragalus',
    'daphne-mezereum', 'menyanthes-trifoliata', 'coffea-arabica',
    'cranesbill-geranium', 'rupturewort', 'sweet-fern', 'juniper-communis',
    'anise-green', 'parsley', 'birch-bark', 'betula-pendula-bark',
    'betula-pubescens', 'guarana-seed', 'hibiscus-sabdariffa', 'arrowroot',
    'maranta-arundinacea', 'yellow-dock-root', 'hops', 'horsetail-equisetum',
    'senna-leaf', 'cassia-acutifolia', 'fennel', 'clove', 'thyme', 'sage',
    'rosemary', 'peppermint', 'lemon-balm', 'lavender', 'st-johns-wort',
    'valerian', 'passionflower', 'kava', 'ginkgo-biloba', 'ginseng',
    'american-ginseng', 'ashwagandha', 'rhodiola', 'cinnamon', 'ginger',
    'turmeric', 'garlic', 'hawthorn', 'elderberry', 'cranberry', 'bilberry',
    'saw-palmetto', 'nettle', 'nettle-leaf', 'nettle-root', 'licorice-root',
    'comfrey', 'dong-quai'
  ]::text[] AS slugs
),
wrong_apia AS (
  SELECT ARRAY[
    'hops', 'sinapis-alba-herb', 'commiphora-molmol', 'myrrh', 'black-seed',
    'carthamus-tinctorius', 'summer-savory', 'cassia-fistula', 'fenugreek',
    'hibiscus-sabdariffa', 'juniper-communis'
  ]::text[] AS slugs
),
upd AS (
  UPDATE public.herb_regulatory_evidence r
  SET
    risks = COALESCE((
      SELECT jsonb_agg(elem ORDER BY ord)
      FROM jsonb_array_elements(r.risks) WITH ORDINALITY AS t(elem, ord)
      WHERE NOT (
        r.herb_slug = ANY(wa.slugs)
        AND elem::text ~* '(Asteraceae|Asteracea|Compositae|Daisy family)'
      )
      AND NOT (
        r.herb_slug = ANY(wp.slugs)
        AND elem::text ~* '(Apiaceae|Umbelliferae|Carrot family|anethole)'
      )
    ), '[]'::jsonb),
    updated_at = now()
  FROM wrong_aster wa, wrong_apia wp
  WHERE (
    r.herb_slug = ANY(wa.slugs)
    AND r.risks::text ~* '(Asteraceae|Asteracea|Compositae|Daisy family)'
  )
  OR (
    r.herb_slug = ANY(wp.slugs)
    AND r.risks::text ~* '(Apiaceae|Umbelliferae|Carrot family|anethole)'
  )
  RETURNING r.herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 4e. Strip confirmed foreign pooled risks/purposes on specific audited slugs
WITH foreign_pools(slug, pattern) AS (
  VALUES
    ('aloe-vera', '(amla|emblica|l-glutamine)'),
    ('aloe-vera-leaf', '(amla|emblica|l-glutamine)'),
    ('embelia-ribes', '(guggul|commiphora)'),
    ('irish-moss', '(cayenne|capsicum)'),
    ('ashwagandha', '(melatonin|5 hours after taking)'),
    ('chamomile', '(melatonin|5 hours after taking|bone|cartilage|teeth|sunlight)'),
    ('elderberry', '(nicotine|stop smoking)'),
    ('dandelion', '(vaccine)'),
    ('sanguinaria-canadensis-herb', '(goldenseal|golden seal|hydrastis)'),
    ('yerba-mansa', '(goldenseal|golden seal|hydrastis)'),
    ('ascophyllum-nodosum', '(cascara|rhamnus purshiana|frangula)'),
    ('yellow-dock-root', '(figwort|scrophularia|gentian|homeopath)'),
    ('senna-leaf', '(figwort|gentian|homeopath)'),
    ('cassia-acutifolia', '(figwort|gentian|homeopath)'),
    ('fenugreek', '(holy basil|ocimum tenuiflorum)'),
    ('hibiscus-sabdariffa', '(sea buckthorn|elaeagnaceae|resveratrol|cartilage, teeth|vitamin c)'),
    ('parsley', '(fungal polysaccharides|mushroom)'),
    ('bitter-orange', '(rosemary|peppermint)'),
    ('dong-quai', '(l-tyrosine|workout|athletic support)'),
    ('goldenseal', '(oat seed|avena sativa)')
),
upd AS (
  UPDATE public.herb_regulatory_evidence r
  SET
    purposes = COALESCE((
      SELECT jsonb_agg(p ORDER BY ord)
      FROM jsonb_array_elements(r.purposes) WITH ORDINALITY AS t(p, ord)
      WHERE NOT EXISTS (
        SELECT 1 FROM foreign_pools fp
        WHERE fp.slug = r.herb_slug AND p::text ~* fp.pattern
      )
    ), '[]'::jsonb),
    risks = COALESCE((
      SELECT jsonb_agg(rk ORDER BY ord)
      FROM jsonb_array_elements(r.risks) WITH ORDINALITY AS t(rk, ord)
      WHERE NOT EXISTS (
        SELECT 1 FROM foreign_pools fp
        WHERE fp.slug = r.herb_slug AND rk::text ~* fp.pattern
      )
    ), '[]'::jsonb),
    updated_at = now()
  FROM foreign_pools fp
  WHERE r.herb_slug = fp.slug
    AND (r.purposes::text ~* fp.pattern OR r.risks::text ~* fp.pattern)
  RETURNING r.herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. Surgical cleanup of wrong-herb & dangerous 1894-1919 blocks in
--    public.herb_monograph_sources (note: table has NO updated_at column)
-- =====================================================================

WITH archive_filters(slug, pattern) AS (
  VALUES
    ('sinapis-alba-herb', '(sevum|ovis aries|sheep suet|mutton suet)'),
    ('boldo-leaf', '(grindelia|gum plant)'),
    ('false-unicorn', '(aletris farinosa|star grass)'),
    ('codonopsis-tangshen', '(alphabetical index|index of drugs|see page)'),
    ('thea-sinensis', '(pure caffeine|caffeinum|caffeine monograph)'),
    ('corn-silk', '(amylum|corn starch)'),
    ('yellow-dock-root', '(ruta graveolens|\brue\b)'),
    ('juniper-communis', '(oil of cade|juniperus oxycedrus|pix cadi)'),
    ('summer-savory', '(micromeria|yerba buena)'),
    ('blue-flag', '(iris florentina|orris root)'),
    ('grape-seed', '(vinum rubrum|red wine)'),
    ('carduus-benedictus', '(carduus marianus|silybum|milk thistle)'),
    ('acalypha-indica', '(wormwood|artemisia absinthium)'),
    ('cotton-root-bark', '(nuphar alba|nymphaea)'),
    ('chimaphila-umbellata', '(uva-ursi|uva ursi|arctostaphylos)'),
    ('bee-pollen', '(beeswax|cera flava|cera alba)'),
    ('pterocarpus-indicus', '(pterocarpus marsupium|\bkino\b)'),
    ('prunus-spinosa-herb', '(acacia senegal|gum arabic)'),
    ('prunus-persica-herb', '(fixed oils|almond oil|oleum amygdalae)'),
    ('pine-needle', '(pine tar|pix liquida)'),
    ('wild-basil', '(cunila origanoides|dittany)'),
    ('plum-bark', '(prunum|dried prunes)'),
    ('mai-ya-digestive', '(ungerminated barley|hordeum decorticatum|pearl barley)'),
    ('mountain-sagebrush', '(alphabetical index|index of drugs)'),
    ('alnus-rubra', '(gentiana|yellow gentian)'),
    -- Dangerous historical recipes/claims:
    ('calabar-bean', '(physostigmine|ether extraction|percolated with ether)'),
    ('red-poppy-petals', '(laudanum|tincture of opium|syrup of poppies for infants)'),
    ('mullein', '(stramonium|datura|smoking for asthma)'),
    ('elecampane-root', '(rabies|hydrophobia|tuberculosis|consumption cure)'),
    ('bittersweet-nightshade', '(berries are edible|harmless fruit)'),
    ('henbane', '(soothing infants|teething children|children''s syrup)'),
    ('cassia-acutifolia', '(safe in pregnancy|give during pregnancy)'),
    ('senecio-aureus', '(prevent miscarriage|threatened abortion|pregnancy tonic)'),
    ('european-mistletoe', '(intravenous|inject directly|cancer cure)'),
    ('scilla-maritima', '(substitute for digitalis|cardiac tonic drops)')
),
upd AS (
  UPDATE public.herb_monograph_sources m
  SET claims = COALESCE((
    SELECT jsonb_agg(elem ORDER BY ord)
    FROM jsonb_array_elements(m.claims) WITH ORDINALITY AS t(elem, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM archive_filters af
      WHERE af.slug = m.herb_slug AND elem::text ~* af.pattern
    )
  ), '[]'::jsonb)
  FROM archive_filters af
  WHERE m.herb_slug = af.slug
    AND m.claims::text ~* af.pattern
  RETURNING m.herb_slug AS slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. Strip stale fabricated '2026-06-23' provenance.last_verified_at on
--    unreviewed rows & mark all touched herbs as needs_re_review
-- =====================================================================

WITH upd AS (
  UPDATE public.herbs
  SET
    provenance = provenance - 'last_verified_at',
    updated_at = now()
  WHERE provenance->>'last_verified_at' LIKE '2026-06-23%'
    AND COALESCE(provenance->>'review_status', '') <> 'human_reviewed'
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00092 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

UPDATE public.herbs h
SET
  provenance = (COALESCE(h.provenance, '{}'::jsonb) - 'last_verified_at') || jsonb_build_object(
    'review_status', 'needs_re_review',
    'review_notes', 'Systemic AI cross-check hygiene applied (Migration 00092: taxonomy/LNHPD/PubMed/contraindication cleanup); awaiting personal sign-off by Yasser.'
  ),
  updated_at = now()
FROM pg_temp.touched_herbs_00092 t
WHERE h.slug = t.slug;

INSERT INTO public.herb_bundle_dirty (slug, queued_at)
SELECT h.slug, now()
FROM pg_temp.touched_herbs_00092 t
JOIN public.herbs h ON h.slug = t.slug
ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;

COMMIT;

-- After applying on herbally-db, refresh precomputed bundles until 0 remain:
--   DO $$ DECLARE n int; BEGIN LOOP n := public.refresh_herb_page_bundles(500); EXIT WHEN n = 0; END LOOP; END $$;
