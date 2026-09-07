-- Seed high-traffic herb↔drug pairs (Search Console / head-query audit, Sep 2026).
-- Each pair below fills a measured gap: Turmeric+Aspirin, Ginger+Aspirin/
-- Insulin, Echinacea+Immunosuppressants, Milk Thistle+Metformin,
-- Ashwagandha+Lorazepam, Black Cohosh+Atorvastatin, Saw Palmetto+Aspirin,
-- Feverfew+Aspirin, Green Tea+Lithium/Clozapine.
-- Severities are conservative; wording mirrors existing rows. Every row
-- ships with its French translation so /fr pair pages and sitemap FR URLs
-- work from day one (translations JSONB convention: {"fr": {...}}).
-- Rerunnable: duplicate (herb_id, drug_name) rows are skipped.

-- 1. Turmeric + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'turmeric'),
  'Aspirin', NULL, 'moderate',
  'Combining turmeric (curcumin) with aspirin may increase the risk of bleeding. Both inhibit platelet aggregation through different pathways, and case reports describe prolonged bleeding time with concurrent use.',
  'Curcumin inhibits platelet aggregation and thromboxane synthesis, adding to aspirin''s irreversible COX-1 inhibition — an additive antiplatelet effect.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Associer le curcuma (curcumine) à l''aspirine peut augmenter le risque de saignement. Les deux inhibent l''agrégation plaquettaire par des voies différentes, et des cas rapportés décrivent un temps de saignement prolongé en cas d''usage concomitant.',
    'mechanism', 'La curcumine inhibe l''agrégation plaquettaire et la synthèse du thromboxane, s''ajoutant à l''inhibition irréversible de la COX-1 par l''aspirine — un effet antiplaquettaire additif.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'turmeric' AND di.drug_name = 'Aspirin'
);

-- 2. Echinacea + Immunosuppressants (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'echinacea'),
  'Immunosuppressants', NULL, 'moderate',
  'Echinacea stimulates immune activity and may counteract immunosuppressive therapy, raising the risk of organ rejection in transplant recipients and reducing drug efficacy in autoimmune disease.',
  'Echinacea polysaccharides and alkamides stimulate macrophage activity, cytokine production, and T-cell function, pharmacologically opposing immunosuppressants such as cyclosporine, tacrolimus, and corticosteroids.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'L''échinacée stimule l''activité immunitaire et peut contrecarrer un traitement immunosuppresseur, augmentant le risque de rejet chez les transplantés et réduisant l''efficacité du traitement des maladies auto-immunes.',
    'mechanism', 'Les polysaccharides et alkamides de l''échinacée stimulent les macrophages, la production de cytokines et les lymphocytes T, s''opposant pharmacologiquement aux immunosuppresseurs comme la ciclosporine, le tacrolimus et les corticoïdes.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'echinacea' AND di.drug_name = 'Immunosuppressants'
);

-- 3. Ginger + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'ginger'),
  'Aspirin', NULL, 'moderate',
  'Ginger inhibits platelet aggregation and may add to aspirin''s blood-thinning effect, increasing bleeding risk — particularly before surgery or with high ginger doses.',
  'Gingerols and shogaols inhibit thromboxane synthesis and platelet aggregation, adding to aspirin''s irreversible platelet inhibition.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le gingembre inhibe l''agrégation plaquettaire et peut s''ajouter à l''effet fluidifiant de l''aspirine, augmentant le risque de saignement — en particulier avant une chirurgie ou à fortes doses.',
    'mechanism', 'Les gingerols et shogaols inhibent la synthèse du thromboxane et l''agrégation plaquettaire, s''ajoutant à l''inhibition plaquettaire irréversible de l''aspirine.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'ginger' AND di.drug_name = 'Aspirin'
);

-- 4. Ginger + Insulin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'ginger'),
  'Insulin', NULL, 'moderate',
  'Ginger may lower blood glucose and could add to insulin''s effect, increasing the risk of hypoglycemia. Closer glucose monitoring is advised when combining them.',
  'Gingerols may improve insulin sensitivity and glucose uptake while modestly reducing fasting glucose, adding to exogenous insulin action.',
  'limited-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le gingembre peut abaisser la glycémie et s''ajouter à l''effet de l''insuline, augmentant le risque d''hypoglycémie. Une surveillance glycémique renforcée est conseillée.',
    'mechanism', 'Les gingerols pourraient améliorer la sensibilité à l''insuline et la captation du glucose tout en réduisant légèrement la glycémie à jeun, s''ajoutant à l''action de l''insuline exogène.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'ginger' AND di.drug_name = 'Insulin'
);

-- 5. Milk Thistle + Metformin (mild)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'milk-thistle'),
  'Metformin', NULL, 'mild',
  'Milk thistle (silymarin) may modestly lower blood glucose, potentially adding to metformin''s effect. The combination is generally well tolerated with routine glucose monitoring.',
  'Silymarin''s antioxidant and insulin-sensitizing properties may slightly enhance glycemic control alongside metformin.',
  'limited-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le chardon-Marie (silymarine) peut abaisser légèrement la glycémie et s''ajouter à l''effet de la metformine. L''association est généralement bien tolérée avec une surveillance glycémique habituelle.',
    'mechanism', 'Les propriétés antioxydantes et insulino-sensibilisantes de la silymarine peuvent légèrement améliorer le contrôle glycémique en complément de la metformine.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'milk-thistle' AND di.drug_name = 'Metformin'
);

