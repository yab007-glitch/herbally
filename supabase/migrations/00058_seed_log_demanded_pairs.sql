-- Seed log-demanded herb↔drug pairs (chat-log mining, Sep 2026).
-- Sources: explicit user question (garlic+apixaban/Eliquis) and repeated
-- herb-profile interaction queries for thinly covered herbs (kelp ×0 rows,
-- chamomile ×2, dong-quai ×1). Severities conservative; wording mirrors
-- existing rows. Every row ships FR translations (translations JSONB
-- convention: {"fr": {...}}). Rerunnable via WHERE NOT EXISTS guards.

-- 1. Garlic + Apixaban (Eliquis) (moderate) — explicit user question
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'garlic'),
  'Apixaban (Eliquis)', NULL, 'moderate',
  'Garlic inhibits platelet aggregation and may add to apixaban''s anticoagulant effect, increasing bleeding risk. Watch for unusual bruising, nosebleeds, or blood in urine or stool.',
  'Garlic-derived ajoene and related sulfur compounds inhibit platelet aggregation through thromboxane and ADP pathways, adding to factor Xa inhibition by apixaban.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'L''ail inhibe l''agrégation plaquettaire et peut s''ajouter à l''effet anticoagulant de l''apixaban, augmentant le risque de saignement. Surveillez ecchymoses inhabituelles, saignements de nez ou sang dans les urines ou les selles.',
    'mechanism', 'L''ajoène et les composés soufrés de l''ail inhibent l''agrégation plaquettaire via le thromboxane et l''ADP, s''ajoutant à l''inhibition du facteur Xa par l''apixaban.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'garlic' AND di.drug_name = 'Apixaban (Eliquis)'
);

-- 2. Kelp + Levothyroxine (Synthroid) (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'kelp'),
  'Levothyroxine (Synthroid)', NULL, 'moderate',
  'Kelp is rich in iodine, which can destabilize thyroid hormone levels and interfere with levothyroxine dosing. Keep intake consistent and monitor TSH when starting or stopping kelp.',
  'Variable iodine load from kelp alters thyroid hormone synthesis and can trigger hypo- or hyperthyroidism, shifting levothyroxine requirements unpredictably.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le varech est riche en iode, ce qui peut déstabiliser les hormones thyroïdiennes et perturber le dosage de la lévothyroxine. Gardez une consommation stable et surveillez la TSH.',
    'mechanism', 'L''apport variable en iode du varech modifie la synthèse des hormones thyroïdiennes et peut provoquer hypo- ou hyperthyroïdie, changeant les besoins en lévothyroxine de façon imprévisible.'
  ))
WHERE EXISTS (
  SELECT 1 FROM public.herbs h WHERE h.slug = 'kelp'
)
AND NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'kelp' AND di.drug_name = 'Levothyroxine (Synthroid)'
);

-- 3. Kelp + Warfarin (Coumadin) (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'kelp'),
  'Warfarin (Coumadin)', NULL, 'moderate',
  'Kelp may contain significant vitamin K, which antagonizes warfarin, and its iodine content can affect thyroid-driven clotting factor turnover. Keep kelp intake consistent and monitor INR.',
  'Vitamin K in kelp supports clotting factor synthesis opposing warfarin; variable iodine intake adds instability via thyroid effects on coagulation.',
  'limited-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le varech peut contenir beaucoup de vitamine K, qui s''oppose à la warfarine, et son iode peut influer sur la coagulation via la thyroïde. Gardez une consommation stable et surveillez l''INR.',
    'mechanism', 'La vitamine K du varech soutient la synthèse des facteurs de coagulation contre la warfarine ; l''apport variable en iode ajoute de l''instabilité via les effets thyroïdiens sur la coagulation.'
  ))
WHERE EXISTS (
  SELECT 1 FROM public.herbs h WHERE h.slug = 'kelp'
)
AND NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'kelp' AND di.drug_name = 'Warfarin (Coumadin)'
);

-- 4. Chamomile + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'chamomile'),
  'Aspirin', NULL, 'moderate',
  'Chamomile (apigenin) has mild antiplatelet activity and may add to aspirin''s blood-thinning effect. Case reports describe bleeding with heavy chamomile use alongside anticoagulant therapy.',
  'Apigenin and related flavonoids inhibit platelet aggregation and COX activity, adding to aspirin''s irreversible platelet inhibition.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'La camomille (apigénine) a une légère activité antiplaquettaire et peut s''ajouter à l''effet fluidifiant de l''aspirine. Des cas de saignement sont rapportés lors d''usage intensif avec un traitement anticoagulant.',
    'mechanism', 'L''apigénine et les flavonoïdes apparentés inhibent l''agrégation plaquettaire et la COX, s''ajoutant à l''inhibition plaquettaire irréversible de l''aspirine.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'chamomile' AND di.drug_name = 'Aspirin'
);

-- 5. Dong Quai + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'dong-quai'),
  'Aspirin', NULL, 'moderate',
  'Dong quai contains coumarin compounds and may prolong bleeding time, adding to aspirin''s antiplatelet effect. Use caution, especially before surgery.',
  'Coumarins and ferulic acid in dong quai inhibit platelet aggregation, compounding aspirin''s COX-mediated effect.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'L''angélique chinoise contient des coumarines et peut allonger le temps de saignement, s''ajoutant à l''effet antiplaquettaire de l''aspirine. Prudence, surtout avant une chirurgie.',
    'mechanism', 'Les coumarines et l''acide férulique de l''angélique chinoise inhibent l''agrégation plaquettaire, accentuant l''effet de l''aspirine via la COX.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'dong-quai' AND di.drug_name = 'Aspirin'
);
