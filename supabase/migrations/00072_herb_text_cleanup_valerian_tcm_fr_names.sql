-- Herb text cleanup found by the 2026-11-15 live QA (see Team Memory note
-- 2026-11-15-herbally-live-qa-indexing-and-adsense).
--
-- Every statement is conditional on the bad text still being present, so the
-- file is idempotent and never overwrites a later manual correction. It carries
-- no BEGIN/COMMIT: run it with `psql -1` so it applies as one transaction.
--
--   1. Valerian dose: the English dose text was copied from the EMA monograph
--      for valerian ESSENTIAL OIL ("15 mg ...", cut off mid-sentence), while
--      the French said 300-600 mg. Both now state the EMA valerian-ROOT doses.
--      NOTE: the EMA root PDF answered HTTP 429 to the fetch, so the figures
--      (dry extract 400-600 mg per dose, up to 4 doses/day; 0.3-3 g herbal tea
--      up to 3x/day; not under 12) come from a search summary of that
--      monograph. Verify against the PDF before relying on them.
--   2. Internal "TCM" / "TCM v2" labels in herb names, and the English
--      abbreviation "TCM" in French text (French uses "MTC").
--   3. Two mangled machine translations of dose strings.
--   4. French names for published herbs that had none (the page fell back to an
--      English heading).

-- 1. Valerian ---------------------------------------------------------------

UPDATE public.herbs
SET dosage_adult = 'Dry extract: 400–600 mg per dose, 30–60 minutes before bedtime (up to 4 doses a day). Or 0.3–3 g of dried root as a tea, up to 3 times daily.',
    dosage_child = 'Not recommended under 12 years of age',
    translations = jsonb_set(
      translations, '{fr}',
      coalesce(translations->'fr', '{}'::jsonb) || jsonb_build_object(
        'dosage_adult', 'Extrait sec : 400–600 mg par prise, 30 à 60 minutes avant le coucher (jusqu''à 4 prises par jour). Ou 0,3–3 g de racine séchée en tisane, jusqu''à 3 fois par jour.',
        'dosage_child', 'Non recommandé avant l''âge de 12 ans'
      )
    )
WHERE slug = 'valerian'
  AND dosage_adult LIKE '15 mg For relief of mild symptoms%';

UPDATE public.herbs
SET dosage_adult = 'Dry extract: 400–600 mg per dose, 30–60 minutes before bedtime (up to 4 doses a day). Or 0.3–3 g of dried root as a tea, up to 3 times daily.',
    translations = jsonb_set(
      translations, '{fr}',
      coalesce(translations->'fr', '{}'::jsonb) || jsonb_build_object(
        'dosage_adult', 'Extrait sec : 400–600 mg par prise, 30 à 60 minutes avant le coucher (jusqu''à 4 prises par jour). Ou 0,3–3 g de racine séchée en tisane, jusqu''à 3 fois par jour.'
      )
    )
WHERE slug = 'czech-valerian'
  AND dosage_adult LIKE 'Oral Use Single dose: 15 mg%';

UPDATE public.herb_faqs f
SET answer = 'Dry extract: 400–600 mg per dose, 30–60 minutes before bedtime (up to 4 doses a day). Or 0.3–3 g of dried root as a tea, up to 3 times daily. This is the labelled or monograph dose recorded for this entry, not a personal recommendation. (European Medicines Agency (HMPC); Health Canada LNHPD; PubMed.)',
    translations = jsonb_set(
      coalesce(f.translations, '{}'::jsonb), '{fr}',
      coalesce(f.translations->'fr', '{}'::jsonb) || jsonb_build_object(
        'answer', 'Extrait sec : 400–600 mg par prise, 30 à 60 minutes avant le coucher (jusqu''à 4 prises par jour). Ou 0,3–3 g de racine séchée en tisane, jusqu''à 3 fois par jour. Il s''agit de la posologie figurant sur l''étiquette ou la monographie, et non d''une recommandation personnelle. (European Medicines Agency (HMPC) ; Health Canada LNHPD ; PubMed.)'
      )
    )
FROM public.herbs h
WHERE h.id = f.herb_id
  AND h.slug = 'valerian'
  AND f.question = 'What dose of Valerian is used?'
  AND f.answer LIKE '15 mg For relief of mild symptoms%';

-- 2a. Internal labels in herb names ------------------------------------------

UPDATE public.herbs SET name = 'Lian Zi Xin (lotus plumule)',
  translations = jsonb_set(translations, '{fr}', coalesce(translations->'fr','{}'::jsonb) || jsonb_build_object('name', 'Lian Zi Xin (plumule de lotus)'))
WHERE slug = 'lian-zi-xin-tcm' AND name = 'Lian Zi Xin TCM';

UPDATE public.herbs SET name = 'Perilla Seed (Su Zi)',
  translations = jsonb_set(translations, '{fr}', coalesce(translations->'fr','{}'::jsonb) || jsonb_build_object('name', 'Graine de périlla (Su Zi)'))
WHERE slug = 'perilla-seed-tcm' AND name = 'Perilla Seed TCM';

UPDATE public.herbs SET name = 'Sheng Di Huang (raw rehmannia root)',
  translations = jsonb_set(translations, '{fr}', coalesce(translations->'fr','{}'::jsonb) || jsonb_build_object('name', 'Sheng Di Huang (racine de rehmannia crue)'))
WHERE slug = 'sheng-di-huang-tcm' AND name = 'Sheng Di Huang TCM';