-- 6. Ashwagandha + Lorazepam (Ativan) (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'ashwagandha'),
  'Lorazepam (Ativan)', NULL, 'moderate',
  'Ashwagandha has mild sedative activity and may enhance the drowsiness, dizziness, and psychomotor impairment caused by lorazepam and other benzodiazepines.',
  'Withanolides modulate GABA-A receptor signaling, producing additive CNS depression alongside benzodiazepine sedation.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'L''ashwagandha possède une légère activité sédative et peut accentuer la somnolence, les vertiges et la baisse de vigilance provoqués par le lorazépam et les autres benzodiazépines.',
    'mechanism', 'Les withanolides modulent la signalisation des récepteurs GABA-A, produisant une dépression du système nerveux central additive à la sédation des benzodiazépines.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'ashwagandha' AND di.drug_name = 'Lorazepam (Ativan)'
);

-- 7. Black Cohosh + Atorvastatin (Lipitor) (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'black-cohosh'),
  'Atorvastatin (Lipitor)', NULL, 'moderate',
  'Rare cases of liver injury have been reported with black cohosh, and combining it with atorvastatin (which also carries hepatic risk) warrants liver function monitoring.',
  'Both agents have independently been associated with hepatocellular injury; concurrent use may compound hepatic burden, though a direct interaction mechanism is unproven.',
  'limited-evidence', 'Clinical Studies',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'De rares cas d''atteinte hépatique ont été rapportés avec l''actée à grappes noires, et l''associer à l''atorvastatine (qui comporte aussi un risque hépatique) justifie une surveillance de la fonction hépatique.',
    'mechanism', 'Les deux produits ont été indépendamment associés à des atteintes hépatocellulaires ; leur usage concomitant peut alourdir la charge hépatique, même si un mécanisme d''interaction direct n''est pas démontré.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'black-cohosh' AND di.drug_name = 'Atorvastatin (Lipitor)'
);

-- 8. Saw Palmetto + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'saw-palmetto'),
  'Aspirin', NULL, 'moderate',
  'Saw palmetto may inhibit platelet aggregation and could add to aspirin''s antiplatelet effect. Discontinue before surgery and watch for unusual bruising or bleeding.',
  'Saw palmetto fatty acids and phytosterols show mild antiplatelet activity that adds to aspirin''s COX-mediated platelet inhibition.',
  'limited-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'Le palmier nain peut inhiber l''agrégation plaquettaire et s''ajouter à l''effet antiplaquettaire de l''aspirine. Interrompre avant une chirurgie et surveiller ecchymoses ou saignements inhabituels.',
    'mechanism', 'Les acides gras et phytostérols du palmier nain montrent une légère activité antiplaquettaire qui s''ajoute à l''inhibition plaquettaire de l''aspirine via la COX.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'saw-palmetto' AND di.drug_name = 'Aspirin'
);

-- 9. Feverfew + Aspirin (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'feverfew'),
  'Aspirin', NULL, 'moderate',
  'Feverfew (parthenolide) inhibits platelet aggregation and serotonin release from platelets, adding to aspirin''s effect and increasing bleeding risk.',
  'Parthenolide blocks platelet aggregation and granule secretion through mechanisms distinct from aspirin''s COX inhibition, producing an additive effect.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'La grande camomille (parthénolide) inhibe l''agrégation plaquettaire et la libération de sérotonine par les plaquettes, s''ajoutant à l''effet de l''aspirine et augmentant le risque de saignement.',
    'mechanism', 'Le parthénolide bloque l''agrégation plaquettaire et la sécrétion granulaire par des mécanismes distincts de l''inhibition de la COX par l''aspirine, produisant un effet additif.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'feverfew' AND di.drug_name = 'Aspirin'
);

-- 10. Green Tea + Lithium (moderate)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'green-tea'),
  'Lithium', NULL, 'moderate',
  'Green tea''s caffeine and mild diuretic effect can alter lithium excretion. Keep intake steady — abrupt increases or stops can shift lithium levels out of range.',
  'Caffeine increases renal blood flow and lithium clearance, while sudden caffeine withdrawal reverses the effect; theophylline-related diuresis adds variability.',
  'moderate-evidence', 'Natural Medicines Database',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'La caféine et le léger effet diurétique du thé vert peuvent modifier l''élimination du lithium. Gardez une consommation stable — un changement brutal peut faire sortir la lithémie de sa zone thérapeutique.',
    'mechanism', 'La caféine augmente le débit sanguin rénal et la clairance du lithium, tandis qu''un sevrage brutal inverse l''effet ; la diurèse liée à la théophylline ajoute de la variabilité.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'green-tea' AND di.drug_name = 'Lithium'
);

-- 11. Green Tea + Clozapine (severe)
INSERT INTO public.drug_interactions
  (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, translations)
SELECT
  (SELECT id FROM public.herbs WHERE slug = 'green-tea'),
  'Clozapine', NULL, 'severe',
  'Caffeine in green tea inhibits CYP1A2, the main enzyme clearing clozapine, and can raise clozapine blood levels — increasing seizure and toxicity risk. Do not change intake without prescriber supervision and blood monitoring.',
  'Caffeine is a CYP1A2 inhibitor; reduced clozapine clearance raises serum concentrations of a drug with a narrow therapeutic index and dose-dependent seizure risk.',
  'moderate-evidence', 'Clinical Studies',
  jsonb_build_object('fr', jsonb_build_object(
    'description', 'La caféine du thé vert inhibe le CYP1A2, principale enzyme d''élimination de la clozapine, et peut élever la clozapinémie — augmentant les risques de convulsions et de toxicité. Ne modifiez pas votre consommation sans supervision médicale et suivi sanguin.',
    'mechanism', 'La caféine inhibe le CYP1A2 ; la clairance réduite de la clozapine élève les concentrations sériques d''un médicament à marge thérapeutique étroite et à risque convulsif dose-dépendant.'
  ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug = 'green-tea' AND di.drug_name = 'Clozapine'
);
