-- Migration 00096: Contradiction Fixes (2026-11-23)
--
-- Pre-write backup: /home/yasser/herbally-backups/contradictions-20261123.dump
--
-- Rules remediated (without inventing medical facts, doses, citations, or reviews):
--   Rule 1  (r_nurse_contra): 20 rows where nursing_safe=true contradicted explicit
--           breastfeeding/nursing contraindication -> set nursing_safe=false and
--           clear route-split booleans (nursing_safe_oral, nursing_safe_topical).
--   Rule 3  (r_oral_but_internal_contra): 3 genuine oral-dose vs unambiguous
--           internal-use contraindication rows (jatropha-gossypiifolia,
--           calotropis-gigantea, nepenthes-mirabilis) -> null dosage_adult (+ FR),
--           keeping preparation_notes intact. 29 topical/qualified rows left intact.
--   Rule 4  (r_child_dose_vs_contra): 235 rows where dosage_child contradicted an
--           explicit children/pediatric contraindication -> null dosage_child (+ FR).
--   Rule 5  (r_no_known_claim): 2 multi-element rows (macadamia-nut-oil, sumac-herb)
--           listing both a real contraindication and "None established as food" ->
--           drop the "None..." element (EN + FR). 68 single-element honest rows kept.
--   Rule 6  (r_vague_safety): 30 residual vague safety side_effects rows -> rewrite
--           vague phrases to "Adverse effects not well documented in the reviewed
--           literature" (+ FR) while preserving any already-listed effects/PMIDs.
--   Rule 7  (r_image_no_licence): 24 rows missing provenance.image.licence/credit
--           while already storing license/attribution -> backfill from stored metadata.
--   Rule 10 (r_prov_unverified): 494 Health Canada LNHPD-imported rows lacking
--           provenance.verification_method -> map to 'primary_source'; 548 rows
--           with 'unverified' left untouched.
--
-- NON-NEGOTIABLE: Never sets provenance.review_status, reviewed_by, or is_published.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS pg_temp.touched_herbs_00096 (
  slug text PRIMARY KEY
) ON COMMIT DROP;