UPDATE public.herbs SET name = 'Licorice Root (Glycyrrhiza uralensis)'
WHERE slug = 'licorice-root-tcm' AND name = 'Licorice Root TCM';

UPDATE public.herbs SET name = 'He Huan Hua (Albizia flower)',
  translations = jsonb_set(translations, '{fr}', coalesce(translations->'fr','{}'::jsonb) || jsonb_build_object('name', 'He Huan Hua (fleur d''albizia)'))
WHERE slug = 'he-huan-hua-tcm' AND name = 'He Huan Hua TCM';

UPDATE public.herbs SET name = 'Citrus Peel (Chen Pi)'
WHERE slug = 'citrus-peel-tcm' AND name = 'Citrus Peel TCM';

-- 2b. "TCM" -> "MTC" (médecine traditionnelle chinoise) in French text. Runs
--     after the name fixes so no French name is turned into "... MTC".
--     Article agreement: MTC is feminine ("la MTC", "de la MTC").
UPDATE public.herbs
SET translations = jsonb_set(
  translations, '{fr}',
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace((translations->'fr')::text, '\mdu TCM\M', 'de la MTC', 'g'),
        '\mle TCM\M', 'la MTC', 'g'),
      '\mun TCM\M', 'une MTC', 'g'),
    '\mTCM\M', 'MTC', 'g')::jsonb
)
WHERE jsonb_typeof(translations->'fr') = 'object'
  AND (translations->'fr')::text ~ '\mTCM\M';

-- 3. Mangled machine translations ---------------------------------------------

UPDATE public.herbs
SET translations = jsonb_set(translations, '{fr}',
  (translations->'fr') || jsonb_build_object('dosage_adult', 'Tisane de bulbe : 1 à 2 g par tasse, 2 fois par jour'))
WHERE slug = 'muscari-armeniacum'
  AND translations->'fr'->>'dosage_adult' = 'Tablette issue du bulbe : 1 à 2 gEvery jour 2 fois';

-- The same mangled string was also copied into the Muscari dose FAQ.
UPDATE public.herb_faqs f
SET translations = jsonb_set(f.translations, '{fr,answer}',
  to_jsonb(replace(f.translations->'fr'->>'answer',
    'Tablette issue du bulbe : 1 à 2 gEvery jour 2 fois',
    'Tisane de bulbe : 1 à 2 g par tasse, 2 fois par jour')))
FROM public.herbs h
WHERE h.id = f.herb_id AND h.slug = 'muscari-armeniacum'
  AND f.translations->'fr'->>'answer' LIKE '%gEvery jour 2 fois%';

UPDATE public.herbs
SET translations = jsonb_set(translations, '{fr}',
  (translations->'fr') || jsonb_build_object('dosage_adult', '1–3 g de plante séchée en tisane'))
WHERE slug = 'eschscholzia-californica-herb'
  AND translations->'fr'->>'dosage_adult' = '1-3g sécher chauffé en tisane';

-- 4. Missing French names -------------------------------------------------------
-- Latin binomials are the same in French. Common names are drafted; review
-- before treating them as final.
UPDATE public.herbs h
SET translations = jsonb_set(
  coalesce(h.translations, '{}'::jsonb), '{fr}',
  coalesce(h.translations->'fr', '{}'::jsonb) || jsonb_build_object('name', v.fr_name)
)
FROM (VALUES
  ('achillea-ligustica', 'Achillea ligustica'),
  ('ackee', 'Akée'),
  ('aerva-lanata', 'Aerva lanata'),
  ('agarikon-mushroom', 'Polypore officinal (agarikon)'),
  ('agrimonia-eupatoria-herb', 'Aigremoine eupatoire'),
  ('allspice', 'Piment de la Jamaïque'),
  ('aloe-maculata', 'Aloe maculata'),
  ('alpinia-zerumbet', 'Alpinia zerumbet'),
  ('alstonia-constricta', 'Alstonia constricta'),
  ('amorphophallus', 'Konjac'),
  ('ashoka-tree', 'Arbre d''Ashoka'),
  ('cloudberry', 'Chicouté'),
  ('clove', 'Clou de girofle'),
  ('club-moss', 'Lycopode'),
  ('cnidium-monnieri', 'Cnidium monnieri'),
  ('co-voi', 'Co Voi'),
  ('escallonia-resinosa', 'Escallonia resinosa'),
  ('gaulteria-wintergreen', 'Gaulthérie couchée'),
  ('ge-jie-mens', 'Ge Jie Mens'),
  ('mountain-mint', 'Menthe de montagne'),
  ('oyster-mushroom', 'Pleurote en huître'),
  ('pedra-hume-caa', 'Pedra Hume Caa'),
  ('pedra-hume-caa-amazonian', 'Pedra Hume Caa d''Amazonie'),
  ('pelargonium-graveolens', 'Géranium rosat'),
  ('pellitory-spanish', 'Pyrèthre d''Afrique'),
  ('peltigera-canina', 'Peltigera canina'),
  ('securidaca-longepedunculata', 'Securidaca longepedunculata'),
  ('sophora-tonkinensis', 'Sophora tonkinensis'),
  ('thapsia-garganica', 'Thapsia garganica'),
  ('thevetia-peruviana', 'Thevetia peruviana'),
  ('thlaspi-arvense-herb', 'Tabouret des champs'),
  ('thorowax', 'Buplèvre en faux'),
  ('thuja', 'Thuya')
) AS v(slug, fr_name)
WHERE h.slug = v.slug
  AND coalesce(trim(h.translations->'fr'->>'name'), '') = '';
