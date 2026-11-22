-- Migration 00090: Batch 25c (Oryza sativa, Saccharum officinarum, Wild Strawberry)
-- + systemic dosage FAQ taxonomy attribution cleanup & psyllium LNHPD risk isolation.
-- IMPORTANT: Per Batch 25c protocol, all 3 edited herbs are set to
-- provenance.review_status = 'needs_re_review' until Yasser signs off personally.

BEGIN;

-- =====================================================================
-- 1. Oryza sativa (Rice) — https://herbally.app/herbs/oryza-sativa
-- =====================================================================

UPDATE public.herbs
SET
  pregnancy_safe = NULL,
  nursing_safe = NULL,
  description = 'Oryza sativa, commonly known as rice, is a globally essential cereal crop and a staple food for billions of people, also serving as a model monocot for biological research. Its seed husks contain phytoconstituents such as 7-ketostigmasterol and various sterol ferulates, flavonoids, and dipeptides, while the shelled fruit contains a short peptide called RDP1. Historically, rice grain husks have been considered a tonic and administered orally to relieve dysentery.',
  contraindications = ARRAY[
    'No contraindications in normal culinary or food amounts.',
    'Safety of concentrated Oryza sativa extracts or multi-ingredient rice supplements during pregnancy, breastfeeding, or chronic medical conditions has not been clinically established.'
  ],
  citations = '[
    {
      "source": "Health Canada LNHPD",
      "title": "Health Canada LNHPD — Licensed Natural Health Product Record (ID 4462263)",
      "url": "https://health-products.canada.ca/api/natural-licences/productlicence/?id=4462263&lang=en&type=json"
    },
    {
      "source": "Health Canada LNHPD",
      "title": "Health Canada LNHPD — Licensed Natural Health Product Record (ID 4341909)",
      "url": "https://health-products.canada.ca/api/natural-licences/productlicence/?id=4341909&lang=en&type=json"
    },
    {
      "source": "Health Canada LNHPD",
      "title": "Health Canada LNHPD — Licensed Natural Health Product Record (ID 4022304)",
      "url": "https://health-products.canada.ca/api/natural-licences/productlicence/?id=4022304&lang=en&type=json"
    }
  ]'::jsonb,
  translations = jsonb_set(
    jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb(
        'Oryza sativa, communément appelée riz, est une céréale essentielle à l''échelle mondiale et un aliment de base pour des milliards de personnes, servant également de modèle monocotylédone pour la recherche biologique. Ses enveloppes de graines contiennent des phyto-constituants tels que le 7-cétostigmastérol et divers stérols férulates, flavonoïdes et dipeptides, tandis que le fruit décortiqué contient un court peptide appelé RDP1. Historiquement, les enveloppes de grains de riz ont été considérées comme un tonique et administrées par voie orale pour soulager la dysenterie.'::text
      ),
      true
    ),
    '{fr,contraindications}',
    '[
      "Aucune contre-indication aux quantités alimentaires habituelles.",
      "L''innocuité des extraits concentrés d''Oryza sativa ou des suppléments multi-ingrédients pendant la grossesse, l''allaitement ou en cas de maladie chronique n''est pas établie cliniquement."
    ]'::jsonb,
    true
  ),
  provenance = (
    coalesce(provenance, '{}'::jsonb)
    || jsonb_build_object(
      'review_status', 'needs_re_review',
      'review_notes', 'Batch 25c AI cross-check corrections applied 2026-11-22 (removed pooled pregnancy/diabetes/allergy ban and uncited in-vitro cancer claim); awaiting human sign-off by Yasser.',
      'last_verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ),
  updated_at = now()
WHERE slug = 'oryza-sativa';

UPDATE public.herb_faqs f
SET
  answer = 'No contraindications are established for rice consumed in normal dietary amounts. Safety of concentrated rice extracts or multi-ingredient licensed supplements during pregnancy, breastfeeding, or medical conditions has not been clinically established.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Aucune contre-indication n''est établie pour le riz consommé en quantités alimentaires normales. L''innocuité des extraits concentrés de riz ou des suppléments multi-ingrédients pendant la grossesse, l''allaitement ou en présence d''une affection médicale n''est pas établie.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'oryza-sativa'
  AND f.category = 'safety';

UPDATE public.herb_faqs f
SET
  answer = 'This entry references Health Canada LNHPD for licensed-product records and Fernie''s Herbal Simples (1897) for historical context; botanical naming is cross-checked via GBIF and NCBI Taxonomy. Fields without clinical evidence are left unstated rather than filled in.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Cette fiche s''appuie sur la base RPSN (LNHPD) de Santé Canada pour les dossiers de produits homologués et sur Fernie''s Herbal Simples (1897) pour le contexte historique ; la nomenclature botanique est recoupée via GBIF et NCBI Taxonomy. Les champs sans données cliniques restent non renseignés.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'oryza-sativa'
  AND f.category = 'sources';

-- =====================================================================
-- 2. Saccharum officinarum (Sugarcane) — https://herbally.app/herbs/saccharum-officinarum
-- =====================================================================

UPDATE public.herbs
SET
  dosage_adult = NULL,
  pregnancy_safe = false,
  nursing_safe = false,
  description = 'Saccharum officinarum, known as sugarcane (Iksu, Ganna), is a tropical grass cultivated for its sucrose-rich stems and a C4 crop with Krantz anatomy. In Ayurveda and traditional Indian practice, cane juice and molasses have been used for urinary discomfort, jaundice, and digestive complaints, though these traditional uses lack randomized clinical trial confirmation. Sugar cane juice and whole stems (high in sucrose) are chemically distinct from purified sugarcane-wax extracts (policosanol / D-003), which have been studied separately for lipid metabolism and carry antiplatelet cautions.',
  contraindications = ARRAY[
    'Diabetes or impaired glucose tolerance: fresh cane juice and molasses have high sucrose content.',
    'Pregnancy and breastfeeding: concentrated sugarcane-wax extracts (policosanol / D-003) and licensed products advise against use due to insufficient safety data (culinary amounts of sugar differ).',
    'Antiplatelet or anticoagulant therapy: purified sugarcane-wax extracts (policosanol / D-003) may affect platelet aggregation — consult a healthcare practitioner before concurrent use.'
  ],
  citations = '[
    {
      "pmid": "27751878",
      "source": "PubMed",
      "title": "D-003 (Saccharum officinarum): The forgotten lipid-lowering agent.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/27751878/",
      "year": 2016
    }
  ]'::jsonb,
  translations = jsonb_set(
    coalesce(translations, '{}'::jsonb),
    '{fr}',
    ((coalesce(translations->'fr', '{}'::jsonb)) - 'dosage_adult')
    || jsonb_build_object(
      'description',
      'Saccharum officinarum, appelée canne à sucre (Iksu, Ganna), est une graminée tropicale cultivée pour ses tiges riches en saccharose. En médecine ayurvédique et traditionnelle indienne, le jus de canne et la mélasse ont été utilisés pour les troubles urinaires, l''ictère et les troubles digestifs, sans validation par essais cliniques randomisés. Le jus de canne frais (riche en sucres) est chimiquement distinct des extraits purifiés de cire de canne à sucre (policosanol / D-003), étudiés séparément pour le profil lipidique et associés à des précautions antiplaquettaires.',
      'contraindications',
      '[
        "Diabète ou intolérance au glucose : le jus de canne frais et la mélasse ont une teneur élevée en saccharose.",
        "Grossesse et allaitement : l''usage d''extraits concentrés de cire de canne (policosanol / D-003) et de produits homologués est déconseillé faute de données d''innocuité suffisantes (distinct des quantités culinaires).",
        "Traitement antiplaquettaire ou anticoagulant : les extraits de cire de canne à sucre (policosanol / D-003) peuvent influencer l''agrégation plaquettaire — consulter un professionnel de santé."
      ]'::jsonb
    ),
    true
  ),
  provenance = (
    coalesce(provenance, '{}'::jsonb)
    || jsonb_build_object(
      'review_status', 'needs_re_review',
      'review_notes', 'Batch 25c AI cross-check corrections applied 2026-11-22 (removed unverified 30-60 ml juice dose & calculator, cleaned psyllium/wax LNHPD pooling, reconciled pregnancy & antiplatelet cautions, pruned non-therapeutic PubMed padding); awaiting human sign-off by Yasser.',
      'last_verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ),
  updated_at = now()
WHERE slug = 'saccharum-officinarum';

-- Clean multi-ingredient psyllium/fiber/policosanol pool on sugarcane regulatory block
UPDATE public.herb_regulatory_evidence
SET
  purposes = '[]'::jsonb,
  doses = '[]'::jsonb,
  risks = '["Note: Sampled Health Canada LNHPD records combine sugarcane-wax extracts (policosanol / D-003) and multi-ingredient formulas. Concentrated extract caution: Do not use if you are pregnant or breastfeeding. Consult a health care practitioner prior to use if you are taking antiplatelet or anticoagulant medications."]'::jsonb,
  updated_at = now()
WHERE herb_slug = 'saccharum-officinarum';

UPDATE public.herb_faqs f
SET
  answer = 'Traditionally recorded in Ayurveda and South Asian ethnobotany for urinary discomfort, jaundice, and digestive complaints; human clinical trials are lacking to confirm efficacy for these uses. Purified sugarcane-wax extracts (policosanol / D-003) have been researched separately for lipid levels, with independent replication still needed.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Utilisée traditionnellement en médecine ayurvédique pour les troubles urinaires, l''ictère et la digestion, sans essai clinique chez l''humain confirmant cette efficacité. Les extraits purifiés de cire de canne (policosanol / D-003) sont étudiés séparément pour le bilan lipidique, avec nécessité de confirmation indépendante.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'saccharum-officinarum'
  AND f.category = 'uses';

UPDATE public.herb_faqs f
SET
  answer = 'No standardized clinical monograph dose is established for Saccharum officinarum cane juice. Sampled Health Canada licensed products represent purified sugarcane-wax extracts (policosanol / D-003) or multi-ingredient formulas rather than fresh juice.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Aucune posologie clinique standardisée n''est établie pour le jus de canne à sucre. Les produits homologués de Santé Canada consultés correspondent à des extraits de cire de canne (policosanol / D-003) ou à des formules multi-ingrédients plutôt qu''au jus frais.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'saccharum-officinarum'
  AND f.category = 'dosage';

UPDATE public.herb_faqs f
SET
  answer = 'Limit cane juice in diabetes or impaired glucose tolerance due to high sucrose content. Concentrated sugarcane-wax extracts (policosanol / D-003) and sampled licensed products advise avoiding use during pregnancy and breastfeeding and consulting a healthcare practitioner if taking antiplatelet or anticoagulant medications.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Limiter le jus de canne en cas de diabète en raison de sa teneur élevée en sucre. Les extraits concentrés de cire de canne (policosanol / D-003) et les produits homologués déconseillent l''usage pendant la grossesse et l''allaitement et recommandent un avis médical en cas de prise d''antiplaquettaires ou d''anticoagulants.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'saccharum-officinarum'
  AND f.category = 'safety';

UPDATE public.herb_faqs f
SET
  answer = 'This entry references Health Canada LNHPD for licensed-product safety records and PubMed for cited sugarcane-wax research (D-003); botanical naming is confirmed via GBIF and NCBI Taxonomy. Fields lacking clinical verification are left unstated.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Cette fiche s''appuie sur la base RPSN (LNHPD) de Santé Canada pour les dossiers de sécurité et sur PubMed pour les données publiées sur le D-003 ; la nomenclature botanique est confirmée via GBIF et NCBI Taxonomy. Les champs sans vérification clinique restent non renseignés.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'saccharum-officinarum'
  AND f.category = 'sources';

-- =====================================================================
-- 3. Wild Strawberry (Fragaria vesca) — https://herbally.app/herbs/wild-strawberry
-- =====================================================================

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  description = 'Fragaria vesca, the wild or woodland strawberry, is a perennial herb of the Rosaceae family native to Europe and temperate Asia, characterized by trifoliate serrated leaves, small white five-petaled flowers, and diminutive aromatic red accessory fruits. The leaves constitute the principal herbal drug material and are rich in condensed and hydrolysable tannins, notably ellagitannins such as agrimoniin, alongside free ellagic acid, flavonoid glycosides including quercetin and kaempferol derivatives, and modest vitamin C content. The fruits supply anthocyanins, particularly pelargonidin-based pigments, folate, and additional phenolic acids. Documented pharmacological activities derived from phytochemical characterization and experimental systems include astringency from tannin-mediated protein precipitation on mucosal surfaces, antioxidant capacity attributable to polyphenolic content, and anti-inflammatory and diuretic effects observed primarily in preclinical models. Medicinal leaf use is established as a traditional herbal medicinal product in the European Medicines Agency monograph (EMA/HMPC/432278/2015) for urinary-tract flushing and mild diarrhoea, rather than being supported by randomized clinical trials.',
  contraindications = ARRAY[
    'Hypersensitivity to Fragaria species (EMA/HMPC/432278/2015 Section 4.3).',
    'Pregnancy and lactation: medicinal leaf preparations are not recommended due to lack of sufficient safety data (EMA/HMPC/432278/2015 Section 4.6; distinct from normal culinary amounts of ripe fruit).',
    'Children and adolescents under 12 years: use of strawberry leaf preparations is not established due to lack of adequate data (EMA Section 4.4).',
    'Conditions where a reduced fluid intake is recommended (such as severe cardiac or renal disease) apply to the urinary-tract flushing indication (EMA Section 4.3).'
  ],
  citations = '[
    {
      "source": "EMA",
      "title": "European Union herbal monograph on Fragaria vesca L., Fragaria moschata Weston, Fragaria viridis Weston and Fragaria x ananassa (Weston) Duchesne ex Rozier, folium (EMA/HMPC/432278/2015)",
      "url": "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-fragaria-vesca-l-fragaria-moschata-weston-fragaria-viridis-weston-and-fragaria-x-ananassa-weston-duchesne-ex-rozier-folium_en.pdf",
      "year": 2015
    }
  ]'::jsonb,
  translations = jsonb_set(
    coalesce(translations, '{}'::jsonb),
    '{fr}',
    coalesce(translations->'fr', '{}'::jsonb) || jsonb_build_object(
      'description',
      'Fragaria vesca (fraise des bois) est une herbacée vivace de la famille des Rosaceae originaire d''Eurasie et des régions tempérées. En phytothérapie, ce sont les feuilles (Fragariae folium) — riches en tanins hydrolysables (agrimoniine), acide ellagique et flavonoïdes — qui constituent la drogue végétale, distincte des fruits alimentaires. La monographie de l''Agence européenne des médicaments (EMA/HMPC/432278/2015) reconnaît l''usage traditionnel de la feuille en tisane pour augmenter la diurèse dans les troubles urinaires mineurs et soulager la diarrhée légère.',
      'dosage_adult',
      'Tisane (EMA/HMPC/432278/2015) : Indication 1 (troubles urinaires mineurs) : décoction de 4 à 8 g de feuilles fragmentées dans 200 ml d''eau, répartie en 2 à 4 prises par jour. Indication 2 (diarrhée légère) : infusion de 1 g de feuilles dans 200 ml d''eau bouillante, 2 à 3 fois par jour. Déconseillé chez l''enfant de moins de 12 ans.',
      'contraindications',
      '[
        "Hypersensibilité aux espèces du genre Fragaria (EMA/HMPC/432278/2015 section 4.3).",
        "Grossesse et allaitement : les préparations médicinales à base de feuilles sont déconseillées faute de données suffisantes (EMA section 4.6 ; distinct de la consommation alimentaire courante du fruit mûr).",
        "Enfants et adolescents de moins de 12 ans : l''usage des préparations à base de feuilles n''est pas établi faute de données suffisantes (EMA section 4.4).",
        "Affections nécessitant une restriction hydrique (p. ex. insuffisance cardiaque ou rénale sévère) pour l''indication diurétique (EMA section 4.3)."
      ]'::jsonb
    ),
    true
  ),
  provenance = (
    coalesce(provenance, '{}'::jsonb)
    || jsonb_build_object(
      'review_status', 'needs_re_review',
      'review_notes', 'Batch 25c AI cross-check corrections applied 2026-11-22 (aligned pregnancy/nursing/contra with EMA/HMPC/432278/2015 Section 4.3/4.4/4.6, fixed FR uses/dose, replaced plant-biology citations with EMA monograph, stripped Rhamnus Frangula from King''s 1898, removed homeopathic/multi-ingredient LNHPD pool); awaiting human sign-off by Yasser.',
      'last_verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ),
  updated_at = now()
WHERE slug = 'wild-strawberry';

-- Strip Rhamnus Frangula / alder buckthorn contamination pasted into King's 1898 on wild-strawberry
UPDATE public.herb_monograph_sources
SET claims = coalesce(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(claims) AS elem
    WHERE elem::text NOT ILIKE '%Rhamnus Frangula%'
      AND elem::text NOT ILIKE '%alder buckthorn%'
      AND elem::text NOT ILIKE '%Frangula Alnus%'
  ),
  '[]'::jsonb
)
WHERE herb_slug = 'wild-strawberry'
  AND source = 'King''s American Dispensatory 1898';

-- Remove unattributed homeopathic / multi-ingredient vitamin claims & drops/servings on strawberry leaf page
UPDATE public.herb_regulatory_evidence
SET
  purposes = '[]'::jsonb,
  doses = '[]'::jsonb,
  risks = '["Multi-ingredient and homeopathic Health Canada LNHPD records note: do not use if pregnant or breastfeeding; discontinue if hypersensitivity/allergy occurs. Refer to the EMA HMPC monograph above for standardized herbal leaf tea guidance."]'::jsonb,
  updated_at = now()
WHERE herb_slug = 'wild-strawberry';

UPDATE public.herb_faqs f
SET
  answer = 'Traditional herbal medicinal product to increase the amount of urine to achieve flushing of the urinary tract as an adjuvant in minor urinary complaints, and for symptomatic treatment of mild diarrhoea (EMA/HMPC/432278/2015). Efficacy relies on long-standing traditional use rather than clinical trials. (Recorded from European Medicines Agency (HMPC); Health Canada LNHPD.)',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Médicament traditionnel à base de plantes utilisé pour augmenter le volume des urines afin de favoriser le drainage des voies urinaires en adjuvant des troubles urinaires mineurs, ainsi que pour le traitement symptomatique de la diarrhée légère (EMA/HMPC/432278/2015). Ces usages reposent sur un usage traditionnel établi plutôt que sur des essais cliniques. (European Medicines Agency (HMPC) ; Health Canada LNHPD.)'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'wild-strawberry'
  AND f.category = 'uses';

UPDATE public.herb_faqs f
SET
  answer = 'Herbal tea: Indication 1 (minor urinary complaints) — 4–8 g of comminuted strawberry leaf in 200 ml water as a decoction, divided in 2–4 single doses daily; Indication 2 (mild diarrhoea) — 1 g comminuted leaf in 200 ml boiling water as an infusion 2–3 times daily. Not recommended under 12 years. This is the EU monograph dose for leaf tea, not a personal recommendation. (European Medicines Agency (HMPC).)',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Tisane (EMA/HMPC/432278/2015) : Indication 1 (troubles urinaires mineurs) — 4 à 8 g de feuilles fragmentées dans 200 ml d''eau en décoction, répartis en 2 à 4 prises ; Indication 2 (diarrhée légère) — 1 g en infusion dans 200 ml d''eau bouillante 2 à 3 fois par jour. Déconseillé avant 12 ans. Il s''agit de la posologie de la monographie européenne, et non d''une recommandation personnelle. (European Medicines Agency (HMPC).)'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'wild-strawberry'
  AND f.category = 'dosage';

UPDATE public.herb_faqs f
SET
  answer = 'Per EMA/HMPC/432278/2015 (Fragariae folium leaf preparations): avoid with hypersensitivity to Fragaria species, do not use during pregnancy or breastfeeding due to insufficient data (Section 4.6), and do not use under 12 years (Section 4.4); avoid forced diuresis in conditions requiring fluid restriction (severe cardiac or renal disease, Section 4.3). Normal culinary amounts of ripe strawberry fruit are distinct.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Selon la monographie EMA/HMPC/432278/2015 (préparations de feuilles de fraisier) : éviter en cas d''hypersensibilité à Fragaria, déconseillé pendant la grossesse et l''allaitement faute de données suffisantes (section 4.6) et chez l''enfant de moins de 12 ans (section 4.4) ; éviter le drainage diurétique en cas de restriction hydrique (insuffisance cardiaque ou rénale sévère, section 4.3). La consommation alimentaire normale du fruit mûr est distincte.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'wild-strawberry'
  AND f.category = 'safety';

UPDATE public.herb_faqs f
SET
  answer = 'This entry was cross-checked against European Medicines Agency (HMPC) monograph EMA/HMPC/432278/2015 and Health Canada LNHPD. Every claim is attributed to those sources, and fields without clinical evidence are left unstated.',
  translations = jsonb_set(
    coalesce(f.translations, '{}'::jsonb),
    '{fr,answer}',
    to_jsonb(
      'Cette fiche a été recoupée auprès de la monographie EMA/HMPC/432278/2015 de l''Agence européenne des médicaments et de Santé Canada (LNHPD). Chaque affirmation est attribuée à ces sources.'::text
    ),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'wild-strawberry'
  AND f.category = 'sources';

-- =====================================================================
-- 4. Systemic DB Hygiene:
--    (a) Strip pure botanical taxonomy registries from dosage FAQ attributions
--    (b) Strip stray psyllium choking/allergy cautions from non-psyllium LNHPD rows
-- =====================================================================

CREATE OR REPLACE FUNCTION pg_temp.clean_dosage_attr(p_text text, p_is_fr boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_marker text;
  v_idx integer;
  v_prefix text;
  v_tail text;
  v_inner text;
  v_parts text[];
  v_kept text[] := '{}';
  v_item text;
  v_joiner text;
BEGIN
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RETURN p_text;
  END IF;

  IF position('recommendation. (' IN p_text) > 0 THEN
    v_marker := 'recommendation. (';
    v_idx := position(v_marker IN p_text) + length('recommendation.');
  ELSIF position('personnelle. (' IN p_text) > 0 THEN
    v_marker := 'personnelle. (';
    v_idx := position(v_marker IN p_text) + length('personnelle.');
  ELSE
    RETURN p_text;
  END IF;

  v_prefix := trim(substr(p_text, 1, v_idx));
  v_tail := trim(substr(p_text, v_idx + 1));

  IF left(v_tail, 1) <> '(' OR right(v_tail, 1) <> ')' THEN
    RETURN p_text;
  END IF;

  v_inner := substr(v_tail, 2, length(v_tail) - 2);
  v_inner := regexp_replace(v_inner, '\.\s*$', '');
  v_parts := regexp_split_to_array(v_inner, '\s*;\s*');

  FOREACH v_item IN ARRAY v_parts LOOP
    v_item := trim(both ' .' FROM v_item);
    IF v_item <> '' AND NOT (v_item ~* '^(GBIF|ITIS|NCBI Taxonomy|NCBI|Kew POWO.*|POWO|Plants of the World Online|Wikidata|Catalogue of Life|Encyclopedia of Life|USDA PLANTS)$') THEN
      v_kept := array_append(v_kept, v_item);
    END IF;
  END LOOP;

  IF coalesce(array_length(v_kept, 1), 0) = 0 THEN
    RETURN v_prefix;
  END IF;

  v_joiner := CASE WHEN p_is_fr THEN ' ; ' ELSE '; ' END;
  RETURN v_prefix || ' (' || array_to_string(v_kept, v_joiner) || '.)';
END $$;

UPDATE public.herb_faqs
SET
  answer = pg_temp.clean_dosage_attr(answer, false),
  translations = CASE
    WHEN coalesce(translations->'fr'->>'answer', '') ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata)'
    THEN jsonb_set(
      translations,
      '{fr,answer}',
      to_jsonb(pg_temp.clean_dosage_attr(translations->'fr'->>'answer', true)),
      true
    )
    ELSE translations
  END,
  updated_at = now()
WHERE category = 'dosage'
  AND (
    answer ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata)'
    OR coalesce(translations->'fr'->>'answer', '') ~* '(GBIF|ITIS|NCBI Taxonomy|POWO|Wikidata)'
  )
  AND (
    answer IS DISTINCT FROM pg_temp.clean_dosage_attr(answer, false)
    OR coalesce(translations->'fr'->>'answer', '') IS DISTINCT FROM pg_temp.clean_dosage_attr(coalesce(translations->'fr'->>'answer', ''), true)
  );

UPDATE public.herb_regulatory_evidence
SET
  risks = coalesce(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(risks) AS elem
      WHERE elem::text NOT ILIKE '%psyllium%'
    ),
    '[]'::jsonb
  ),
  updated_at = now()
WHERE risks::text ILIKE '%psyllium%'
  AND herb_slug NOT ILIKE '%psyllium%'
  AND herb_slug NOT ILIKE '%plantago%'
  AND herb_slug <> 'saccharum-officinarum';

INSERT INTO public.herb_bundle_dirty (slug)
VALUES ('oryza-sativa'), ('saccharum-officinarum'), ('wild-strawberry')
ON CONFLICT DO NOTHING;

COMMIT;