-- =====================================================================
-- Rule 1: Nursing contradiction (20 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    nursing_safe = false,
    nursing_safe_oral = NULL,
    nursing_safe_topical = NULL,
    updated_at = now()
  WHERE is_published
    AND nursing_safe IS TRUE
    AND coalesce(array_to_string(contraindications, ' | '), '') ~* 'nurs|allait|breastfeed'
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 3: Oral dose vs unambiguous internal-use contraindication (3 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    dosage_adult = NULL,
    translations = CASE
      WHEN translations ? 'fr'
        THEN jsonb_set(translations, '{fr,dosage_adult}', 'null'::jsonb, true)
      ELSE translations
    END,
    updated_at = now()
  WHERE is_published
    AND slug IN ('jatropha-gossypiifolia', 'calotropis-gigantea', 'nepenthes-mirabilis')
    AND dosage_adult IS NOT NULL
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 4: Child dose vs child contraindication (235 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    dosage_child = NULL,
    translations = CASE
      WHEN translations ? 'fr'
        THEN jsonb_set(translations, '{fr,dosage_child}', 'null'::jsonb, true)
      ELSE translations
    END,
    updated_at = now()
  WHERE is_published
    AND dosage_child IS NOT NULL
    AND btrim(dosage_child) <> ''
    AND coalesce(array_to_string(contraindications, ' | '), '') ~* 'children|pediatric|paediatric'
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 5: "No known contraindications" alongside real ones (2 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    contraindications = (
      SELECT coalesce(array_agg(c ORDER BY ord), '{}'::text[])
      FROM unnest(contraindications) WITH ORDINALITY AS t(c, ord)
      WHERE c !~* '^none|no known'
    ),
    translations = CASE
      WHEN slug = 'macadamia-nut-oil' AND translations ? 'fr'
        THEN jsonb_set(translations, '{fr,contraindications}', '["Allergie aux noix"]'::jsonb, true)
      WHEN slug = 'sumac-herb' AND translations ? 'fr'
        THEN jsonb_set(translations, '{fr,contraindications}', '["Calculs rénaux avec sensibilité aux oxalates élevés"]'::jsonb, true)
      ELSE translations
    END,
    updated_at = now()
  WHERE is_published
    AND array_length(contraindications, 1) > 1
    AND exists (
      SELECT 1 FROM unnest(contraindications) c WHERE c ~* '^none|no known'
    )
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 6: Residual vague safety lines (30 rows)
-- =====================================================================
WITH targets(slug, new_en, new_fr) AS (
  VALUES
    -- 15 pure vague single-element rows
    ('vietnamese-coriander', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('kawakawa', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('egusi-herb', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('aframomum-corrorima', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('munyeroo', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('poria-cocos', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('emu-bush', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('phormium-tenax', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('osmorhiza-longistylis', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('mentha-requienii', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('chaparro-amargosa', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('beach-morning-glory', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('peltigera-canina', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('chanterelle', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    ('porcini', ARRAY['Adverse effects not well documented in the reviewed literature'], '["Effets indésirables peu documentés dans la littérature examinée"]'::jsonb),
    -- 8 rows keeping specific listed effects verbatim
    ('birds-foot-trefoil', ARRAY['Mild nausea'], '["Légère nausée"]'::jsonb),
    ('xanthorhiza-simplicissima', ARRAY['GI upset'], '["troubles gastro-intestinaux"]'::jsonb),
    ('velvet-tamarind', ARRAY['diarrhea with excess'], '["Diarrhée en excès"]'::jsonb),
    ('chaya', ARRAY['Prussic acid toxicity if consumed raw'], '["Toxicité par acide prussique si consommé cru"]'::jsonb),
    ('sideritis', ARRAY['Rare GI sensitivity'], '["Rare sensibilité digestive"]'::jsonb),
    ('aquilaria-sinensis', ARRAY['GI upset'], '["Troubles gastro-intestinaux"]'::jsonb),
    ('warburgia-salutaris', ARRAY['GI irritation'], '["Irritation gastro-intestinale"]'::jsonb),
    ('strychnos-spinosa', ARRAY['Bark toxic in high doses'], '["Écorce toxique en fortes doses"]'::jsonb),
    -- 7 PubMed-cited rows preserving listed adverse effects & PMIDs
    ('abelmoschus-manihot', ARRAY['Adverse effects not well documented in the reviewed literature [PMID:35278897, PMID:38249351].'], '["Effets indésirables peu documentés dans la littérature examinée."]'::jsonb),
    ('chrysanthemum-parthenium', ARRAY[
      'Occasional gastrointestinal irritation or oral ulcers may occur [PMID:30000921].',
      'Rapid discontinuation can lead to rebound headaches [PMID:30000921].',
      'Allergic contact dermatitis can occur, specifically due to parthenolide, with potential cross-reactions to other Compositae plants such as chrysanthemums, daisies, and marigolds [PMID:30000921, PMID:6488783, PMID:6452257].'
    ], '[
      "Une irritation gastro-intestinale ou des ulcères buccaux peuvent survenir occasionnellement.",
      "Un arrêt rapide peut entraîner des céphalées de rebond.",
      "Une dermatite de contact allergique peut survenir, spécifiquement due au parténolide, avec des réactions croisées potentielles à d''autres plantes de la famille des Composées telles que les chrysanthèmes, les marguerites et les soucis."
    ]'::jsonb),
    ('dioscorea-spongiosa', ARRAY[
      'Adverse effects not well documented in the reviewed literature [PMID: 15114498].',
      'Water extracts showed lower cytotoxicity in osteoblast and bone marrow cells [PMID: 15056872].'
    ], '[
      "Effets indésirables peu documentés dans la littérature examinée.",
      "Les extraits aqueux ont montré une cytotoxicité plus faible dans les cellules ostéoblastiques et les cellules de la moelle osseuse."
    ]'::jsonb),
    ('jasminum-grandiflorum', ARRAY['Adverse effects not well documented in the reviewed literature [PMID:38843799, PMID:25847780].'], '["Effets indésirables peu documentés dans la littérature examinée."]'::jsonb),
    ('paeonia-anomala', ARRAY['May occasionally cause gastrointestinal upset and allergic skin reactions, particularly with topical application [PMID:30000962].'], '["Peut occasionnellement causer des troubles gastro-intestinaux et des réactions cutanées allergiques, particulièrement lors d''une application topique."]'::jsonb),
    ('pennisetum-glaucum', ARRAY['Adverse effects not well documented in the reviewed literature [PMID:41150806].'], '["Effets indésirables peu documentés dans la littérature examinée."]'::jsonb),
    ('sabal-serrulata', ARRAY['Adverse effects not well documented in the reviewed literature [PMID:9089044, PMID:9091843, PMID:7513678, PMID:7689525].'], '["Effets indésirables peu documentés dans la littérature examinée."]'::jsonb)
),
upd AS (
  UPDATE public.herbs h
  SET
    side_effects = t.new_en,
    translations = CASE
      WHEN h.translations ? 'fr'
        THEN jsonb_set(h.translations, '{fr,side_effects}', t.new_fr, true)
      ELSE h.translations
    END,
    updated_at = now()
  FROM targets t
  WHERE h.is_published AND h.slug = t.slug
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 7: Image licence/credit backfill from stored metadata (24 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    provenance = jsonb_set(
      jsonb_set(
        provenance,
        '{image,licence}',
        to_jsonb(provenance->'image'->>'license'),
        true
      ),
      '{image,credit}',
      to_jsonb(provenance->'image'->>'attribution'),
      true
    ),
    updated_at = now()
  WHERE is_published
    AND image_url IS NOT NULL
    AND (coalesce(provenance->'image'->>'licence', '') = '' OR coalesce(provenance->'image'->>'credit', '') = '')
    AND coalesce(provenance->'image'->>'license', '') <> ''
    AND coalesce(provenance->'image'->>'attribution', '') <> ''
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Rule 10: Provenance verification_method for LNHPD-imported rows (494 rows)
-- =====================================================================
WITH upd AS (
  UPDATE public.herbs
  SET
    provenance = jsonb_set(provenance, '{verification_method}', '"primary_source"'::jsonb, true),
    updated_at = now()
  WHERE is_published
    AND NOT (provenance ? 'verification_method')
    AND provenance->>'verified_by' LIKE 'regulator record (LNHPD)%'
    AND exists (
      SELECT 1
      FROM jsonb_array_elements(coalesce(provenance->'sources', '[]'::jsonb)) s
      WHERE s->>'type' = 'regulator' AND s->>'name' = 'Health Canada LNHPD'
    )
  RETURNING slug
)
INSERT INTO pg_temp.touched_herbs_00096 (slug)
SELECT slug FROM upd
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Queue all modified herbs for page-bundle refresh
-- =====================================================================
INSERT INTO public.herb_bundle_dirty (slug, queued_at)
SELECT slug, now()
FROM pg_temp.touched_herbs_00096
ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;

COMMIT;
