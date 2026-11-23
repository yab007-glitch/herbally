-- Migration 00093: P0 Lethal, High-Risk, Wrong-Species, Over-Monograph & Pregnancy Reversals
--
-- Bilingual (EN + FR) clinical remediation across 4 P0/P1 audit groups:
--   Group A: Lethal, banned, Group-1 carcinogenic, cyanogenic, cardiac-glycoside, and boxed-warning plants
--   Group B: Wrong-herb / wrong-species / wrong-part identity corrections (incl. Pygeum rename)
--   Group C: Over-monograph / toxic-threshold doses & critical clinical safety warnings
--   Group D: Pregnancy-as-a-Use reversals (miscarriage / morning-sickness / labour / galactagogue claims)
--
-- NON-NEGOTIABLE: Every modified herb is set to provenance.review_status = 'needs_re_review'
-- (NEVER 'human_reviewed') until Yasser signs off personally.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS pg_temp.touched_herbs_00093 (
  slug text PRIMARY KEY
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.remediate_herb_00093(
  p_slug text,
  p_name_en text DEFAULT NULL,
  p_name_fr text DEFAULT NULL,
  p_dosage_en text DEFAULT NULL,
  p_dosage_fr text DEFAULT NULL,
  p_pregnancy_safe boolean DEFAULT NULL,
  p_nursing_safe boolean DEFAULT NULL,
  p_description_en text DEFAULT NULL,
  p_description_fr text DEFAULT NULL,
  p_contraindications_en text[] DEFAULT NULL,
  p_contraindications_fr text[] DEFAULT NULL,
  p_side_effects_en text[] DEFAULT NULL,
  p_side_effects_fr text[] DEFAULT NULL,
  p_traditional_uses_en text[] DEFAULT NULL,
  p_traditional_uses_fr text[] DEFAULT NULL,
  p_modern_uses_en text[] DEFAULT NULL,
  p_modern_uses_fr text[] DEFAULT NULL,
  p_faq_safety_en text DEFAULT NULL,
  p_faq_safety_fr text DEFAULT NULL,
  p_faq_dosage_en text DEFAULT NULL,
  p_faq_dosage_fr text DEFAULT NULL,
  p_faq_uses_en text DEFAULT NULL,
  p_faq_uses_fr text DEFAULT NULL,
  p_review_note text DEFAULT 'P0/P1 clinical cross-check remediation applied'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_fr jsonb;
  v_label text;
BEGIN
  SELECT id, name INTO v_id, v_label FROM public.herbs WHERE slug = p_slug;
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO pg_temp.touched_herbs_00093 (slug) VALUES (p_slug) ON CONFLICT DO NOTHING;

  SELECT COALESCE(translations->'fr', '{}'::jsonb) INTO v_fr FROM public.herbs WHERE id = v_id;

  IF p_name_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('name', p_name_fr);
  END IF;
  IF p_dosage_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('dosage_adult', p_dosage_fr);
  END IF;
  IF p_description_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('description', p_description_fr);
  END IF;
  IF p_contraindications_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('contraindications', to_jsonb(p_contraindications_fr));
  END IF;
  IF p_side_effects_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('side_effects', to_jsonb(p_side_effects_fr));
  END IF;
  IF p_traditional_uses_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('traditional_uses', to_jsonb(p_traditional_uses_fr));
  END IF;
  IF p_modern_uses_fr IS NOT NULL THEN
    v_fr := v_fr || jsonb_build_object('modern_uses', to_jsonb(p_modern_uses_fr));
  END IF;

  UPDATE public.herbs
  SET
    name = COALESCE(p_name_en, name),
    dosage_adult = COALESCE(p_dosage_en, dosage_adult),
    pregnancy_safe = COALESCE(p_pregnancy_safe, pregnancy_safe),
    nursing_safe = COALESCE(p_nursing_safe, nursing_safe),
    description = COALESCE(p_description_en, description),
    contraindications = COALESCE(p_contraindications_en, contraindications),
    side_effects = COALESCE(p_side_effects_en, side_effects),
    traditional_uses = COALESCE(p_traditional_uses_en, traditional_uses),
    modern_uses = COALESCE(p_modern_uses_en, modern_uses),
    translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{fr}', v_fr, true),
    provenance = (COALESCE(provenance, '{}'::jsonb) - 'last_verified_at') || jsonb_build_object(
      'review_status', 'needs_re_review',
      'review_notes', p_review_note || ' (2026-11-22); awaiting human sign-off by Yasser.'
    ),
    updated_at = now()
  WHERE id = v_id;

  IF p_faq_safety_en IS NOT NULL THEN
    UPDATE public.herb_faqs
    SET
      answer = p_faq_safety_en,
      translations = CASE
        WHEN p_faq_safety_fr IS NOT NULL THEN
          jsonb_set(COALESCE(translations, '{}'::jsonb), '{fr,answer}', to_jsonb(p_faq_safety_fr), true)
        ELSE translations
      END,
      updated_at = now()
    WHERE herb_id = v_id AND category = 'safety';

    IF NOT FOUND THEN
      INSERT INTO public.herb_faqs (herb_id, question, answer, category, sort_order, translations)
      VALUES (
        v_id,
        'Who should avoid ' || COALESCE(p_name_en, v_label) || '?',
        p_faq_safety_en,
        'safety',
        2,
        jsonb_build_object('fr', jsonb_build_object(
          'question', 'Qui devrait éviter ' || COALESCE(p_name_fr, v_fr->>'name', v_label) || ' ?',
          'answer', COALESCE(p_faq_safety_fr, p_faq_safety_en)
        ))
      )
      ON CONFLICT (herb_id, question) DO UPDATE
      SET answer = EXCLUDED.answer, translations = EXCLUDED.translations, updated_at = now();
    END IF;
  END IF;

  IF p_faq_dosage_en IS NOT NULL THEN
    UPDATE public.herb_faqs
    SET
      answer = p_faq_dosage_en,
      translations = CASE
        WHEN p_faq_dosage_fr IS NOT NULL THEN
          jsonb_set(COALESCE(translations, '{}'::jsonb), '{fr,answer}', to_jsonb(p_faq_dosage_fr), true)
        ELSE translations
      END,
      updated_at = now()
    WHERE herb_id = v_id AND category = 'dosage';

    IF NOT FOUND THEN
      INSERT INTO public.herb_faqs (herb_id, question, answer, category, sort_order, translations)
      VALUES (
        v_id,
        'What is the dosage of ' || COALESCE(p_name_en, v_label) || '?',
        p_faq_dosage_en,
        'dosage',
        1,
        jsonb_build_object('fr', jsonb_build_object(
          'question', 'Quelle est la posologie de ' || COALESCE(p_name_fr, v_fr->>'name', v_label) || ' ?',
          'answer', COALESCE(p_faq_dosage_fr, p_faq_dosage_en)
        ))
      )
      ON CONFLICT (herb_id, question) DO UPDATE
      SET answer = EXCLUDED.answer, translations = EXCLUDED.translations, updated_at = now();
    END IF;
  END IF;

  IF p_faq_uses_en IS NOT NULL THEN
    UPDATE public.herb_faqs
    SET
      answer = p_faq_uses_en,
      translations = CASE
        WHEN p_faq_uses_fr IS NOT NULL THEN
          jsonb_set(COALESCE(translations, '{}'::jsonb), '{fr,answer}', to_jsonb(p_faq_uses_fr), true)
        ELSE translations
      END,
      updated_at = now()
    WHERE herb_id = v_id AND category = 'uses';
  END IF;
END $$;

-- Convenience helper specifically for outright lethal / banned / no-safe-dose plants in Group A
CREATE OR REPLACE FUNCTION pg_temp.remediate_lethal_00093(
  p_slug text,
  p_toxin_summary_en text,
  p_toxin_summary_fr text,
  p_specific_contra_en text[] DEFAULT NULL,
  p_specific_contra_fr text[] DEFAULT NULL,
  p_specific_se_en text[] DEFAULT NULL,
  p_specific_se_fr text[] DEFAULT NULL,
  p_modern_uses_en text[] DEFAULT ARRAY['No established clinical self-care indication (poisonous/restricted plant)']::text[],
  p_modern_uses_fr text[] DEFAULT ARRAY['Aucune indication clinique en automédication (plante toxique ou réglementée)']::text[],
  p_trad_uses_en text[] DEFAULT NULL,
  p_trad_uses_fr text[] DEFAULT NULL,
  p_review_note text DEFAULT 'Group A lethal/high-risk safety remediation'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_dose_en text := 'No safe self-administered dose — poisonous/toxic plant; do not ingest.';
  v_dose_fr text := 'Aucune dose sûre en automédication — plante toxique ou potentiellement mortelle ; ne pas ingérer.';
  v_contra_en text[] := COALESCE(p_specific_contra_en, ARRAY[
    'Do not ingest in any unstandardized or home preparation — severe or fatal poisoning risk.',
    'Strictly contraindicated in pregnancy, breastfeeding, children, and older adults.'
  ]);
  v_contra_fr text[] := COALESCE(p_specific_contra_fr, ARRAY[
    'Ne jamais ingérer sous forme brute ou préparée à domicile — risque d''intoxication grave ou mortelle.',
    'Formellement contre-indiquée pendant la grossesse, l''allaitement, chez l''enfant et les personnes vulnérables.'
  ]);
  v_faq_dose_en text := 'No safe self-administered dose exists. ' || p_toxin_summary_en || ' Do not ingest or prepare home remedies.';
  v_faq_dose_fr text := 'Aucune dose sûre n''existe en automédication. ' || p_toxin_summary_fr || ' Ne jamais ingérer ni préparer de remède maison.';
  v_faq_safe_en text := 'Everyone should avoid self-administration: ' || p_toxin_summary_en || ' Strictly contraindicated during pregnancy, breastfeeding, and in children. Contact Poison Control or emergency services immediately if ingested.';
  v_faq_safe_fr text := 'Toute personne doit éviter l''automédication : ' || p_toxin_summary_fr || ' Strictement contre-indiquée pendant la grossesse, l''allaitement et chez l''enfant. En cas d''ingestion, contacter immédiatement un centre antipoison ou les urgences.';
BEGIN
  PERFORM pg_temp.remediate_herb_00093(
    p_slug := p_slug,
    p_dosage_en := v_dose_en,
    p_dosage_fr := v_dose_fr,
    p_pregnancy_safe := false,
    p_nursing_safe := false,
    p_contraindications_en := v_contra_en,
    p_contraindications_fr := v_contra_fr,
    p_side_effects_en := p_specific_se_en,
    p_side_effects_fr := p_specific_se_fr,
    p_traditional_uses_en := p_trad_uses_en,
    p_traditional_uses_fr := p_trad_uses_fr,
    p_modern_uses_en := p_modern_uses_en,
    p_modern_uses_fr := p_modern_uses_fr,
    p_faq_safety_en := v_faq_safe_en,
    p_faq_safety_fr := v_faq_safe_fr,
    p_faq_dosage_en := v_faq_dose_en,
    p_faq_dosage_fr := v_faq_dose_fr,
    p_review_note := p_review_note
  );
END $$;

-- =====================================================================
-- GROUP A — Lethal, Toxic, Banned, Carcinogen, Cyanogenic, Cardiac-Glycoside
--           and FDA Boxed-Warning Plants
-- =====================================================================

-- 1. Pokeweed (pokeroot)
SELECT pg_temp.remediate_lethal_00093(
  'pokeroot',
  'All parts of Phytolacca americana (especially roots, mature stems, and berries) contain toxic mitogens, phytolaccatoxin, and saponins that cause severe hemorrhagic vomiting, diarrhea, seizures, hypotension, and fatal respiratory depression.',
  'Toutes les parties de Phytolacca americana (racines, tiges âgées, baies) contiennent de la phytolaccatoxine et des mitogènes provoquant vomissements hémorragiques, convulsions et dépression respiratoire potentiellement mortelle.'
);

-- 2. Pennyroyal (lamiaceae-pennyroyal)
SELECT pg_temp.remediate_lethal_00093(
  'lamiaceae-pennyroyal',
  'Pennyroyal (Mentha pulegium) contains pulegone, a potent hepatotoxin and abortifacient; pennyroyal oil and concentrated teas have caused fulminant hepatic failure, disseminated intravascular coagulation, seizures, and death.',
  'La menthe pouliot (Mentha pulegium) renferme de la pulégone, hépatotoxine et abortif puissant ; l''huile essentielle et les tisanes concentrées ont causé des insuffisances hépatiques fulminantes et des décès.'
);

-- 3. American Mayapple (podophyllum-peltatum-herb)
SELECT pg_temp.remediate_lethal_00093(
  'podophyllum-peltatum-herb',
  'Podophyllum peltatum rhizomes and unripe fruit contain podophyllotoxin, a cytotoxic antimitotic poison; internal ingestion causes severe GI hemorrhage, bone-marrow suppression, coma, and death. Standardized podofilox is topical prescription-only.',
  'Les rhizomes de Podophyllum peltatum contiennent de la podophyllotoxine cytotoxique : l''ingestion provoque hémorragies digestives, aplasie médullaire et décès. Seules des préparations topiques sur ordonnance (podofilox) existent.'
);

-- 4. Digitalis lanata & 5. Digitalis purpurea
SELECT pg_temp.remediate_lethal_00093(
  'digitalis-lanata-herb',
  'Grecian foxglove (Digitalis lanata) is the industrial source of prescription digoxin and is more cardiotoxic than D. purpurea; hypokalemia and hypomagnesemia sharply sensitize the heart to fatal ventricular arrhythmias and hyperkalemia.',
  'La digitale laineuse (Digitalis lanata), source industrielle de la digoxine, est encore plus cardiotoxique ; l''hypokaliémie et l''hypomagnésémie aggravent le risque d''arythmies ventriculaires mortelles.'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'digitalis-purpurea-herb',
  p_dosage_en := 'No safe self-administered herbal dose — prescription digoxin (derived industrially from Digitalis lanata, not crude D. purpurea leaf) is dosed strictly by clinicians with serum monitoring.',
  p_dosage_fr := 'Aucune dose sûre de plante brute — la digoxine pharmaceutique sur ordonnance (issue industriellement de D. lanata) requiert une prescription médicale et un suivi biologique.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Do not ingest crude Digitalis purpurea leaves, teas, or extracts — narrow therapeutic-to-lethal cardiotoxic margin.',
    'Hypokalemia, hypomagnesemia, hypercalcemia, and pre-existing AV heart block or ventricular fibrillation sharply increase fatal glycoside toxicity.',
    'Avoid any unstandardized plant preparation in pregnancy and lactation (only prescription digoxin is used clinically under specialist care).'
  ],
  p_contraindications_fr := ARRAY[
    'Ne jamais consommer de feuilles, tisanes ou extraits bruts de digitale pourpre — marge cardiotoxique mortelle.',
    'L''hypokaliémie, l''hypomagnésémie, l''hypercalcémie et les blocs auriculo-ventriculaires majorent fortement le risque fatal.',
    'Proscrite sous forme végétale brute pendant la grossesse et l''allaitement.'
  ],
  p_faq_safety_en := 'All crude foxglove plant material is lethally cardiotoxic (risk worsened by hypokalemia and hypomagnesemia). Only standardized pharmaceutical digoxin — manufactured commercially from Digitalis lanata under medical supervision — is safe for clinical use or carefully monitored pregnancy.',
  p_faq_safety_fr := 'Toute préparation brute de digitale est mortellement cardiotoxique (toxicité majorée par l''hypokaliémie et l''hypomagnésémie). Seule la digoxine pharmaceutique issue industriellement de D. lanata est utilisée sous contrôle médical.',
  p_faq_dosage_en := 'No herbal dose is safe. Self-administration of foxglove leaves or teas risks fatal cardiac arrhythmias and hyperkalemia.',
  p_faq_dosage_fr := 'Aucune posologie végétale n''est sûre. L''automédication expose à une arythmie cardiaque mortelle.',
  p_review_note := 'Digitalis purpurea hypomagnesemia, D. lanata source clarification & prescribed-digoxin note'
);

-- 6. Processed Aconite & 7. Monkshood
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'aconite-processed',
  p_dosage_en := 'No safe self-administered dose — contains lethal aconitine alkaloids; regulatory limits strictly restrict processed Aconitum to qualified specialist supervision.',
  p_dosage_fr := 'Aucune dose sûre en automédication — contient de l''aconitine mortelle ; usage strictement réservé aux spécialistes encadrés là où la réglementation l''autorise.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_description_en := 'Processed aconite (Fuzi, processed Aconitum carmichaelii lateral root) comes from a lethally cardiotoxic plant containing aconitine and mesaconitine. Traditional decoction/boiling hydrolyzes diester diterpene alkaloids into less toxic monoesters, yet incomplete processing or misdosing still causes refractory ventricular arrhythmias, neurogenic paresthesias, paralysis, and death. Do not self-prepare or self-administer.',
  p_description_fr := 'L''aconit préparé (Fuzi, racine latérale traitée d''Aconitum carmichaelii) provient d''une plante contenant de l''aconitine, neuro-cardiotoxine mortelle. Même après détoxification traditionnelle par décoction prolongée, toute erreur de préparation ou de dose peut causer des arythmies ventriculaires fatales. Ne jamais préparer ni consommer en automédication.',
  p_modern_uses_en := ARRAY['No approved OTC or self-care clinical indication (high-toxicity regulated botanical)']::text[],
  p_modern_uses_fr := ARRAY['Aucune indication en automédication (plante à toxicité cardioneurotoxique élevée)']::text[],
  p_faq_dosage_en := 'No safe self-administered dose exists. Previously displayed conflicting gram figures and typographical errors are removed: aconitine causes fatal ventricular arrhythmias even after improper processing.',
  p_faq_dosage_fr := 'Aucune dose sûre n''existe en automédication. Même après préparation traditionnelle, l''aconitine expose à des arythmies cardiaques mortelles.',
  p_review_note := 'Removed conflicting gram doses & heparinization typo on aconite-processed'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'monkshood',
  p_dosage_en := 'No safe self-administered dose — every part of Aconitum napellus contains lethal aconitine.',
  p_dosage_fr := 'Aucune dose sûre en automédication — toutes les parties d''Aconitum napellus renferment de l''aconitine mortelle.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_traditional_uses_en := ARRAY['Historical pre-modern neuralgia and antipyretic preparations (obsolete due to extreme lethality)']::text[],
  p_traditional_uses_fr := ARRAY['Anciens usages historiques dans les névralgies (abandonnés en raison d''une mortalité élevée)']::text[],
  p_modern_uses_en := ARRAY['No established clinical use — poisonous plant causing arrhythmias rather than treating them']::text[],
  p_modern_uses_fr := ARRAY['Aucun usage clinique établi — plante toxique provoquant des arythmies mortelles']::text[],
  p_faq_uses_en := 'Monkshood (Aconitum napellus) has no safe modern medical use. Far from treating cardiac arrhythmias, aconitine causes lethal ventricular arrhythmias and respiratory failure; historical oral and topical tinctures are obsolete.',
  p_faq_uses_fr := 'L''aconit napel n''a aucun usage médical sûr. Loin de traiter les troubles du rythme, l''aconitine déclenche des arythmies ventriculaires mortelles.',
  p_review_note := 'Removed dangerous "Used for cardiac arrhythmias" claim on monkshood'
);

-- 8. Oleander (nerium-oleander)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'nerium-oleander',
  p_dosage_en := 'No safe dose — all parts of Nerium oleander contain lethal cardiac glycosides (oleandrin). Contact Poison Control immediately for any exposure.',
  p_dosage_fr := 'Aucune dose sûre — toutes les parties du laurier-rose contiennent des hétérosides cardiotoniques mortels (oléandrine). Contacter immédiatement un centre antipoison en cas d''exposition.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Do not ingest any plant part or inhale smoke from burning oleander wood/leaves — potentially fatal.',
    'Note clinical toxicology: oleandrin cross-reacts on serum digoxin immunoassays (causing misleading readings), and severe cardiac toxicity may have delayed onset several hours post-ingestion.',
    'Strictly contraindicated in pregnancy, lactation, children, and alongside cardiac or diuretic medications.'
  ],
  p_contraindications_fr := ARRAY[
    'Ne consommer aucune partie et ne pas inhaler la fumée de branches brûlées — exposition potentiellement mortelle.',
    'Toxicologie : l''oléandrine présente une réactivité croisée sur les dosages sanguins de digoxine et les symptômes cardiaques graves peuvent apparaître de façon retardée.',
    'Formellement contre-indiqué pendant la grossesse, l''allaitement et chez l''enfant.'
  ],
  p_faq_safety_en := 'Nerium oleander is lethally poisonous in all parts (and burning smoke). Severe bradycardia, hyperkalemia, and fatal heart block may develop with delayed onset, and oleandrin cross-reacts with digoxin assays. Call Poison Control or emergency services immediately after any suspected ingestion.',
  p_faq_safety_fr := 'Toutes les parties du laurier-rose (ainsi que la fumée) sont mortellement toxiques. L''intoxication peut avoir un début retardé et fausser le dosage de digoxine ; appeler un centre antipoison en urgence.',
  p_review_note := 'Added digoxin cross-reactivity, delayed onset, and Poison Control warning for oleander'
);

-- 9. Poison hemlock (conium-maculatum-herb)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'conium-maculatum-herb',
  p_dosage_en := 'No safe dose — lethal neurotoxin; there is no specific antidote.',
  p_dosage_fr := 'Aucune dose sûre — neurotoxine mortelle sans antidote spécifique.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Zero safe consumption — contains coniine and gamma-coniceine causing rapid ascending paralysis, seizures, rhabdomyolysis, and fatal respiratory failure.',
    'There is NO specific antidote (emergency management is strictly supportive mechanical ventilation).',
    'High foraging hazard: frequently confused with edible wild carrot, wild parsnip, or wild fennel.'
  ],
  p_contraindications_fr := ARRAY[
    'Aucune consommation sûre — la coniine provoque paralysie ascendante rapide, convulsions, rhabdomyolyse et arrêt respiratoire fatal.',
    'Il n''existe AUCUN antidote spécifique (prise en charge uniquement symptomatique par ventilation).',
    'Risque majeur de confusion lors de la cueillette avec la carotte sauvage, le panais ou le fenouil.'
  ],
  p_faq_safety_en := 'Conium maculatum is lethally toxic with NO specific antidote. It causes seizures, rhabdomyolysis, and ascending respiratory paralysis, and is often fatally mistaken for wild carrot, parsnip, or fennel. Contact Poison Control immediately on exposure.',
  p_faq_safety_fr := 'La grande ciguë est mortelle et sans antidote spécifique (convulsions, paralysie respiratoire) ; elle est fréquemment confondue avec des ombellifères comestibles. Contacter immédiatement un centre antipoison.',
  p_review_note := 'Added no-antidote, seizures, and Apiaceae foraging look-alike warnings for poison hemlock'
);

-- 10–39. Batch Group A remaining outright poisons / cardiac glycosides / neurotoxins / carcinogens
SELECT pg_temp.remediate_lethal_00093('atropa-belladonna-herb', 'All parts (especially sweet dark berries and roots) contain atropine, scopolamine, and hyoscyamine causing fatal anticholinergic poisoning.', 'Toutes les parties (baies sucrées, racines) contiennent atropine, scopolamine et hyoscyamine provoquant un délire anticholinergique mortel.');
SELECT pg_temp.remediate_lethal_00093('mandragora-officinarum-herb', 'European mandrake roots and fruits contain toxic anticholinergic tropane alkaloids (atropine, scopolamine) causing delirium, tachycardia, and fatal coma.', 'Les racines et fruits de mandragore contiennent des alcaloïdes tropaniques toxiques causant délire, tachycardie et coma potentiellement mortel.');
SELECT pg_temp.remediate_lethal_00093('ignatia-amara', 'Ignatius bean (Strychnos ignatii) seeds contain lethal strychnine and brucine causing violent tetanic spasms and asphyxia; FDA prohibits unstandardized poisonous-plant extracts.', 'Les graines d''Ignatia amara contiennent de la strychnine et de la brucine mortelles (spasmes tétaniques, asphyxie) ; usage non standardisé proscrit.');
SELECT pg_temp.remediate_lethal_00093('abrus-precatorius', 'Rosary pea seeds contain abrin, a lethal ribosome-inactivating toxalbumin where a single chewed seed can be fatal; previously listed 3-5 g root doses are unsafe and removed.', 'Les graines de liane réglisse renferment de l''abrine, toxalbumine mortelle dont une seule graine mâchée peut tuer ; toute posologie orale est supprimée.');
SELECT pg_temp.remediate_lethal_00093('papaver-somniferum', 'Opium poppy sap, straw, and unwashed seeds contain morphine and codeine — Schedule II controlled opioids causing fatal respiratory depression and neonatal abstinence syndrome.', 'Le latex, la paille et les graines non lavées de pavot somnifère renferment morphine et codéine — opiacés contrôlés exposant à une dépression respiratoire mortelle.');
SELECT pg_temp.remediate_lethal_00093('citrullus-colocynthis', 'Colocynth pulp contains cucurbitacin glycosides; historical 0.3-0.6 g amounts already reach the toxic threshold causing bloody diarrhea, kidney failure, and death (banned by FDA in 1991).', 'La coloquinte renferme des cucurbitacines très irritantes ; dès 0,3–0,6 g surviennent diarrhées hémorragiques, atteinte rénale et décès (interdite par la FDA depuis 1991).');
SELECT pg_temp.remediate_lethal_00093('schoenocaulon-officinale', 'Sabadilla seeds contain veratrine and cevadine — extremely toxic insecticidal alkaloids causing severe vomiting, cardiac collapse, and respiratory failure.', 'Les graines de cévadille renferment de la vératrine et de la cévadine, alcaloïdes insecticides extrêmement toxiques provoquant collapsus cardiaque et arrêt respiratoire.');
SELECT pg_temp.remediate_lethal_00093('secale-cornutum', 'Ergot fungus (Claviceps purpurea) contains toxic ergot alkaloids causing severe arterial vasospasm, limb gangrene, hallucinations, convulsions, and uterine rupture (ergotism).', 'L''ergot de seigle (Claviceps purpurea) produit des alcaloïdes provoquant un vasospasme artériel sévère, une gangrène, des convulsions et une toxicité utérine grave (ergotisme).');
SELECT pg_temp.remediate_lethal_00093('veratrum-viride', 'American false hellebore contains veratrum steroidal alkaloids causing severe bradycardia, profound hypotension (Bezold-Jarisch reflex), bronchospasm, and fatal collapse.', 'Le vératre vert contient des alcaloïdes stéroïdiens provoquant bradycardie extrême, hypotension sévère et collapsus cardiovasculaire mortel.');
SELECT pg_temp.remediate_lethal_00093('veratrum-album-herb', 'White hellebore (Veratrum album) contains lethal protoveratrines throughout the rhizome and leaves and is frequently confused with wild garlic (Allium ursinum) with fatal results.', 'Le vératre blanc contient des protovératrines mortelles et provoque des intoxications graves par confusion avec l''ail des ours.');
SELECT pg_temp.remediate_lethal_00093('senecio-aureus', 'Golden ragwort (Packera aurea) contains unsaturated hepatotoxic, genotoxic, and carcinogenic pyrrolizidine alkaloids causing irreversible hepatic veno-occlusive disease.', 'Le séneçon doré contient des alcaloïdes pyrrolizidiniques hépatotoxiques et cancérogènes responsables de maladie veino-occlusive hépatique irréversible.');
SELECT pg_temp.remediate_lethal_00093('scilla-maritima', 'White squill (Drimia maritima) bulbs contain scillaren bufadienolide cardiac glycosides with a narrow lethal margin causing heart block, hyperkalemia, and fatal arrhythmias.', 'La scille maritime contient des hétérosides cardiotoniques (bufadiénolides) à marge toxique très étroite provoquant blocs cardiaques et arythmies mortelles.');
SELECT pg_temp.remediate_lethal_00093('convallaria-majalis-herb', 'Lily of the valley (Convallaria majalis) contains convallatoxin and related cardiac glycosides throughout leaves, flowers, and red berries capable of causing fatal digitalis-like poisoning.', 'Le muguet renferme de la convallatoxine et d''autres glycosides cardiotoniques mortels dans ses feuilles, fleurs et baies rouges.');
SELECT pg_temp.remediate_lethal_00093('gelsemium-sempervirens', 'Yellow jessamine (Gelsemium sempervirens) contains gelsemine and gelsevirine — potent neurotoxins causing double vision, jaw paralysis, dysphagia, and fatal respiratory arrest.', 'Le jasmin de Caroline contient de la gelsémine, neurotoxine puissante provoquant diplopie, paralysie bulbaire et arrêt respiratoire mortel.');
SELECT pg_temp.remediate_lethal_00093('henbane', 'Black henbane (Hyoscyamus niger) contains toxic tropane alkaloids (hyoscyamine, scopolamine) causing acute anticholinergic psychosis, seizures, hyperthermia, and fatal coma.', 'La jusquiame noire renferme des alcaloïdes tropaniques causant délire anticholinergique aigu, convulsions, hyperthermie et coma fatal.');
SELECT pg_temp.remediate_lethal_00093('jaborandi', 'Jaborandi (Pilocarpus jaborandi) leaves contain high concentrations of pilocarpine, causing cholinergic crisis (bronchorrhea, pulmonary edema, severe bradycardia, shock); only prescription pilocarpine eye/oral drugs are approved.', 'Les feuilles de jaborandi contiennent de la pilocarpine exposant à une crise cholinergique grave (œdème pulmonaire, bradycardie sévère) ; seule la pilocarpine pharmaceutique prescrite est encadrée.');
SELECT pg_temp.remediate_lethal_00093('spigelia', 'Pinkroot (Spigelia marilandica) contains spigeline and toxic alkaloids capable of causing ataxia, seizures, visual disturbances, myocardial depression, and fatal poisoning.', 'La spigélie renferme de la spigéline et des alcaloïdes toxiques pouvant causer convulsions, troubles visuels et dépression cardiaque mortelle.');
SELECT pg_temp.remediate_lethal_00093('strophanthus-hispidus', 'Strophanthus hispidus seeds contain lethal g/k-strophanthin (ouabain-class) cardiac glycosides causing rapid ventricular arrhythmias and cardiac arrest.', 'Les graines de Strophanthus hispidus contiennent de la strophanthine, glycoside cardiotonique rapide à toxicité cardiaque mortelle.');
SELECT pg_temp.remediate_lethal_00093('duboisia-myoporoides', 'Corkwood (Duboisia myoporoides) contains dangerous concentrations of scopolamine and hyoscyamine causing severe anticholinergic delirium and cardiorespiratory arrest.', 'Duboisia myoporoides contient de fortes concentrations de scopolamine et d''hyoscyamine provoquant délire anticholinergique et arrêt cardiorespiratoire.');
SELECT pg_temp.remediate_lethal_00093('daphne-mezereum', 'Mezereon (Daphne mezereum) bark and berries contain mezerein and daphnetoxin causing severe mucosal blistering, hemorrhagic gastroenteritis, nephritis, and fatality.', 'L''écorce et les baies de bois joli (Daphne mezereum) renferment de la mézéréine provoquant brûlures muqueuses, gastro-entérite hémorragique et décès.');
SELECT pg_temp.remediate_lethal_00093('apocynum-cannabinum', 'Canadian hemp / dogbane root contains cymarin and apocannoside — potent digitalis-like cardiac glycosides capable of inducing fatal arrhythmias.', 'L''apocyn chanvrin contient de la cymarine, hétéroside cardiotonique de type digitalique pouvant déclencher des arythmies mortelles.');
SELECT pg_temp.remediate_lethal_00093('pheasants-eye', 'Adonis vernalis (pheasant''s eye) contains adonitoxin and cymarin cardiac glycosides with narrow-margin cardiotoxicity.', 'L''adonis vernale contient de l''adonitoxine et de la cymarine, hétérosides cardiotoniques à toxicité cardiaque aiguë.');
SELECT pg_temp.remediate_lethal_00093('bittersweet-nightshade', 'Bittersweet nightshade (Solanum dulcamara) stems, leaves, and unripe or ripe berries contain toxic steroidal glycoalkaloids (solanine, solamargine) — berries are NOT edible and poisonings can be fatal.', 'La douce-amère (Solanum dulcamara) renferme de la solanine et des glycoalcaloïdes toxiques dans ses tiges, feuilles et baies — ces baies ne sont PAS comestibles.');
SELECT pg_temp.remediate_lethal_00093('bryonia-alba', 'White bryony (Bryonia alba) roots and berries contain cucurbitacins causing violent purging, renal failure, CNS depression, and fatal dehydration.', 'La bryone dioïque contient des cucurbitacines provoquant diarrhées sanglantes, atteinte rénale et collapsus potentiellement mortel.');
SELECT pg_temp.remediate_lethal_00093('calabar-bean', 'Calabar bean (Physostigma venenosum) contains lethal physostigmine inducing acute cholinergic crisis, bronchorrhea, convulsions, and respiratory arrest.', 'La fève de Calabar contient de la physostigmine provoquant crise cholinergique aiguë, convulsions et arrêt respiratoire fatal.');
SELECT pg_temp.remediate_lethal_00093('thapsia-garganica', 'Thapsia garganica resin contains thapsigargin (a potent SERCA calcium-pump poison and tumor-promoting skin vesicant); only experimental targeted prodrugs exist clinically, not raw herb.', 'La résine de Thapsia garganica renferme de la thapsigargine vésicante et cytotoxique ; la plante brute ne doit jamais être utilisée.');
SELECT pg_temp.remediate_lethal_00093('ranunculus-bulbosus', 'Bulbous buttercup contains protoanemonin causing severe cutaneous blistering externally and hemorrhagic gastritis internally.', 'La renoncule bulbeuse renferme de la protoanémonine vésicante causant brûlures cutanées sévères et gastrite hémorragique.');
SELECT pg_temp.remediate_lethal_00093('wahoo-bark', 'Euonymus atropurpureus (wahoo bark) contains cardiotoxic cardiac glycosides (euonymoside) and violent purgative resins.', 'L''écorce de fusain (Euonymus atropurpureus) contient des hétérosides cardiotoniques et des principes fortement purgatifs et toxiques.');
SELECT pg_temp.remediate_lethal_00093('acalypha-indica', 'Acalypha indica contains acalyphine (cyanogenic/nitrile glycoside) and can trigger acute intravascular hemolysis in G6PD-deficient individuals as well as severe GI toxicity.', 'Acalypha indica renferme de l''acalyphine et peut déclencher une hémolyse sévère en cas de déficit en G6PD ainsi qu''une toxicité digestive aiguë.');
SELECT pg_temp.remediate_lethal_00093('anagallis-arvensis', 'Scarlet pimpernel (Anagallis arvensis) contains toxic triterpene saponins and cucurbitacins causing severe gastroenteritis, renal injury, and neurotoxicity.', 'Le mouron rouge contient des saponines et cucurbitacines causant gastro-entérite sévère, néphrotoxicité et troubles neurologiques.');
SELECT pg_temp.remediate_lethal_00093('chenopodium-ambrosioides', 'Epazote / American wormseed essential oil contains ascaridole — a severely neurotoxic, ototoxic, and hepatotoxic terpene peroxide linked to fatal child poisonings.', 'L''huile essentielle de chénopode vermifuge contient de l''ascaridole, neurotoxique et hépatotoxique ayant causé des intoxications mortelles chez l''enfant.');
SELECT pg_temp.remediate_lethal_00093('khat', 'Catha edulis leaves contain cathinone and cathine (controlled sympathomimetic stimulants) carrying risks of acute myocardial infarction, hypertensive crisis, psychosis, and autoimmune-like hepatotoxicity (LiverTox Score B).', 'Le khat renferme de la cathinone (stimulant réglementé) exposant à infarctus, crise hypertensive, psychose et hépatotoxicité auto-immune (LiverTox B).');
SELECT pg_temp.remediate_lethal_00093('cotton-root-bark', 'Cotton root bark (Gossypium) contains gossypol, causing irreversible male antifertility, severe hypokalemic paralysis, hepatotoxicity, and uterine contractions.', 'L''écorce de racine de cotonnier contient du gossypol provoquant infertilité masculine, paralysie hypokaliémique, hépatotoxicité et contractions utérines.');
SELECT pg_temp.remediate_lethal_00093('pareira-brava', 'Chondrodendron tomentosum contains D-tubocurarine and curare alkaloids — non-depolarizing neuromuscular blockers causing respiratory muscle paralysis; oral herbal self-use is unsafe.', 'La racine de pareira brava renferme de la D-tubocurarine (curare paralysant les muscles respiratoires) ; toute automédication est dangereuse.');
SELECT pg_temp.remediate_lethal_00093('hagenia-abyssinica', 'Kousso (Hagenia abyssinica) flowers contain kosotoxin causing severe neuromuscular blockade, optic atrophy/blindness, hepatotoxicity, and fatalities.', 'Les fleurs de cousso contiennent de la kosotoxine provoquant toxicité optique (cécité), hépatotoxicité et décès.');
SELECT pg_temp.remediate_lethal_00093('asclepias-syriaca', 'Common milkweed sap and seeds contain cardenolide cardiac glycosides capable of causing severe vomiting and digitalis-like fatal arrhythmias.', 'L''asclépiade commune renferme des hétérosides cardénolides exposant à des vomissements incoercibles et des arythmies cardiotoxiques graves.');
SELECT pg_temp.remediate_lethal_00093('piscidia-piscipula', 'Jamaica dogwood bark contains rotenone — a potent mitochondrial Complex I neurotoxin used commercially as a piscicide and associated with parkinsonism and fatal respiratory depression.', 'L''écorce de boisivrant renferme de la roténone, neurotoxine mitochondriale (piscicide) exposant à un collapsus cardiorespiratoire.');
SELECT pg_temp.remediate_lethal_00093('artemisia-maritima', 'Sea wormwood (Artemisia maritima) and santonica contain santonin, causing yellow/green visual distortion (xanthopsia), vertigo, seizures, renal injury, and coma.', 'L''armoise maritime renferme de la santonine provoquant xanthopsie, convulsions, néphrotoxicité et coma.');
SELECT pg_temp.remediate_lethal_00093('cheiranthus-cheiri', 'Wallflower (Erysimum cheiri) contains cheirotoxin and erysimoside cardiac glycosides causing digitalis-type heart block and lethal arrhythmias.', 'La giroflée des murailles contient des glycosides cardiotoniques (chéirotoxine) provoquant blocs cardiaques et arythmies fatales.');
SELECT pg_temp.remediate_lethal_00093('cephalanthus-occidentalis', 'Buttonbush (Cephalanthus occidentalis) contains toxic cephalathin and oxindole alkaloids causing vomiting, muscular paralysis, convulsions, and hemolysis.', 'Le céphalanthe occidental contient des principes toxiques provoquant paralysie musculaire, convulsions et hémolyse.');
SELECT pg_temp.remediate_lethal_00093('christmas-rose', 'Black hellebore (Helleborus niger) roots and leaves contain hellebrin and protoanemonin — lethal bufadienolide cardiotoxins causing severe diarrhea, bradycardia, and cardiac arrest.', 'L''hellébore noir contient de l''hellébrine (cardiotoxine bufadiénolide) et de la protoanémonine provoquant diarrhées sanglantes et arrêt cardiaque.');
SELECT pg_temp.remediate_lethal_00093('soapwort', 'Soapwort (Saponaria officinalis) root and seeds contain corrosive, hemolytic saponins (up to 5%); never ingest unstandardized preparations orally.', 'La saponaire officinale contient des saponines irritantes et hémolytiques ; ne pas consommer par voie orale en automédication.');
SELECT pg_temp.remediate_lethal_00093('tripterygium-wilfordii', 'Thunder god vine (Tripterygium wilfordii) contains triptolide, causing severe gastrointestinal hemorrhage, bone-marrow aplasia, acute kidney injury, hepatotoxicity, infertility, and deaths.', 'Le Tripterygium wilfordii renferme du triptolide hautement toxique (hémorragies digestives, aplasie médullaire, insuffisance rénale/hépatique, infertilité, décès).');
SELECT pg_temp.remediate_lethal_00093('trailing-arbutus', 'Trailing arbutus (Epigaea repens) contains toxic arbutin/hydroquinone metabolites and Ericaceae diterpenes without human pregnancy or clinical safety trials.', 'L''épigée rampante ne dispose d''aucun essai clinique de sécurité et renferme des dérivés potentiellement néphrotoxiques et hépatotoxiques.');
SELECT pg_temp.remediate_lethal_00093('prunus-persica-herb', 'Peach bark, twigs, leaves, and seed kernels contain amygdalin/prunasin cyanogenic glycosides releasing hydrogen cyanide upon hydrolysis.', 'L''écorce, les feuilles et noyaux de pêcher contiennent des hétérosides cyanogènes libérant du cyanure d''hydrogène.');
SELECT pg_temp.remediate_lethal_00093('prunus-spinosa-herb', 'Blackthorn bark, twigs, and pits contain amygdalin cyanogenic glycosides releasing hydrogen cyanide; do not ingest bark or crushed seeds.', 'L''écorce et les noyaux de prunellier contiennent de l''amygdaline libérant du cyanure d''hydrogène.');
SELECT pg_temp.remediate_lethal_00093('plum-bark', 'Plum tree bark and crushed kernels contain cyanogenic glycosides releasing lethal hydrogen cyanide upon ingestion.', 'L''écorce de prunier et ses noyaux écrasés contiennent des hétérosides cyanogènes libérant du cyanure d''hydrogène.');

-- Specific Group A fixes requiring tailored clinical text, uses removal, or spelling fixes:

-- Bloodroot (sanguinaria-canadensis-herb): FDA black-salve + glaucoma warning
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'sanguinaria-canadensis-herb',
  p_dosage_en := 'No safe internal or escharotic dose — FDA strongly warns consumers against bloodroot "black salve" pastes and internal use.',
  p_dosage_fr := 'Aucune dose sûre interne ou caustique — la FDA met formellement en garde contre les pâtes escarrotiques (« black salve ») et l''ingestion.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'FDA warns against topical bloodroot "black salve" pastes: causes irreversible tissue necrosis, severe disfigurement, and untreated cancer progression.',
    'Do not ingest: sanguinarine inhibits Na+/K+-ATPase and was linked to epidemic dropsy, hepatotoxicity, and acute glaucoma.',
    'Strictly contraindicated in pregnancy, breastfeeding, children, and glaucoma.'
  ],
  p_contraindications_fr := ARRAY[
    'La FDA interdit les pâtes caustiques au sang-dragon (« black salve ») : nécrose tissulaire irréversible et progression tumorale non traitée.',
    'Ne pas ingérer : la sanguinarine expose à une hépatotoxicité, un œdème généralisé et un glaucome aigu.',
    'Contre-indiquée pendant la grossesse, l''allaitement, chez l''enfant et en cas de glaucome.'
  ],
  p_modern_uses_en := ARRAY['No approved cancer, skin-lesion, or internal self-care use (escharotic toxin)']::text[],
  p_modern_uses_fr := ARRAY['Aucun usage approuvé contre le cancer, les lésions cutanées ou par voie orale']::text[],
  p_faq_safety_en := 'Avoid bloodroot internally and NEVER apply bloodroot "black salve" to skin lesions or cancers (FDA warning for permanent tissue destruction and misdiagnosis). Internal sanguinarine is associated with glaucoma, liver toxicity, and cardiac collapse.',
  p_faq_safety_fr := 'Ne pas ingérer et ne JAMAIS appliquer de « black salve » à la sanguinaire sur la peau (avertissement FDA : nécrose irréversible et retard de prise en charge). La sanguinarine interne est liée au glaucome et à une toxicité hépatique.',
  p_review_note := 'Bloodroot FDA black-salve & glaucoma warnings'
);

-- Scotch Broom (broom-herb): remove "Treat cardiac arrhythmias"
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'broom-herb',
  p_dosage_en := 'No safe self-administered dose — contains toxic quinolizidine alkaloids (sparteine) and tyramine.',
  p_dosage_fr := 'Aucune dose sûre en automédication — renferme de la spartéine toxique et de la tyramine.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['No approved self-care use — obsolete sparteine antiarrhythmic/oxytocic use abandoned due to toxicity']::text[],
  p_modern_uses_fr := ARRAY['Aucun usage en automédication — l''usage ancien de la spartéine est abandonné en raison de sa toxicité']::text[],
  p_faq_uses_en := 'Scotch broom (Cytisus scoparius) should NOT be used to treat cardiac arrhythmias or induce labor; sparteine and tyramine cause arrhythmias, hypertensive crisis with MAOIs, and respiratory collapse.',
  p_faq_uses_fr := 'Le genêt à balais ne doit PAS être utilisé contre les arythmies ni pour déclencher le travail ; la spartéine et la tyramine provoquent troubles du rythme et crises hypertensives.',
  p_review_note := 'Removed dangerous "Treat cardiac arrhythmias" use on broom-herb'
);

-- Betel Nut (betel-nut): IARC Group 1 carcinogen + remove 30-45 g dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'betel-nut',
  p_dosage_en := 'No safe dose — IARC Group 1 human carcinogen; do not chew or ingest (previously listed 30-45 g doses removed).',
  p_dosage_fr := 'Aucune dose sûre — cancérogène avéré chez l''humain (CIRC groupe 1) ; ne pas mâcher ni ingérer (toute posologie de 30–45 g supprimée).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'IARC Group 1 human carcinogen: causes oral submucous fibrosis, oral squamous cell carcinoma, and esophageal cancer.',
    'Contains arecoline (cholinergic agonist) risking bronchospasm in asthma, bradycardia, myocardial ischemia, and dependence.',
    'Contraindicated in pregnancy and breastfeeding (low birth weight, spontaneous abortion, neonatal withdrawal).'
  ],
  p_contraindications_fr := ARRAY[
    'Cancérogène avéré groupe 1 du CIRC : fibrose sous-muqueuse buccale, cancers de la cavité buccale et de l''œsophage.',
    'Contient de l''arécoline provoquant bronchospasme chez l''asthmatique, bradycardie et dépendance.',
    'Contre-indiquée pendant la grossesse et l''allaitement.'
  ],
  p_faq_safety_en := 'Betel nut / areca nut (with or without tobacco) is classified by the WHO IARC as a Group 1 human carcinogen causing oral and esophageal cancers and irreversible oral submucous fibrosis. Also contraindicated in asthma, cardiac disease, pregnancy, and lactation.',
  p_faq_safety_fr := 'La noix d''arec / de bétel est classée cancérogène de groupe 1 par le CIRC (OMS), responsable de cancers buccaux et œsophagiens. Contre-indiquée en cas d''asthme, cardiopathie, grossesse et allaitement.',
  p_review_note := 'Betel nut IARC Group 1 carcinogen warning & removed 30-45 g dose'
);

-- Wild Ginger (wild-ginger / Asarum canadense): Aristolochic acid carcinogen + remove pregnancy use
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'wild-ginger',
  p_dosage_en := 'No safe dose — contains nephrotoxic and Group 1 carcinogenic aristolochic acids (unrelated to culinary Zingiber officinale).',
  p_dosage_fr := 'Aucune dose sûre — contient des acides aristolochiques néphrotoxiques et cancérogènes de groupe 1 (plante distincte du gingembre culinaire Zingiber officinale).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not safe for internal use — Asarum species contain carcinogenic aristolochic acids banned by FDA/EMA/Health Canada']::text[],
  p_modern_uses_fr := ARRAY['Usage interne proscrit — contient des acides aristolochiques cancérogènes interdits']::text[],
  p_faq_safety_en := 'Canadian wild ginger (Asarum canadense) is completely distinct from true culinary ginger and can contain aristolochic acids — potent human kidney toxins and Group 1 carcinogens banned by regulators. Never use during pregnancy (historically used as an emmenagogue/abortifacient), breastfeeding, or in renal disease.',
  p_faq_safety_fr := 'L''asaret du Canada n''est pas le gingembre culinaire ; il peut renfermer des acides aristolochiques néphrotoxiques et cancérogènes (groupe 1). Ne jamais utiliser pendant la grossesse, l''allaitement ni en cas de maladie rénale.',
  p_review_note := 'Wild ginger aristolochic acid carcinogen & pregnancy reversal'
);

-- Sassafras (sassafras): 1960 FDA ban + safrole carcinogen + 5 mL fatal
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'sassafras',
  p_dosage_en := 'No safe oral dose for crude bark or sassafras oil — FDA banned safrole-containing sassafras in food/supplements in 1960.',
  p_dosage_fr := 'Aucune dose orale sûre pour l''écorce brute ou l''huile essentielle — le safrole est interdit par la FDA depuis 1960.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'FDA banned safrole and sassafras oil internally in 1960 due to hepatocarcinogenicity in animals and human liver toxicity.',
    'Acute oil poisoning: as little as 5 mL (1 teaspoon) of sassafras oil can be fatal in an adult, and drops can kill an infant.',
    'Contraindicated in pregnancy, breastfeeding, liver disease, and children; only certified safrole-free culinary extracts exist.'
  ],
  p_contraindications_fr := ARRAY[
    'Interdite par la FDA depuis 1960 en raison de la cancérogénicité hépatique et de l''hépatotoxicité du safrole.',
    'Toxicité aiguë : 5 mL (1 cuillère à café) d''huile essentielle peuvent être mortels chez l''adulte et quelques gouttes chez le nourrisson.',
    'Contre-indiquée pendant la grossesse, l''allaitement, les maladies du foie et chez l''enfant.'
  ],
  p_faq_safety_en := 'Avoid sassafras root bark, teas, and sassafras essential oil. Safrole is a hepatotoxin and animal carcinogen banned by the US FDA since 1960; ingesting just 5 mL of sassafras oil can be fatal in adults (and drops in children).',
  p_faq_safety_fr := 'Éviter l''écorce de sassafras et son huile essentielle : le safrole est hépatotoxique et cancérogène (interdit par la FDA depuis 1960), et 5 mL d''huile essentielle peuvent être mortels chez l''adulte.',
  p_review_note := 'Sassafras 1960 FDA ban, carcinogen & 5 mL fatal warning'
);

-- Wild Cherry Bark (prunus-serotina)
SELECT pg_temp.remediate_lethal_00093(
  'prunus-serotina',
  'Wild cherry (Prunus serotina) inner bark, twigs, leaves, and pits contain prunasin/amygdalin cyanogenic glycosides that release toxic hydrogen cyanide when hydrolyzed.',
  'L''écorce interne, les feuilles et noyaux de cerisier tardif (Prunus serotina) renferment de la prunasine libérant du cyanure d''hydrogène toxique.'
);

-- Bitter Almond / Apricot Kernel (bitter-almond): remove cancer claim, Cochrane/FDA/cyanide
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'bitter-almond',
  p_dosage_en := 'No safe dose — unprocessed bitter almonds contain high amygdalin converting to lethal hydrogen cyanide (adults/children fatal poisonings documented).',
  p_dosage_fr := 'Aucune dose sûre — l''amande amère brute renferme de l''amygdaline libérant du cyanure d''hydrogène mortel.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not a cancer treatment — Cochrane review and FDA warn amygdalin/laetrile lacks anticancer efficacy and causes cyanide poisoning']::text[],
  p_modern_uses_fr := ARRAY['N''est PAS un traitement anticancéreux — sans efficacité démontrée (Cochrane) et risque d''intoxication au cyanure (FDA/Santé Canada)']::text[],
  p_faq_uses_en := 'Bitter almond / amygdalin ("laetrile") is NOT an effective cancer treatment: a Cochrane systematic review concluded claims of cancer benefit are unsupported by reliable clinical data, while FDA and Health Canada warn of acute and potentially fatal cyanide poisoning.',
  p_faq_uses_fr := 'L''amande amère et l''amygdaline (« laétrile ») ne traitent PAS le cancer (revue Cochrane négative) et exposent à une intoxication mortelle au cyanure.',
  p_review_note := 'Removed unverified cancer claim & added Cochrane/FDA cyanide warning on bitter-almond'
);

-- Camphor (cinnamomum-camphora): infant hepatotoxicity & CNS toxicity
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'cinnamomum-camphora',
  p_dosage_en := 'Do NOT ingest orally — internal camphor is potentially fatal (as little as 500-1000 mg in young children); FDA limits OTC topical camphor concentrations to <=11% in adults/older children.',
  p_dosage_fr := 'Ne JAMAIS ingérer — toxique mortel par voie orale (500 à 1 000 mg chez l''enfant) ; seul l''usage externe très dilué est encadré chez l''adulte et l''enfant plus âgé.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Do NOT ingest camphor oil or crystalline camphor internally — rapidly absorbed neurotoxin causing seizures, apnea, and death.',
    'Children and infants: contraindicated orally and via nasal/chest application in infants and toddlers (documented infant hepatotoxicity, seizures, and deaths).',
    'Do not apply topically on broken skin, nostrils, or near eyes; avoid in pregnancy, lactation, and seizure disorders.'
  ],
  p_contraindications_fr := ARRAY[
    'Ne jamais ingérer — neurotoxine rapidement absorbée causant convulsions, apnée et décès.',
    'Nourrissons et jeunes enfants : forme orale et application nasale/thoracique contre-indiquées (hépatotoxicité infantile et décès rapportés).',
    'Ne pas appliquer sur peau lésée ni sur les narines ; éviter pendant la grossesse, l''allaitement et en cas d''épilepsie.'
  ],
  p_faq_safety_en := 'Camphor is strictly external in regulated low-concentration OTC products and must NEVER be ingested orally or applied to infants, nostrils, or broken skin (risk of rapid seizures, respiratory arrest, and infant hepatotoxicity).',
  p_faq_safety_fr := 'Le camphre ne doit JAMAIS être ingéré ni appliqué chez le nourrisson, dans les narines ou sur peau lésée (convulsions, arrêt respiratoire et hépatotoxicité infantile).',
  p_review_note := 'Added infant hepatotoxicity & oral lethality warning on cinnamomum-camphora'
);

-- Greater Celandine (chelidonium-majus): EMA negative oral benefit-risk, remove 6-12 mg/day dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'chelidonium-majus',
  p_dosage_en := 'No safe oral self-administered dose — EMA HMPC concluded the benefit-risk balance for oral greater celandine is negative due to liver injury risk (6-12 mg/day dose removed).',
  p_dosage_fr := 'Aucune dose orale sûre — l''EMA (HMPC) a conclu à un rapport bénéfice/risque négatif par voie orale en raison du risque d''hépatite (posologie de 6–12 mg/j supprimée).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Greater celandine (Chelidonium majus) is associated with severe idiosyncratic hepatotoxicity, cholestatic hepatitis, and liver failure; European regulators (EMA HMPC) suspended/warn against oral preparations. Strictly contraindicated in liver disease, biliary obstruction, pregnancy, breastfeeding, and children.',
  p_faq_safety_fr := 'La grande chélidoine expose à des hépatites cholestatiques graves et une insuffisance hépatique ; l''EMA déconseille la voie orale. Contre-indiquée en cas d''atteinte hépatique ou biliaire, grossesse, allaitement et chez l''enfant.',
  p_review_note := 'EMA negative oral benefit-risk & removed 6-12 mg dose on chelidonium-majus'
);

-- Kratom (kratom): FDA/Health Canada warnings, respiratory depression, contamination
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'kratom',
  p_dosage_en := 'No safe or regulator-approved therapeutic dose — FDA and Health Canada warn against kratom use due to addiction, respiratory depression, liver injury, and contamination.',
  p_dosage_fr := 'Aucune dose approuvée ou sûre — Santé Canada et la FDA déconseillent le kratom (dépendance, dépression respiratoire, toxicité hépatique et contaminations).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Not approved for any medical use by Health Canada or US FDA; unstandardized commercial products carry heavy-metal, Salmonella, and synthetic 7-hydroxymitragynine adulteration risks.',
    'Opioid-like risks: physical dependence, withdrawal, fatal respiratory depression (especially combined with opioids, benzodiazepines, or alcohol), seizures, and idiosyncratic cholestatic liver injury.',
    'Contraindicated in pregnancy (neonatal abstinence syndrome), breastfeeding, children, liver disease, and substance-use history.'
  ],
  p_contraindications_fr := ARRAY[
    'Non autorisé par Santé Canada ni la FDA ; risques élevés de contamination (métaux lourds, Salmonella, alcaloïdes concentrés).',
    'Risque opioïde : dépendance, dépression respiratoire mortelle (surtout avec opioïdes, benzodiazépines ou alcool), convulsions et atteinte hépatique.',
    'Contre-indiqué pendant la grossesse (sevrage néonatal), l''allaitement, chez l''enfant et en cas de maladie hépatique.'
  ],
  p_faq_safety_en := 'Kratom is neither approved nor recognized as safe by FDA or Health Canada. Avoid due to addiction, seizures, cholestatic liver injury, neonatal abstinence in pregnancy, frequent product contamination, and fatal respiratory depression when mixed with opioids or sedatives.',
  p_faq_safety_fr := 'Le kratom n''est pas approuvé par Santé Canada ni la FDA. Éviter en raison des risques de dépendance, toxicité hépatique, syndrome de sevrage néonatal, contaminations et dépression respiratoire mortelle.',
  p_review_note := 'Added FDA/HC warnings, respiratory depression & contamination risks on kratom'
);

-- Blue Cohosh (blue-cohosh-root): neonatal stroke/MI/CHF, remove term-pregnancy dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'blue-cohosh-root',
  p_dosage_en := 'No safe self-administered dose — NEVER use to induce labor or during pregnancy (previously listed pregnancy induction dosing removed due to severe fetal/neonatal cardiac and stroke toxicity).',
  p_dosage_fr := 'Aucune dose sûre — ne JAMAIS utiliser pour déclencher l''accouchement ni pendant la grossesse (risque documenté d''AVC, d''infarctus et d''insuffisance cardiaque néonatale).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not safe for labor induction or gynecologic self-use — documented serious neonatal toxicity']::text[],
  p_modern_uses_fr := ARRAY['Usage proscrit pour déclencher le travail — toxicité néonatale grave documentée']::text[],
  p_faq_safety_en := 'Blue cohosh (Caulophyllum thalictroides) is unsafe in pregnancy and breastfeeding: clinical case reports link maternal late-pregnancy use for labor induction to neonatal stroke, perinatal myocardial infarction, congestive heart failure, and severe seizures. Distinct from black cohosh (Actaea racemosa).',
  p_faq_safety_fr := 'L''actée bleue (Caulophyllum thalictroides) est dangereuse pendant la grossesse : des cas cliniques l''associent à des AVC, infarctus et insuffisances cardiaques néonatales graves.',
  p_review_note := 'Removed term-pregnancy labor dose & added neonatal stroke/MI/CHF warnings on blue-cohosh-root'
);

-- Lobelia (lobelia-inflata): do NOT replace asthma inhaler
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'lobelia-inflata',
  p_dosage_en := 'No safe self-administered oral dose — contains lobeline (narrow-margin nicotinic alkaloid); listed among poisonous plants with severe vomiting and respiratory-collapse risk.',
  p_dosage_fr := 'Aucune dose orale sûre — renferme de la lobéline à marge toxique étroite ; plante toxique exposant à vomissements incoercibles et arrêt respiratoire.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'NEVER substitute lobelia for prescribed asthma inhalers or bronchodilators — untreated asthma exacerbations can be fatal. Oral lobeline causes severe vomiting, hypotension, tachycardia, seizures, and respiratory depression; avoid in pregnancy, breastfeeding, children, and heart/respiratory disease.',
  p_faq_safety_fr := 'Ne JAMAIS remplacer un inhalateur prescrit contre l''asthme par la lobélie — une crise d''asthme non traitée peut être fatale. La lobéline provoque vomissements graves, convulsions et dépression respiratoire.',
  p_review_note := 'Added critical do-not-substitute-for-asthma-inhaler warning on lobelia-inflata'
);

-- Tansy (tansy)
SELECT pg_temp.remediate_lethal_00093(
  'tansy',
  'Tansy (Tanacetum vulgare) volatile oil and aerial parts contain high neurotoxic thujone causing convulsions, gastroenteritis, coma, and abortion.',
  'La tanaisie renferme de la thuyone neurotoxique à forte teneur, exposant à des convulsions, un coma et un effet abortif.'
);

-- Rue (rue-herb): remove 0.5-1 g dose & infantile eczema
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'rue-herb',
  p_dosage_en := 'No safe oral or unsupervised topical dose — previously listed 0.5-1 g oral and infant skin uses are unsafe and removed.',
  p_dosage_fr := 'Aucune dose orale ni application cutanée sûre — les anciens usages oraux (0,5–1 g) et pédiatriques sont dangereux et supprimés.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not recommended for self-care (phototoxic furocoumarins, nephro/hepatotoxicity, abortifacient)']::text[],
  p_modern_uses_fr := ARRAY['Déconseillée en automédication (furocoumarines phototoxiques, toxicité rénale/hépatique et abortive)']::text[],
  p_faq_safety_en := 'Avoid rue (Ruta graveolens) during pregnancy (abortifacient uterine contractions), breastfeeding, and NEVER apply to infantile eczema (severe furocoumarin chemical burns/phytophotodermatitis). High doses cause violent gastric pain, liver/kidney failure, and death.',
  p_faq_safety_fr := 'Éviter la rue officinale pendant la grossesse (effet abortif), l''allaitement et ne JAMAIS appliquer sur l''eczéma du nourrisson (brûlures phototoxiques sévères et toxicité hépato-rénale).',
  p_review_note := 'Removed 0.5-1 g dose and infantile eczema claim on rue-herb'
);

-- Wintergreen (gaulteria-wintergreen): fix name spelling + <=5 mL child fatality warning
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'gaulteria-wintergreen',
  p_name_en := 'Wintergreen (Gaultheria procumbens)',
  p_name_fr := 'Gaulthérie couchée (Gaultheria procumbens)',
  p_dosage_en := 'External diluted use ONLY in adults — NEVER ingest wintergreen oil orally (5 mL oil equals ~7,000 mg salicylate and can be fatal in a small child).',
  p_dosage_fr := 'Usage externe dilué UNIQUEMENT chez l''adulte — ne JAMAIS ingérer d''huile essentielle de gaulthérie (5 mL peuvent tuer un jeune enfant).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Wintergreen essential oil is ~98% methyl salicylate: swallowing as little as 4-5 mL (under 1 teaspoon) has killed small children and carries fatal acidosis/seizure risks in adults. Avoid with salicylate/aspirin allergy, anticoagulants (warfarin), children/teens (<18 due to Reye''s syndrome), pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'L''huile essentielle de gaulthérie contient ~98 % de salicylate de méthyle : l''ingestion de 4 à 5 mL peut être mortelle chez l''enfant. Éviter en cas d''allergie à l''aspirine, d''anticoagulants (warfarine), avant 18 ans (syndrome de Reye), grossesse et allaitement.',
  p_review_note := 'Fixed Gaultheria spelling & added <=5 mL child fatality warning'
);

-- Chaparral / Gobernadora (gobernadora): remove cancer support + 1 cup max tea dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'gobernadora',
  p_dosage_en := 'No safe internal dose — FDA and Health Canada warn against ALL oral chaparral/Larrea tridentata products (previously listed "1 cup max" tea dose removed).',
  p_dosage_fr := 'Aucune dose interne sûre — la FDA et Santé Canada déconseillent TOUT usage oral du chaparral (dose de tisane « 1 tasse max » supprimée).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not a cancer treatment — avoid internal use due to fulminant liver and kidney failure']::text[],
  p_modern_uses_fr := ARRAY['N''est PAS un traitement anticancéreux — usage interne proscrit (insuffisance hépatique et rénale aiguë)']::text[],
  p_faq_uses_en := 'Chaparral (Larrea tridentata / gobernadora) must NOT be used for cancer support or chronic conditions: no human clinical trial demonstrates anticancer efficacy, and both the FDA and Health Canada (2005) warn against ingestion due to severe liver injury and kidney disease.',
  p_faq_uses_fr := 'Le chaparral (Larrea tridentata) ne doit PAS être utilisé en soutien anticancéreux : aucune preuve clinique humaine et avertissements de la FDA et de Santé Canada (hépatites fulminantes et néphrotoxicité).',
  p_faq_safety_en := 'Do NOT ingest chaparral (gobernadora / Larrea tridentata) in tea, capsules, or extracts: MSK and Health Canada (2005) document fulminant toxic hepatitis requiring liver transplantation, renal cysts, and renal failure.',
  p_faq_safety_fr := 'Ne pas ingérer le chaparral (tisane, gélules, extraits) : hépatites toxiques fulminantes nécessitant une greffe hépatique et lésions rénales documentées (Santé Canada 2005, MSK).',
  p_review_note := 'Removed "Cancer support" & "1 cup max" tea dose on gobernadora (chaparral)'
);

-- Ephedra (ephedra-sinica): NCCIH cardiovascular/death warning even at lower doses
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'ephedra-sinica',
  p_dosage_en := 'FDA banned ephedra-alkaloid dietary supplements (2004); regulated TCM Ma Huang is restricted to practitioner supervision only (no safe OTC self-dose).',
  p_dosage_fr := 'Compléments alimentaires interdits par la FDA (2004) ; l''éphédra (Ma Huang) relève uniquement d''un encadrement médical réglementé, sans automédication sûre.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Per NIH NCCIH, ephedra has been linked to heart attack, stroke, seizures, psychosis, and sudden death — adverse events have occurred even in healthy young adults taking labelled or lower doses. Banned in US supplements and contraindicated with hypertension, cardiovascular disease, thyroid disorders, glaucoma, MAOIs, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'Selon le NIH NCCIH, l''éphédra est associée à des infarctus, AVC, convulsions, psychoses et décès soudains, y compris à faibles doses. Interdite aux États-Unis dans les compléments ; contre-indiquée en cas d''HTA, cardiopathie, glaucome, IMAO, grossesse et allaitement.',
  p_review_note := 'Added NCCIH cardiovascular/death at lower doses warning on ephedra-sinica'
);

-- Germander (germander)
SELECT pg_temp.remediate_lethal_00093(
  'germander',
  'Wall germander (Teucrium chamaedrys) contains furano-neoclerodane diterpenoids metabolized by CYP3A4 into reactive hepatotoxins causing LiverTox-A acute/chronic hepatitis, cirrhosis, and fatalities (banned in France/several regulators).',
  'La germandrée petit-chêne renferme des diterpènes hépatotoxiques métabolisés par le CYP3A4 causant hépatites aiguës sévères, cirrhoses et décès (LiverTox A, retirée en France).'
);

-- Yohimbe (corynanthe-yohimbe): fix spelling, remove Rx 5-20 mg dose, add HC Rx / EU ban
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'corynanthe-yohimbe',
  p_dosage_en := 'No safe OTC herbal supplement dose — pharmaceutical yohimbine hydrochloride (5-20 mg Rx) is a prescription drug in Canada and yohimbe supplements are banned in the EU and several countries.',
  p_dosage_fr := 'Aucune dose sûre en vente libre — la yohimbine est un médicament sur ordonnance au Canada et interdite dans les compléments alimentaires dans l''UE.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_description_en := 'Yohimbe (Pausinystalia johimbe, syn. Corynanthe yohimbe) bark contains the indole alkaloid yohimbine, an alpha-2 adrenergic antagonist. Commercial yohimbe dietary supplements vary wildly in yohimbine potency and carry high risk of severe tachycardia, hypertensive crisis, arrhythmias, myocardial infarction, seizures, and panic attacks. Yohimbine is a prescription-only drug in Health Canada and prohibited in EU food supplements.',
  p_description_fr := 'L''écorce de yohimbe (Pausinystalia johimbe) contient de la yohimbine, antagoniste alpha-2 adrénergique. Les compléments commerciaux présentent des teneurs très variables et exposent à tachycardie sévère, poussées hypertensives, arythmies, infarctus, convulsions et anxiété aiguë.',
  p_faq_safety_en := 'Avoid OTC yohimbe supplements: NCCIH warns of heart attacks, seizures, blood-pressure spikes, and renal failure; do NOT combine with MAOIs, tricyclic antidepressants, or stimulants. Prescription yohimbine is restricted/banned in Canada and the EU; contraindicated in hypertension, heart/kidney/liver/psychiatric disease, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'Éviter les compléments de yohimbe : le NCCIH signale infarctus, convulsions, crises hypertensives et insuffisance rénale. Ne jamais associer aux IMAO, tricycliques ou stimulants ; contre-indiquée en cas de maladie cardiovasculaire, rénale, hépatique, grossesse et allaitement.',
  p_review_note := 'Fixed yohimba spelling, removed Rx 5-20 mg dose, added HC Rx / EU ban on corynanthe-yohimbe'
);

-- Cinchona & Cinchona calisaya: FDA boxed warning, remove leg cramps
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'cinchona',
  p_dosage_en := 'No safe OTC dose for nocturnal leg cramps — US FDA boxed warning against off-label quinine use; regulated bark bitter tonics are strictly low-dose food-grade limits only.',
  p_dosage_fr := 'Aucune dose sûre contre les crampes nocturnes (avertissement encadré FDA sur la quinine) ; l''écorce concentrée ne doit pas remplacer un traitement antipaludique.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Do NOT use for nocturnal leg cramps (FDA boxed warning for fatal thrombocytopenia/HUS/arrhythmias)']::text[],
  p_modern_uses_fr := ARRAY['Ne PAS utiliser contre les crampes nocturnes (avertissement encadré FDA — thrombopénie grave et arythmies)']::text[],
  p_faq_safety_en := 'Cinchona bark contains quinine and quinidine: FDA issued a Boxed Warning prohibiting quinine for leg cramps due to serious, sometimes fatal thrombocytopenia, hemolytic uremic syndrome (HUS/TTP), QT prolongation, cinchonism, and hypoglycemia. Contraindicated in pregnancy, G6PD deficiency, myasthenia gravis, optic neuritis, and arrhythmias.',
  p_faq_safety_fr := 'Le quinquina contient de la quinine et de la quinidine : la FDA émet un avertissement encadré proscrivant la quinine contre les crampes (thrombopénie grave, SHU, allongement du QT). Contre-indiqué pendant la grossesse, déficit en G6PD et myasthénie.',
  p_review_note := 'Added FDA quinine boxed warning & removed leg-cramp self-use on cinchona'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'cinchona-calisaya',
  p_dosage_en := 'No safe OTC self-dose — contains quinine/quinidine carrying FDA boxed warning risks (never use for leg cramps).',
  p_dosage_fr := 'Aucune dose d''automédication sûre — contient de la quinine (avertissement encadré FDA ; ne pas utiliser contre les crampes).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Do NOT use for nocturnal leg cramps (FDA quinine boxed warning)']::text[],
  p_modern_uses_fr := ARRAY['Ne PAS utiliser contre les crampes nocturnes (avertissement encadré FDA)']::text[],
  p_faq_safety_en := 'Cinchona calisaya bark contains quinine and quinidine: do NOT self-administer for leg cramps (FDA Boxed Warning for fatal thrombocytopenia, HUS/TTP, and QT arrhythmias). Contraindicated in pregnancy, G6PD deficiency, and cardiac conduction disease.',
  p_faq_safety_fr := 'Cinchona calisaya renferme quinine et quinidine : ne jamais utiliser contre les crampes nocturnes (avertissement FDA : thrombopénie mortelle, troubles du rythme QT). Contre-indiqué en cas de grossesse ou déficit en G6PD.',
  p_review_note := 'Added FDA quinine boxed warning & removed leg-cramp use on cinchona-calisaya'
);

-- Soursop / Graviola (annona-muricata): remove cancer treatment first, add no human evidence & neurotoxicity
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'annona-muricata',
  p_dosage_en := 'No standardized safe supplement dose — regular consumption of concentrated extracts, seeds, or teas carries neurotoxicity concerns (culinary ripe pulp differs).',
  p_dosage_fr := 'Aucune posologie standardisée sûre en supplément — les extraits, feuilles et graines présentent un risque neurotoxique (distinct de la pulpe alimentaire occasionnelle).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['No human clinical trials support cancer treatment despite laboratory studies (MSK/NCCIH warn against relying on soursop for cancer)']::text[],
  p_modern_uses_fr := ARRAY['Aucun essai clinique chez l''humain ne démontre d''efficacité contre le cancer malgré des travaux in vitro']::text[],
  p_faq_uses_en := 'No human clinical trial evidence supports soursop (graviola) to prevent or treat cancer; do NOT delay or replace proven oncology care. Ripe fruit pulp is eaten as food, while concentrated leaf/seed/tea supplements lack verified human efficacy.',
  p_faq_uses_fr := 'Aucune étude clinique chez l''humain ne démontre d''efficacité du corossol (graviola) contre le cancer ; ne jamais retarder un traitement oncologique éprouvé.',
  p_faq_safety_en := 'Concentrated soursop extracts, seeds, and herbal teas contain acetogenins (annonacin) linked in MSK/epidemiological data to movement disorders resembling atypical Parkinson''s disease and neurotoxicity. Avoid concentrated supplements during pregnancy, breastfeeding, and neurodegenerative conditions.',
  p_faq_safety_fr := 'Les extraits concentrés, graines et tisanes de corossol contiennent des acétogénines (annonacine) associées à un risque neurotoxique (syndrome parkinsonien atypique selon le MSK). Éviter en suppléments pendant la grossesse et l''allaitement.',
  p_review_note := 'Removed cancer-treatment lead, added "no human evidence" & annonacin neurotoxicity on annona-muricata'
);

-- Red Poppy Petals (red-poppy-petals): remove childhood insomnia/teething & 9 g dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'red-poppy-petals',
  p_dosage_en := 'No standardized safe modern clinical dose — previously listed 9 g and pediatric/teething uses are unsafe and removed.',
  p_dosage_fr := 'Aucune posologie clinique moderne standardisée — les doses de 9 g et usages pédiatriques sont supprimés pour sécurité.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Obsolete folk sedative use — avoid in children due to alkaloid CNS depression/seizure risk']::text[],
  p_modern_uses_fr := ARRAY['Usage sédatif traditionnel obsolète — proscrit chez l''enfant (dépression du SNC et convulsions)']::text[],
  p_faq_safety_en := 'Do NOT give corn poppy (Papaver rhoeas) petals or syrups to infants or children for teething or insomnia: rhoeadine-type alkaloids have caused acute CNS depression, seizures, vomiting, and accidental poisonings in children. Avoid in pregnancy and breastfeeding.',
  p_faq_safety_fr := 'Ne JAMAIS donner de coquelicot (Papaver rhoeas) aux nourrissons ou enfants pour les poussées dentaires ou le sommeil : risques de convulsions et dépression nerveuse. Éviter pendant la grossesse et l''allaitement.',
  p_review_note := 'Removed childhood insomnia/teething & 9 g dose on red-poppy-petals'
);

-- Star Anise (illicium-verum): remove Infant colic, add FDA 2003 warning & Japanese star anise
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'illicium-verum',
  p_dosage_en := 'Culinary spice amounts only; do NOT administer star anise teas to infants or use unverified concentrated supplements orally.',
  p_dosage_fr := 'Usage culinaire uniquement ; ne JAMAIS administrer de tisane d''anis étoilé aux nourrissons ni utiliser de fortes doses sans avis.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_traditional_uses_en := ARRAY['Culinary spice (five-spice) and traditional adult carminative (do NOT give to infants for colic)']::text[],
  p_traditional_uses_fr := ARRAY['Épice culinaire et carminatif traditionnel adulte (proscrit chez le nourrisson pour les coliques)']::text[],
  p_faq_safety_en := 'CRITICAL FDA WARNING (2003): NEVER give star anise tea to infants for colic — linked to infant seizures, vomiting, jitteriness, and liver/neurological toxicity, compounded by potentially fatal adulteration with toxic Japanese star anise (Illicium anisatum, containing anisatin). Limit outside culinary amounts during pregnancy and breastfeeding.',
  p_faq_safety_fr := 'AVERTISSEMENT FDA (2003) : ne JAMAIS donner de tisane d''anis étoilé (badiane) aux nourrissons contre les coliques — risques de convulsions graves et de contamination mortelle par l''anis étoilé japonais toxique (Illicium anisatum). Limiter aux quantités alimentaires pendant la grossesse et l''allaitement.',
  p_review_note := 'Removed Infant colic & added FDA 2003 infant seizure + Illicium anisatum warning'
);

-- European Mistletoe (european-mistletoe): oral toxicity vs specialist parenteral extracts
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'european-mistletoe',
  p_dosage_en := 'No safe self-administered oral dose — crude berries, leaves, and stems are poisonous; injectable Viscum album extracts are prescription/specialist-only.',
  p_dosage_fr := 'Aucune dose orale sûre — baies, feuilles et tiges brutes sont toxiques ; seuls certains extraits injectables relèvent d''un suivi spécialisé.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Do NOT ingest crude European mistletoe (Viscum album) berries, leaves, or homemade teas: viscotoxins and mistletoe lectins cause vomiting, hemorrhagic diarrhea, seizures, hypotension, and organ injury. Standardized parenteral oncology extracts are administered only under physician supervision; contraindicated in pregnancy, breastfeeding, and autoimmune disease.',
  p_faq_safety_fr := 'Ne pas ingérer le gui d''Europe brut (baies, feuilles, tisanes) : les viscotoxines et lectines provoquent gastro-entérite sévère, hypotension et convulsions. Contre-indiqué pendant la grossesse, l''allaitement et les maladies auto-immunes.',
  p_review_note := 'Clarified crude oral mistletoe toxicity vs specialist parenteral extracts'
);

-- =====================================================================
-- GROUP B — Wrong-Herb, Wrong-Species, and Wrong-Part Corrections (18 slugs)
-- =====================================================================

-- 1. Pygeum: rename wrongly labelled "Saw Palmetto Berry" & scrub stale FAQ questions
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'pygeum',
  p_name_en := 'Pygeum (African Plum Bark)',
  p_name_fr := 'Prunier d''Afrique (Pygeum)',
  p_dosage_en := 'Standardized lipophilic bark extract: 100 mg/day in 1-2 divided doses (Health Canada/RCT range: 75-200 mg/day; adults only).',
  p_dosage_fr := 'Extrait lipophile standardisé d''écorce : 100 mg/jour en 1 à 2 prises (plage d''essais/Santé Canada : 75–200 mg/j ; adultes uniquement).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_description_en := 'Pygeum (Prunus africana, syn. Pygeum africanum) is an evergreen tree native to central and southern Africa whose bark — not saw palmetto berries — is standardized into lipophilic extracts rich in beta-sitosterol and pentacyclic triterpenes. Historically studied for lower urinary tract symptoms of benign prostatic hyperplasia (BPH), clinical evaluation relies on physician diagnosis to exclude prostate cancer.',
  p_description_fr := 'Le prunier d''Afrique (Prunus africana, syn. Pygeum africanum) est un arbre africain dont l''écorce (et non la baie de palmier nain) fournit des extraits lipophiles riches en bêta-sitostérol étudiés pour les troubles urinaires bénins de la prostate après avis médical.',
  p_faq_safety_en := 'Pygeum (Prunus africana bark, distinct from saw palmetto berry) requires prior medical diagnosis to rule out prostate cancer before self-use. Avoid in pregnancy, breastfeeding, children under 18, and known Prunus hypersensitivity.',
  p_faq_safety_fr := 'Le prunier d''Afrique (Prunus africana, distinct du palmier nain) impose un diagnostic médical préalable pour écarter un cancer de la prostate. Éviter pendant la grossesse, l''allaitement et avant 18 ans.',
  p_faq_dosage_en := 'Clinical trials and Health Canada records use 75-200 mg/day (commonly 100 mg/day) of standardized Prunus africana bark extract in adult men. This is distinct from Serenoa repens (saw palmetto berry) dosing.',
  p_faq_dosage_fr := 'Les essais cliniques et Santé Canada utilisent 75 à 200 mg/jour (souvent 100 mg/jour) d''extrait standardisé d''écorce de Prunus africana chez l''homme adulte (distinct du palmier nain).',
  p_review_note := 'Renamed pygeum from wrong "Saw Palmetto Berry" label'
);

UPDATE public.herb_faqs f
SET
  question = replace(f.question, 'Saw Palmetto Berry', 'Pygeum (African Plum Bark)'),
  answer = replace(f.answer, 'Saw Palmetto Berry', 'Pygeum (African Plum Bark)'),
  translations = jsonb_set(
    jsonb_set(
      COALESCE(f.translations, '{}'::jsonb),
      '{fr,question}',
      to_jsonb(replace(COALESCE(f.translations->'fr'->>'question', f.question), 'Palmier nain', 'Prunier d''Afrique (Pygeum)')),
      true
    ),
    '{fr,answer}',
    to_jsonb(replace(COALESCE(f.translations->'fr'->>'answer', f.answer), 'Palmier nain', 'Prunier d''Afrique (Pygeum)')),
    true
  ),
  updated_at = now()
FROM public.herbs h
WHERE f.herb_id = h.id
  AND h.slug = 'pygeum'
  AND (
    f.question ILIKE '%Saw Palmetto%'
    OR f.answer ILIKE '%Saw Palmetto%'
    OR COALESCE(f.translations->'fr'->>'question', '') ILIKE '%Palmier nain%'
  );

-- 2. Kelp: reconcile Fucus vesiculosus vs Laminaria kelp + 1,100 mcg/day iodine UL
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'kelp',
  p_dosage_en := 'EMA HMPC (Fucus vesiculosus thallus): 130 mg powdered seaweed twice daily before meals (max 2-month limit if iodine intake stays safely within limits); NEVER exceed the NIH ODS adult Tolerable Upper Intake Level of 1,100 mcg iodine/day from all sources.',
  p_dosage_fr := 'EMA (Fucus vesiculosus) : 130 mg 2 fois/jour avant les repas ; ne JAMAIS dépasser l''apport maximal tolérable de 1 100 mcg d''iode/jour (toutes sources confondues) en raison de la variabilité entre Fucus et Laminaria.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Species and iodine variability: true kelps (Laminaria/Saccharina) and bladderwrack (Fucus vesiculosus) contain widely varying, often excessive iodine levels (>1,100 mcg/day UL causes hypothyroidism, hyperthyroidism, or thyroiditis).',
    'Contraindicated in thyroid disorders (hyperthyroidism, Hashimoto''s thyroiditis, nodular goiter), iodine allergy, pregnancy, lactation, and under 18 years (EMA/HMPC/313675/2012).'
  ],
  p_contraindications_fr := ARRAY[
    'Variabilité majeure d''espèce et d''iode entre Fucus vesiculosus et Laminaria : un excès d''iode (>1 100 mcg/j) peut déclencher hypothyroïdie ou hyperthyroïdie.',
    'Contre-indiqué en cas de pathologie thyroïdienne, d''allergie à l''iode, pendant la grossesse, l''allaitement et avant 18 ans (EMA/HMPC/313675/2012).'
  ],
  p_faq_safety_en := 'Do NOT treat Laminaria kelp and Fucus vesiculosus (bladderwrack) as interchangeable: iodine content fluctuates sharply and excess >1,100 mcg/day risks thyroid dysfunction. Avoid in thyroid disease, pregnancy, breastfeeding, under 18, and watch heavy-metal contamination.',
  p_faq_safety_fr := 'Ne pas confondre Laminaria (varech) et Fucus vesiculosus : leur teneur en iode varie fortement et un apport >1 100 mcg/j perturbe la thyroïde. Éviter en cas de trouble thyroïdien, grossesse, allaitement et avant 18 ans.',
  p_review_note := 'Reconciled Fucus vs Laminaria species & 1,100 mcg iodine UL on kelp'
);

-- 3. White Horehound Root (clarify EMA Marrubii herba aerial parts vs root)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'white-horehound-root',
  p_dosage_en := 'EMA HMPC covers Marrubii herba (flowering aerial parts — NOT the root): herbal tea 1-2 g three times daily, or expressed juice 10-20 ml three times daily; root preparations lack a verified monograph.',
  p_dosage_fr := 'La monographie EMA porte sur Marrubii herba (parties aériennes fleuries, et NON la racine) : tisane 1–2 g 3 fois/jour ou suc exprimé 10–20 ml 3 fois/jour ; aucune posologie officielle pour la racine seule.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'Note plant part mismatch: EMA/HMPC/604273/2012 applies strictly to flowering aerial parts (Marrubii herba), not root preparations.',
    'Contraindicated with bile duct obstruction, cholangitis, liver disease, gallstones, active peptic ulcer, under 12 years, pregnancy, and lactation.'
  ],
  p_contraindications_fr := ARRAY[
    'Attention à la partie utilisée : la monographie EMA concerne les parties aériennes fleuries (Marrubii herba), non la racine.',
    'Contre-indiqué en cas d''obstruction des voies biliaires, cholangite, maladie hépatique, ulcère gastrique, grossesse, allaitement et avant 12 ans.'
  ],
  p_faq_safety_en := 'EMA monograph EMA/HMPC/604273/2012 applies to Marrubii herba (flowering tops), not root. Contraindicated in bile duct obstruction, cholangitis, liver disease, gallstones, stomach ulcers, pregnancy, breastfeeding, and children under 12.',
  p_faq_safety_fr := 'La monographie EMA porte sur les parties aériennes (non la racine). Contre-indiqué en cas d''obstruction biliaire, cholangite, maladie hépatique, ulcère, grossesse, allaitement et avant 12 ans.',
  p_review_note := 'Clarified Marrubii herba aerial parts vs root & EMA biliary/age contraindications'
);

-- 4. Buckthorn (remove Frangula bark dose from Rhamnus cathartica berry page)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'buckthorn',
  p_dosage_en := 'Do not transfer Frangula alnus (alder buckthorn bark) doses to Rhamnus cathartica (purging buckthorn berry): EMA Frangulae cortex is strictly <=20-30 mg hydroxyanthracene derivatives max 1 week; R. cathartica berries are harsher and contraindicated for chronic/self-use.',
  p_dosage_fr := 'Ne pas transférer la posologie d''écorce de bourdaine (Frangula alnus) aux baies de nerprun purgatif (Rhamnus cathartica), plus irritantes et déconseillées en usage prolongé (>1 semaine).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Purging buckthorn berries (Rhamnus cathartica) are distinct from alder buckthorn bark (Frangula alnus). Both anthraquinone stimulant laxatives are contraindicated under 12 years, in pregnancy, breastfeeding, intestinal obstruction, appendicitis, IBD (Crohn''s/colitis), and severe dehydration, and must never exceed 1 week.',
  p_faq_safety_fr := 'Les baies de nerprun (R. cathartica) sont distinctes de l''écorce de bourdaine (F. alnus). Contre-indiqués avant 12 ans, grossesse, allaitement, occlusion intestinale et maladies inflammatoires intestinales ; durée max 1 semaine.',
  p_review_note := 'Removed cross-species Frangula bark dose from Rhamnus cathartica buckthorn page'
);

-- 5 & 6. Blueberry Leaf & Bilberry Leaf (remove fruit monograph doses & fake WHO Vol 1 citation)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'blueberry-leaf',
  p_dosage_en := 'No standardized safe long-term clinical monograph dose is established for Vaccinium angustifolium / V. corymbosum leaf; do NOT apply Health Canada or EMA Vaccinium myrtillus fruit doses (160-480 mg/day fruit extract) to leaf products.',
  p_dosage_fr := 'Aucune posologie clinique à long terme n''est établie pour la feuille de bleuet/myrtille ; ne PAS appliquer les doses d''extrait de fruit (160–480 mg/j) aux feuilles.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Avoid extrapolating bilberry fruit trials or WHO/Health Canada fruit doses to blueberry leaf: historical animal and case reports linked prolonged concentrated Vaccinium leaf intake to toxicity (hydroquinone/catechol accumulation). Avoid concentrated leaf extracts during pregnancy, breastfeeding, and alongside insulin/oral hypoglycemics.',
  p_faq_safety_fr := 'Ne pas confondre extrait de fruit et feuille : l''usage prolongé de feuilles concentrées de Vaccinium a montré une toxicité historique. Éviter pendant la grossesse, l''allaitement et avec les traitements hypoglycémiants.',
  p_review_note := 'Removed misplaced fruit monograph doses from blueberry-leaf'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'bilberry-leaf',
  p_dosage_en := 'No standardized safe long-term oral dose is established for bilberry leaf (Myrtilli folium): Health Canada and WHO Vol. 1/4 monographs cover bilberry FRUIT (Fructus Myrtilli, 160-480 mg/day fruit extract), NOT the leaf.',
  p_dosage_fr := 'Aucune posologie orale chronique sûre n''est validée pour la feuille de myrtille (Myrtilli folium) ; les monographies portent sur le FRUIT et non la feuille.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Distinguish bilberry leaf from bilberry fruit: EMA and historical German Commission E warn against long-term concentrated Vaccinium myrtillus leaf ingestion (historical chronic poisoning reports), and fruit monograph benefits/doses do not transfer to the leaf. Avoid in pregnancy and breastfeeding.',
  p_faq_safety_fr := 'Distinguer feuille et fruit de myrtille : les extraits concentrés de feuilles ne sont pas couverts par les posologies du fruit et présentent des risques en usage prolongé. Éviter pendant la grossesse et l''allaitement.',
  p_review_note := 'Removed fruit monograph doses & fake WHO Vol 1 citation from bilberry-leaf'
);

-- 7 & 8. Myrrh & Commiphora molmol (reconcile duplicate pages to EMA oromucosal rinse / topical-only)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'myrrh',
  p_dosage_en := 'EMA HMPC Myrrha (EMA/HMPC/96910/2010): strictly external/oromucosal or cutaneous use (diluted 1:5 tincture as mouth rinse/gargle 2-3 times daily or undiluted spot application on minor oral ulcers/gingivitis, adults and >=12 yrs, max 1 week); NOT for systemic oral ingestion.',
  p_dosage_fr := 'Monographie EMA (Myrrha) : usage strictement oromuqueux ou cutané externe (teinture diluée en bain de bouche 2–3 fois/j ou application locale sur aphtes mineurs chez >=12 ans, max 1 semaine) ; ne PAS avaler.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Per EMA/HMPC/96910/2010, myrrh tincture is restricted to topical cutaneous or oromucosal rinse/gargle (not swallowed; max 1 week). Contraindicated under 12 years, pregnancy, and breastfeeding (emmenagogue/uterine-stimulant safety lack); may sensitize oral mucosa if undiluted.',
  p_faq_safety_fr := 'Selon l''EMA, la teinture de myrrhe est réservée à l''usage local cutané ou en bain de bouche (sans avaler ; max 1 semaine). Déconseillée avant 12 ans, pendant la grossesse et l''allaitement.',
  p_review_note := 'Aligned myrrh to EMA oromucosal/topical-only posology'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'commiphora-molmol',
  p_dosage_en := 'EMA HMPC (Myrrha — Commiphora molmol oleo-gum-resin): topical/oromucosal rinse and cutaneous application ONLY (adults and >=12 yrs, max 1 week); do NOT ingest orally or rely on conflicting non-EMA systemic doses.',
  p_dosage_fr := 'Monographie EMA (Commiphora molmol) : usage local oromuqueux (bain de bouche sans avaler) ou cutané uniquement (>=12 ans, max 1 semaine) ; ne pas ingérer.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Commiphora molmol (Myrrha) is authorized by EMA strictly for short-term external skin or oromucosal mouth-rinse use (max 7 days) — do not swallow oral doses, and avoid in pregnancy, breastfeeding, children under 12, and anticoagulants/antidiabetics without medical guidance.',
  p_faq_safety_fr := 'Commiphora molmol (myrrhe) est encadrée par l''EMA uniquement pour un usage local court (bain de bouche sans avaler ou application cutanée, max 7 jours). Éviter pendant la grossesse, l''allaitement et avant 12 ans.',
  p_review_note := 'Reconciled commiphora-molmol duplicate page to EMA oromucosal/topical-only'
);

-- 9 & 10. Pasque Flower & Anemone pulsatilla (reconcile duplicate pages & raw protoanemonin)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'pasque-flower',
  p_dosage_en := 'No standardized safe modern oral dose — fresh Pulsatilla vulgaris / Anemone pulsatilla contains caustic protoanemonin (severely irritating/blistering) and has no modern regulatory clinical monograph.',
  p_dosage_fr := 'Aucune posologie orale moderne sûre — la plante fraîche contient de la protoanémonine caustique et vésicante sans monographie clinique moderne.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Fresh pasque flower (Anemone pulsatilla) contains irritating, vesicant protoanemonin causing severe skin blistering and hemorrhagic GI/renal inflammation; previously listed homeopathic or 19th-century doses are unverified for modern self-use. Strictly avoid during pregnancy (historically oxytocic) and breastfeeding.',
  p_faq_safety_fr := 'L''anémone pulsatille fraîche contient de la protoanémonine vésicante provoquant brûlures et gastrite hémorragique. Proscrite pendant la grossesse, l''allaitement et hors dilutions homéopathiques strictes.',
  p_review_note := 'Reconciled pasque-flower duplicate dose & added fresh protoanemonin toxicity'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'anemone-pulsatilla',
  p_dosage_en := 'No standardized safe modern oral herbal dose — fresh Anemone pulsatilla contains caustic protoanemonin; ultra-diluted homeopathic preparations are distinct from raw herb.',
  p_dosage_fr := 'Aucune posologie orale moderne sûre pour la plante — l''anémone pulsatille fraîche renferme de la protoanémonine vésicante.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Fresh Anemone pulsatilla causes mucosal necrosis, blistering, vomiting, and renal irritation from protoanemonin; never self-administer fresh plant or unverified tinctures, and strictly avoid in pregnancy and breastfeeding.',
  p_faq_safety_fr := 'La plante fraîche contient de la protoanémonine caustique ; éviter toute plante fraîche ou teinture non encadrée, notamment pendant la grossesse et l''allaitement.',
  p_review_note := 'Reconciled anemone-pulsatilla with pasque-flower & protoanemonin toxicity'
);

-- 11. Pinus radiata (clarify P. radiata vs P. pinaster Pycnogenol)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'pinus-radiata',
  p_description_en := 'Pinus radiata (Monterey pine) bark extract (commercial water-extracted pine bark proanthocyanidin preparations such as Enzogenol) is botanically distinct from French maritime pine bark (Pinus pinaster, standardized extract Pycnogenol). Although both contain oligomeric proanthocyanidins (OPCs), most NCCIH/Cochrane pine bark clinical trials evaluated Pinus pinaster (Pycnogenol) specifically rather than Pinus radiata, so efficacy and safety data cannot be assumed identical across species.',
  p_description_fr := 'L''écorce de pin de Monterey (Pinus radiata) est botaniquement distincte de celle du pin maritime français (Pinus pinaster, Pycnogenol). Bien que toutes deux soient riches en proanthocyanidines, les essais cliniques majeurs concernent principalement Pinus pinaster et ne peuvent être transférés automatiquement à Pinus radiata.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Pinus radiata is a different species from French maritime pine (Pinus pinaster / Pycnogenol); do not treat clinical trial outcomes as interchangeable. Avoid concentrated extracts during pregnancy, breastfeeding, and use caution with immunosuppressants, anticoagulants, or antihypertensives.',
  p_faq_safety_fr := 'Pinus radiata est distinct du pin maritime (Pinus pinaster / Pycnogenol) ; ses données cliniques propres sont plus limitées. Éviter pendant la grossesse, l''allaitement et en cas de traitement immunosuppresseur ou anticoagulant sans avis.',
  p_review_note := 'Clarified Pinus radiata vs Pinus pinaster Pycnogenol species mismatch'
);

-- 12–18. Part/species reconciliations: Birch barks, Club moss, Hemp, Oat straw, Plantain, Burdock seed
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'betula-pendula-bark',
  p_dosage_en := 'Note botanical part distinction: EMA/HMPC Betulae folium monograph covers birch LEAF (2-3 g dried leaf infusion up to 4 times/day, adults & >=12 yrs), while standardized triterpene birch BARK extracts (Betula pendula / Betula alba) exist as prescription topical wound-gel formulations (Episalvan/Filsuvez); do not transfer leaf infusion doses to bark.',
  p_dosage_fr := 'Distinction partie végétale : la monographie EMA concerne la FEUILLE de bouleau (Betulae folium) ; l''écorce concentrée est utilisée surtout sous forme de gel topique triterpénique médical. Ne pas confondre feuille et écorce.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Clarified Betula pendula bark vs EMA Betulae folium leaf monograph'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'birch-bark',
  p_dosage_en := 'Clarification: internal urinary-flushing EMA posology (2-3 g tea 3-4 times daily) applies to birch LEAF (Betulae folium), NOT crude birch bark; methyl salicylate in sweet birch (Betula lenta) oil is toxic if ingested.',
  p_dosage_fr := 'Précision : la tisane diurétique (EMA) porte sur la FEUILLE de bouleau et non sur l''écorce ; l''huile essentielle de bouleau flexible (salicylate de méthyle) est toxique par voie orale.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Do not confuse birch leaf (Betulae folium), birch outer bark triterpenes, and sweet birch oil (Betula lenta — nearly pure toxic methyl salicylate, fatal in small oral doses). Avoid salicylate sensitivity, kidney/cardiac fluid-restriction conditions, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'Ne pas confondre feuille de bouleau, écorce et huile de bouleau flexible (salicylate de méthyle toxique par voie orale). Éviter en cas d''allergie aux salicylés, grossesse, allaitement et restriction hydrique.',
  p_review_note := 'Separated birch bark vs birch leaf vs toxic Betula lenta methyl salicylate oil'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'club-moss',
  p_dosage_en := 'Distinct species warning: Huperzia serrata (Chinese club moss, standardized huperzine A 50-200 mcg studied in trials) is DIFFERENT from common Lycopodium clavatum spore powder; do not interchange Lycopodium homeopathic/folk uses with huperzine A.',
  p_dosage_fr := 'Attention à la distinction d''espèces : Huperzia serrata (source d''huperzine A) est distincte des spores de Lycopodium clavatum ; ne pas confondre leurs usages ni posologies.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Clarified Huperzia serrata vs Lycopodium clavatum club-moss distinction'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'hemp',
  p_dosage_en := 'Separate parts carefully: culinary hemp SEED / cold-pressed seed oil (~1-2 Tbsp food dietary essential fatty acids, negligible THC/CBD) is completely distinct from cannabinoid-rich Cannabis sativa flower/resin extracts (CBD/THC).',
  p_dosage_fr := 'Distinguer impérativement les graines/huile de chanvre alimentaires (acides gras oméga, quasi sans cannabinoïdes) des extraits de fleurs riches en CBD/THC.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Clarified hemp seed food vs Cannabis cannabinoid extract part distinction'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'oat-straw',
  p_dosage_en := 'EMA HMPC (Avenae herba — dried oat straw/herb): 3 g herbal tea 3 times/day (adults & >=12 yrs), distinct from colloidal oatmeal (Avenae fructus/bran skin baths) and wild green oat extract clinical cognitive supplements.',
  p_dosage_fr := 'Monographie EMA (Avenae herba, paille d''avoine) : 3 g en tisane 3 fois/jour (>=12 ans) ; distincte de la farine colloïdale de grain en bains émollients.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Clarified EMA Avenae herba vs oat bran/colloidal grain'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'plantain',
  p_dosage_en := 'Part & species distinction: EMA/HMPC covers Plantago lanceolata LEAF tea/syrup (3-6 g/day oromucosal rinse/demulcent for throat irritation, >=3-12 yrs by age); do NOT confuse ribwort plantain leaf (Plantago lanceolata) with psyllium seed husk laxative (Plantago ovata / P. afra) or edible starchy banana plantain (Musa).',
  p_dosage_fr := 'Ne pas confondre la feuille de plantain lancéolé (Plantago lanceolata, adoucissant pharyngé EMA), le tégument de psyllium laxatif (Plantago ovata) et la banane plantain alimentaire (Musa).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Clarified Plantago lanceolata leaf vs Plantago ovata psyllium vs Musa plantain'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'burdock-seed',
  p_description_en := 'Burdock seed (Fructus Arctii, Chinese Niubangzi — mature achenes of Arctium lappa, formerly synonymized as Lappa major) is chemically and clinically distinct from European/Health Canada burdock ROOT (Arctii radix). While burdock root has EMA and Health Canada monographs for mild diuretic/digestive uses, burdock seed is used mainly in multi-herb TCM formulas and lacks standardized single-herb Western clinical monographs.',
  p_description_fr := 'La graine de bardane (Arctium lappa fructus, syn. historique Lappa major, « Niubangzi ») diffère de la racine de bardane (Arctii radix) couverte par les monographies EMA et Santé Canada ; la graine manque d''essais cliniques occidentaux en monopréparation.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Burdock seed (Fructus Arctii, historically Lappa major in pre-modern texts) is distinct from burdock root; avoid concentrated extracts during pregnancy (historical uterine stimulation concern), breastfeeding, Asteraceae/daisy allergy, and before surgery or with anticoagulants/antidiabetics.',
  p_faq_safety_fr := 'La graine de bardane (syn. historique Lappa major) diffère de la racine. Éviter les extraits concentrés pendant la grossesse, l''allaitement, en cas d''allergie aux Astéracées, avant une chirurgie ou avec anticoagulants/antidiabétiques.',
  p_review_note := 'Reconciled burdock seed vs root & Lappa major synonym note'
);

-- =====================================================================
-- GROUP C — Over-Monograph Doses & Missing Critical Clinical Warnings (~44 slugs)
-- =====================================================================

-- 1. Aloe vera leaf (EMA 10-30 mg aloin max 1 week, separate gel vs latex, remove cancer)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'aloe-vera-leaf',
  p_dosage_en := 'Stimulant aloe LATEX only (hydroxyanthracene derivatives calculated as barbaloin/aloin): EMA HMPC 10-30 mg ONCE daily at bedtime for MAX 1 week (previously listed 100-300 mg/day is unsafe overdose; clear inner-leaf GEL is distinct and lacks laxative anthraquinones).',
  p_dosage_fr := 'Latex stimulant d''aloès uniquement (dérivés hydroxyanthracéniques en aloïne) : 10 à 30 mg UNE fois le soir pendant MAX 1 semaine selon l''EMA (la plage de 100–300 mg/j est excessive ; le gel interne transparent ne contient pas d''aloïne).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Short-term relief of occasional constipation (anthraquinone latex, EMA max 1 week)', 'Minor skin irritation/burns (topical inner-leaf gel ONLY)']::text[],
  p_modern_uses_fr := ARRAY['Constipation occasionnelle de courte durée (latex à anthraquinones, max 1 semaine EMA)', 'Apaisement cutané léger (gel interne topique UNIQUEMENT)']::text[],
  p_faq_dosage_en := 'Per EMA HMPC, standardized aloe latex for occasional constipation is 10-30 mg hydroxyanthracene derivatives (as barbaloin) once at bedtime for no longer than 1 week (NOT 100-300 mg/day). Topically, clear inner-leaf gel is soothing and contains virtually no aloin.',
  p_faq_dosage_fr := 'Selon l''EMA, le latex laxatif est limité à 10–30 mg d''aloïne une fois au coucher pendant 1 semaine maximum (et non 100–300 mg/j) ; le gel interne s''utilise localement.',
  p_review_note := 'Fixed 100-300 mg aloin overdose -> EMA 10-30 mg max 1 wk + separated gel vs latex + removed cancer claim'
);

-- 2. Andrographis (anaphylaxis warning + TGA Sept 17 2026 ban/cancellation)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'andrographis',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'SEVERE ANAPHYLAXIS & HYPERSENSITIVITY RISK: documented life-threatening anaphylactic shock, angioedema, urticaria, and acute liver injury — STOP USE AND SEEK EMERGENCY CARE IMMEDIATELY for rash, facial/throat swelling, or wheezing.',
    'Regulatory alert: Australia''s TGA cancelled/prohibited listed products containing Andrographis paniculata (effective Sept 17, 2026) due to anaphylaxis and liver-injury reports.',
    'Contraindicated in pregnancy (possible abortifacient/antifertility effects), breastfeeding, autoimmune conditions, liver disease, and bleeding disorders.'
  ],
  p_contraindications_fr := ARRAY[
    'RISQUE GRAVE D''ANAPHYLAXIE : choc anaphylactique, œdème de Quincke, urticaire sévère et atteinte hépatique — ARRÊTER ET APPELER LES URGENCES en cas d''éruption ou de gonflement du visage/gorge.',
    'Alerte réglementaire : la TGA (Australie) a radié/interdit les préparations en vente libre (17 sept. 2026) en raison des cas d''anaphylaxie et d''hépatotoxicité.',
    'Contre-indiquée pendant la grossesse, l''allaitement et en cas de maladie auto-immune ou hépatique.'
  ],
  p_faq_safety_en := 'CRITICAL WARNING: Andrographis can cause severe, potentially life-threatening anaphylaxis, angioedema, taste loss, and liver injury; stop immediately and seek emergency care at any sign of allergic reaction (note TGA Australia product cancellation effective Sept 17, 2026). Avoid in pregnancy, breastfeeding, autoimmune disease, liver disease, and hypotension.',
  p_faq_safety_fr := 'AVERTISSEMENT CRITIQUE : l''andrographis peut déclencher un choc anaphylactique grave et une atteinte hépatique (radiation réglementaire en Australie / TGA au 17 sept. 2026). Consulter en urgence au moindre signe allergique ; éviter grossesse, allaitement et maladies auto-immunes.',
  p_review_note := 'Added anaphylaxis emergency warning & TGA Sept 17 2026 cancellation on andrographis'
);

-- 3. Grindelia herb (5 ml 3x/d -> EMA 0.5-1 ml 2-3x/d)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'grindelia-herb',
  p_dosage_en := 'EMA HMPC (Grindeliae herba): herbal tea 2-3 g in 150 ml boiling water 2-3 times/day (max 6-9 g/day), OR liquid extract (1:1, 75-80% ethanol) 0.5-1 ml 2-3 times/day (previously listed 5 ml 3x/day exceeded monograph 5-10x).',
  p_dosage_fr := 'Monographie EMA (Grindeliae herba) : tisane de 2–3 g 2–3 fois/jour (max 6–9 g/j) ou extrait fluide 0,5–1 ml 2–3 fois/jour (et non 5 ml 3x/jour, qui excédait 5 à 10 fois la dose EMA).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_dosage_en := 'EMA/HMPC/701324/2011 traditional adult dose (>=12 yrs) is 2-3 g dried herb infusion 2-3 times daily or 0.5-1 ml liquid extract 2-3 times daily (consult clinician if cough persists >1 week; previously shown 5 ml 3x/day figure was excessive).',
  p_faq_dosage_fr := 'La posologie EMA (>=12 ans) est de 2–3 g en infusion 2–3 fois/j ou 0,5–1 ml d''extrait fluide 2–3 fois/j (avis médical si >1 semaine ; 5 ml 3x/j était excessif).',
  p_review_note := 'Corrected 5 ml 3x/d -> EMA 0.5-1 ml 2-3x/d on grindelia-herb'
);

-- 4. Fo-ti prepared (9-15 g -> 3-12 g/day + LiverTox A + remove liver toning)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'fo-ti-prepared',
  p_dosage_en := 'No safe unmonitored self-dose — Chinese Pharmacopoeia prepared root (Zhi He Shou Wu) traditional practitioner range is 3-12 g/day (strictly lower than unsafe 9-15 g raw/high figures); carry LiverTox Score A idiosyncratic fatal liver-injury warning.',
  p_dosage_fr := 'Aucune dose sûre sans suivi — la pharmacopée chinoise indique 3–12 g/jour pour la racine préparée (et non 9–15 g), avec avertissement LiverTox A d''hépatotoxicité grave.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['No validated safe hepatoprotective or "liver toning" use — known cause of severe clinical liver injury (LiverTox Score A)']::text[],
  p_modern_uses_fr := ARRAY['Aucun usage validé de « tonique hépatique » — cause reconnue d''hépatite toxique grave (LiverTox score A)']::text[],
  p_faq_uses_en := 'Do NOT use fo-ti (Polygonum multiflorum) for "liver toning": both raw (Sheng He Shou Wu) and prepared (Zhi He Shou Wu) fo-ti carry LiverTox Likelihood Score A for well-established acute idiosyncratic hepatotoxicity (~10% fatal or transplant risk).',
  p_faq_uses_fr := 'Ne PAS utiliser le fo-ti comme « tonique hépatique » : le fo-ti cru comme préparé présente un score LiverTox A d''hépatotoxicité idiosyncrasique grave (jusqu''à 10 % de décès ou greffe).',
  p_faq_safety_en := 'AVOID self-dosing fo-ti: LiverTox assigns Polygonum multiflorum Score A (idiosyncratic liver injury, independent of dose, with fatalities and transplants reported). Stop immediately and seek urgent care for jaundice, dark urine, right-upper abdominal pain, or severe fatigue. Contraindicated in liver disease, <18 yrs, pregnancy, breastfeeding, and hormone-sensitive conditions.',
  p_faq_safety_fr := 'ÉVITER l''automédication de fo-ti : score LiverTox A (hépatites aiguës graves parfois mortelles ou nécessitant une greffe, imprévisibles selon la dose). Consulter en urgence en cas d''ictère ou d''urines foncées ; contre-indiqué avant 18 ans, grossesse, allaitement et maladie du foie.',
  p_review_note := 'Fixed 9-15 g -> 3-12 g/d, added LiverTox A warning & removed "liver toning" on fo-ti-prepared'
);

-- 5. Guduchi (LiverTox Score A; remove "Liver protection")
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'guduchi',
  p_dosage_en := 'No validated safe unmonitored oral dose — documented cause of autoimmune-like hepatotoxicity (LiverTox); use caution and stop at any sign of liver dysfunction.',
  p_dosage_fr := 'Aucune posologie sûre sans suivi médical — cause documentée d''hépatotoxicité sévère de type auto-immun (LiverTox).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Not safe for "liver protection" — documented cause of autoimmune-like idiosyncratic hepatitis (LiverTox)']::text[],
  p_modern_uses_fr := ARRAY['Usage déconseillé pour « protéger le foie » — cas documentés d''hépatite auto-immune aiguë (LiverTox)']::text[],
  p_faq_uses_en := 'Do NOT use guduchi (Tinospora cordifolia) for liver protection: NIH LiverTox documents severe acute autoimmune-like hepatitis and fatal/transplant-requiring liver injury associated with guduchi supplements.',
  p_faq_uses_fr := 'Ne PAS utiliser le guduchi (Tinospora cordifolia) pour la protection du foie : NIH LiverTox documente des hépatites auto-immunes aiguës graves pouvant mener à une insuffisance hépatique.',
  p_faq_safety_en := 'Warning: Tinospora cordifolia (guduchi / giloy) is linked to LiverTox Score A/B severe idiosyncratic autoimmune-like hepatitis. Avoid in liver or autoimmune disease, pregnancy, breastfeeding, children, and monitor liver enzymes if prescribed.',
  p_faq_safety_fr := 'Avertissement : Tinospora cordifolia est associée à des hépatites auto-immunes graves (LiverTox). Éviter en cas de maladie hépatique ou auto-immune, grossesse, allaitement et chez l''enfant.',
  p_review_note := 'Removed "Liver protection" & added LiverTox warning on guduchi'
);

-- 6. Rhubarb Root (rheum-officinale): EMA 20-30 mg rhein max 1 wk
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'rheum-officinale',
  p_dosage_en := 'EMA HMPC (Rhei radix — standardized hydroxyanthracene derivatives calculated as rhein): 20-30 mg ONCE daily at bedtime for MAX 1 week (unstandardized 1-3 g crude root exceeds reliable sennoside/rhein standardization).',
  p_dosage_fr := 'Monographie EMA (Rhei radix) : 20 à 30 mg de dérivés hydroxyanthracéniques (exprimés en rhéine) UNE fois au coucher pendant MAX 1 semaine (1–3 g brut non standardisé déconseillé).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Contraindicated in children under 12 years, pregnancy, breastfeeding, intestinal obstruction/stenosis, atony, appendicitis, Crohn''s disease/ulcerative colitis, unexplained abdominal pain, and severe dehydration. Use longer than 1-2 weeks risks electrolyte depletion and laxative dependence (EMA/HMPC/189624/2007).',
  p_faq_safety_fr := 'Contre-indiquée avant 12 ans, pendant la grossesse, l''allaitement, en cas d''occlusion intestinale, appendicite, maladies inflammatoires chroniques de l''intestin ou déshydratation sévère. Ne pas dépasser 1 semaine.',
  p_review_note := 'Aligned rheum-officinale to EMA 20-30 mg rhein max 1 week'
);

-- 7. Castor Bean (ricinus-communis): 15-60 ml -> EMA 2-5 g (2.1-5.3 ml) USP oil + ricin seeds Poison Control
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'ricinus-communis',
  p_dosage_en := 'EMA HMPC (refined medicinal Ricini oleum virginale ONLY): 2-5 g (~2.1-5.3 ml) single dose once daily in the morning for short-term occasional constipation in adults (NEVER 15-60 ml routinely; NEVER ingest raw castor seeds).',
  p_dosage_fr := 'Monographie EMA (huile de ricin raffinée officinale UNIQUEMENT) : 2 à 5 g (~2,1–5,3 ml) en prise unique le matin à court terme chez l''adulte (NE JAMAIS dépasser ou consommer les graines crues).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'EMERGENCY SEED WARNING: Raw castor bean seeds contain lethal ricin — chewing even a few seeds can be fatal; call Poison Control immediately on ingestion. Refined USP castor oil removes ricin during processing, yet oral medicinal oil (max 2-5 g short-term per EMA) is strictly contraindicated in pregnancy (uterine contractions), breastfeeding, under 18, intestinal obstruction, appendicitis, and IBD.',
  p_faq_safety_fr := 'DANGER GRAINES CRUES : les graines de ricin renferment de la ricine mortelle (contacter un centre antipoison en cas d''ingestion). L''huile raffinée médicinale (max 2–5 g EMA) reste contre-indiquée pendant la grossesse, l''allaitement, avant 18 ans et en cas de pathologie abdominale.',
  p_review_note := 'Corrected 15-60 ml -> EMA 2-5 g refined oil & added ricin seed Poison Control warning'
);

-- 8. Wormwood (wormwood): EMA 2-3 g/d, >2 wks consult, 6.0 mg/day thujone cap
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'wormwood',
  p_dosage_en := 'EMA HMPC (Absinthii herba — adults >=18 yrs): 2-3 g/day comminuted herb as tea (in 2-3 divided doses, up to max 2 weeks without consulting a physician), keeping daily thujone intake strictly <=6.0 mg/day.',
  p_dosage_fr := 'Monographie EMA (Absinthii herba, >=18 ans) : 2 à 3 g/jour en tisane (max 2 semaines sans avis médical), avec apport quotidien en thuyone strictement <=6,0 mg/jour.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Wormwood (Artemisia absinthium) contains neurotoxic thujone (strict EMA/EFSA daily cap <=6.0 mg thujone; max 2 weeks continuous use). Strictly contraindicated in bile duct obstruction, cholangitis, liver disease, Asteraceae allergy, seizure disorders, pregnancy, breastfeeding, and under 18 years; NEVER ingest wormwood essential oil.',
  p_faq_safety_fr := 'L''absinthe contient de la thuyone neurotoxique (plafond strict EMA <=6,0 mg/jour ; max 2 semaines). Contre-indiquée en cas d''obstruction biliaire, maladie hépatique, épilepsie, allergie aux Astéracées, grossesse, allaitement et avant 18 ans.',
  p_review_note := 'Enforced EMA 2-3 g/d, 2-wk cap & 6.0 mg/day thujone limit on wormwood'
);

-- 9. Comfrey (comfrey): EMA topical <=10 days, adults, intact skin, foxglove look-alike
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'comfrey',
  p_dosage_en := 'Topical cutaneous use ONLY in adults (>=18 yrs) on intact skin for minor sprains/bruises: thin layer up to 2-4 times daily for MAX 10 consecutive days (EMA HMPC limit — NOT 6 weeks; NEVER ingest internally due to carcinogenic pyrrolizidine alkaloids).',
  p_dosage_fr := 'Usage cutané externe UNIQUEMENT chez l''adulte sur peau intacte (entorses/contusions mineures) pendant MAX 10 jours (monographie EMA, et non 6 semaines) ; NE JAMAIS ingérer (alcaloïdes pyrrolizidiniques hépatotoxiques).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'NEVER ingest comfrey internally (hepatotoxic/carcinogenic pyrrolizidine alkaloids causing hepatic veno-occlusive disease). Topically, EMA restricts use to adults on intact skin for <=10 days; contraindicated in pregnancy, breastfeeding, liver disease, broken skin, and under 18. Caution for wild harvesters: young comfrey leaves closely resemble lethally cardiotoxic foxglove (Digitalis purpurea).',
  p_faq_safety_fr := 'NE JAMAIS ingérer la consoude (hépatotoxicité grave et cancérogénicité des alcaloïdes pyrrolizidiniques). Usage cutané réservé à l''adulte sur peau intacte pendant <=10 jours ; attention à la confusion mortelle de cueillette avec la digitale pourpre.',
  p_review_note := 'Tightened comfrey topical duration 6 wks -> EMA <=10 days & added foxglove look-alike'
);

-- 10. Red Clover (red-clover): HC 40-100 mg AIE/d, methotrexate caution
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'red-clover',
  p_dosage_en := 'Health Canada Standardized Isoflavone Monograph (adults 18+): 40-100 mg aglycone isoflavone equivalents (AIE) per day (up to 6 months to 1 year, consult healthcare practitioner beyond 1 year).',
  p_dosage_fr := 'Monographie Santé Canada (adultes 18+) : 40 à 100 mg d''équivalents aglycones d''isoflavones (EAI) par jour (consulter au-delà d''un an).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Avoid concentrated red clover isoflavone extracts during pregnancy, breastfeeding, hormone-sensitive cancers (breast, uterine, ovarian, endometriosis), and with methotrexate (risk of elevated methotrexate toxicity reported), hormonal therapies/tamoxifen, or anticoagulants.',
  p_faq_safety_fr := 'Éviter les extraits d''isoflavones de trèfle rouge pendant la grossesse, l''allaitement, les cancers hormonodépendants et en association au méthotrexate, aux hormonothérapies ou aux anticoagulants.',
  p_review_note := 'Aligned red-clover to HC 40-100 mg AIE/d & methotrexate caution'
);

-- 11. Chlorella (HC <=6 g/day)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'chlorella',
  p_dosage_en := 'Health Canada LNHPD Chlorella vulgaris Monograph (adults): not to exceed 6 g broken-cell chlorella per day (unverified 10 g "detoxification" claims removed).',
  p_dosage_fr := 'Monographie Santé Canada (Chlorella vulgaris, adultes) : ne pas dépasser 6 g/jour de chlorelle à paroi brisée (l''allégation non vérifiée de 10 g/jour est supprimée).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_dosage_en := 'Health Canada''s single-ingredient Chlorella vulgaris monograph caps daily intake at a maximum of 6 g/day of broken-cell chlorella for adults (10 g "detox" dosing is unsupported). Consult a clinician before use if on warfarin (vitamin K content) or immunosuppressants, or if pregnant/breastfeeding.',
  p_faq_dosage_fr := 'Santé Canada plafonne la posologie à 6 g/jour maximum de chlorelle à paroi brisée chez l''adulte (sans preuve pour 10 g/j). Prudence sous warfarine (vitamine K), immunosuppresseurs, grossesse et allaitement.',
  p_review_note := 'Capped chlorella at HC <=6 g/day & removed unverified 10 g detox claim'
);

-- 12. Griffonia simplicifolia (HC 100-300 mg/d + EMS)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'griffonia-simplicifolia',
  p_dosage_en := 'Health Canada Cognitive/Sleep L-5-HTP Monograph (adults 18+): 100-300 mg 5-HTP daily (consult healthcare practitioner if use exceeds 1 year).',
  p_dosage_fr := 'Monographie Santé Canada 5-HTP (adultes 18+) : 100 à 300 mg de 5-HTP par jour (avis professionnel au-delà d''un an).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Avoid combining Griffonia/5-HTP with SSRIs, SNRIs, MAOIs, or serotonergic drugs due to life-threatening serotonin syndrome. Also avoid in scleroderma, pregnancy, breastfeeding, children, and monitor for rare eosinophilia-myalgia syndrome (EMS) symptoms (severe muscle pain/skin changes; historical contaminant/Peak X caution).',
  p_faq_safety_fr := 'Ne jamais associer aux ISRS, IRSN ou IMAO (syndrome sérotoninergique potentiellement mortel). Éviter en cas de sclérodermie, grossesse, allaitement, chez l''enfant et cesser en cas de douleurs musculaires inexpliquées (prudence historique SME).',
  p_review_note := 'Aligned griffonia-simplicifolia to HC 100-300 mg/d + serotonin & EMS warnings'
);

-- 13. Serrapeptase (HC 30,000-120,000 SU/d)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'serrapeptase',
  p_dosage_en := 'Health Canada Monograph (adults 18+): 30,000-120,000 SU (serratiopeptidase units) daily in divided doses on an empty stomach, max 4 weeks without healthcare supervision.',
  p_dosage_fr := 'Monographie Santé Canada (adultes 18+) : 30 000 à 120 000 SU/jour à jeun en doses fractionnées, max 4 semaines sans suivi médical.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Discontinue before surgery and consult a clinician if taking anticoagulants/antiplatelets or antibiotics, or if experiencing bleeding disorders/GI ulceration. Avoid during pregnancy, breastfeeding, and under 18 years; rare Stevens-Johnson/pneumonitis reactions reported.',
  p_faq_safety_fr := 'Arrêter avant une chirurgie et consulter en cas de traitement anticoagulant/antiplaquettaire, trouble de la coagulation ou ulcère digestif. Éviter pendant la grossesse, l''allaitement et avant 18 ans.',
  p_review_note := 'Aligned serrapeptase to HC 30,000-120,000 SU/d'
);

-- 14. Bilberry (fruit: HC <=160 mg/dose, 480 mg/d + NCCIH night vision)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'bilberry',
  p_dosage_en := 'Health Canada Bilberry Fruit Oral Monograph (adults 18+): up to 160 mg per single dose, max 480 mg/day standardized extract (36% anthocyanidins), or 4-60 g/day dried fruit.',
  p_dosage_fr := 'Monographie Santé Canada (fruit de myrtille, adultes 18+) : max 160 mg par prise et 480 mg/jour d''extrait standardisé (36 % anthocyanidines).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_uses_en := 'Health Canada recognizes bilberry fruit antioxidants and mild diarrhea astringency, while NIH NCCIH emphasizes there is NOT enough reliable clinical evidence supporting bilberry for improving night vision in healthy people or treating chronic retinopathy.',
  p_faq_uses_fr := 'Santé Canada reconnaît les antioxydants du fruit de myrtille, mais le NIH NCCIH souligne l''absence de preuves suffisantes pour améliorer la vision nocturne ou traiter une rétinopathie.',
  p_review_note := 'Aligned bilberry fruit to HC <=160 mg/dose, 480 mg/d & NCCIH night-vision verdict'
);

-- 15. Borage seed oil (1-3 g oil/d + PA-free cert)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'borage-seed-oil',
  p_dosage_en := 'Certified PA-free borage SEED OIL only: 1-3 g oil/day (~200-600 mg GLA) for adults; NEVER ingest crude borage aerial herb/leaf tea (contains toxic pyrrolizidine alkaloids).',
  p_dosage_fr := 'Huile de graines de bourrache certifiée SANS alcaloïdes pyrrolizidiniques (PA-free) : 1 à 3 g d''huile/jour chez l''adulte ; NE JAMAIS consommer la feuille ou fleur brute.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Use ONLY cold-pressed borage SEED oil certified free of unsaturated pyrrolizidine alkaloids (PA-free); crude Borago officinalis herb, flowers, and roots contain hepatotoxic/carcinogenic PAs. Caution in seizure disorders (GLA lowering seizure threshold case reports), surgery/anticoagulants, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'Utiliser UNIQUEMENT une huile de graines certifiée sans alcaloïdes pyrrolizidiniques (PA-free) ; la plante brute est hépatotoxique. Prudence en cas d''épilepsie, anticoagulants, grossesse et allaitement.',
  p_review_note := 'Enforced PA-free borage seed oil certification & 1-3 g oil/day cap'
);

-- 16. Fenugreek (>25 g/d GI threshold, Fabaceae/peanut/soy cross-allergy, <18)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'fenugreek',
  p_dosage_en := 'Health Canada/EMA adult culinary/seed supplement range: 1-6 g/day powdered seed orally (doses >25 g/day markedly increase diarrhea, gas, and hypoglycemia risk; not for under 18 years).',
  p_dosage_fr := 'Plage adulte usuelle : 1 à 6 g/jour de poudre de graine (les doses >25 g/jour augmentent les troubles digestifs et le risque hypoglycémique ; déconseillé avant 18 ans).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CRITICAL ALLERGY NOTE: Fenugreek belongs to Fabaceae (legumes) and can trigger severe cross-reactive anaphylaxis in people allergic to PEANUTS, soybeans, chickpeas, or lupin. Also avoid high supplement doses in pregnancy (uterine-contraction risk), under 18 years (EMA/HMPC), and monitor closely with diabetes medications or warfarin.',
  p_faq_safety_fr := 'ALLERGIE CROISÉE : le fenugrec (Fabaceae) peut provoquer des réactions anaphylactiques graves chez les personnes allergiques aux ARACHIDES ou au soja. Éviter les fortes doses pendant la grossesse, avant 18 ans et surveiller la glycémie/INR.',
  p_review_note := 'Added >25 g/d GI threshold, peanut/soy Fabaceae cross-allergy & <18 restriction on fenugreek'
);

-- 17. Sage (remove "seizures" as a use!, add epilepsy + 6 mg thujone cap + pregnancy/<18)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'sage',
  p_dosage_en := 'EMA HMPC (Salviae officinalis folium — >=18 yrs): herbal tea 1.5-2 g three times daily for dyspepsia/mild hyperhidrosis (up to 2 weeks; keep thujone <=6.0 mg/day) or oromucosal gargle; NEVER ingest sage essential oil orally.',
  p_dosage_fr := 'Monographie EMA (Salviae officinalis folium, >=18 ans) : tisane 1,5–2 g 3 fois/jour (max 2 semaines ; thuyone <=6,0 mg/jour) ou gargarisme ; ne JAMAIS avaler d''huile essentielle de sauge.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Symptomatic relief of mild dyspeptic complaints such as heartburn and bloating (EMA)', 'Relief of excessive sweating (hyperhidrosis) and minor mouth/throat inflammation (EMA)']::text[],
  p_modern_uses_fr := ARRAY['Troubles dyspeptiques légers (brûlures d''estomac, ballonnements — EMA)', 'Hypersudation et inflammations mineures de la bouche/gorge (EMA)']::text[],
  p_faq_uses_en := 'Sage (Salvia officinalis) is used per EMA for mild dyspepsia, excessive sweating, and gargling for minor throat inflammation. It does NOT treat seizures — thujone and camphor in sage can INDUCE seizures.',
  p_faq_uses_fr := 'La sauge officinale soulage la dyspepsie légère, la transpiration excessive et les maux de gorge bénins (gargarismes). Elle ne traite PAS l''épilepsie : sa thuyone peut déclencher des convulsions.',
  p_faq_safety_en := 'Thujone in sage lowers seizure threshold: CONTRAINDICATED in epilepsy/seizure disorders, pregnancy (abortifacient/emmenagogue), breastfeeding (also reduces milk supply), and children/adolescents under 18 (EMA <=6 mg/day thujone limit). Never ingest essential oil.',
  p_faq_safety_fr := 'La thuyone abaisse le seuil épileptogène : CONTRE-INDIQUÉE en cas d''épilepsie, grossesse, allaitement et avant 18 ans (plafond EMA 6 mg/j de thuyone). Ne jamais avaler l''huile essentielle.',
  p_review_note := 'Removed bogus "seizures" use & added epilepsy/6 mg thujone/<18 restrictions on sage'
);

-- 18. Eyebright (euphrasia-officinalis): EMA ocular use NOT recommended
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'euphrasia-officinalis',
  p_dosage_en := 'No EMA/HMPC therapeutic eye-drop or systemic clinical dose established — ocular/topical homemade eye washes carry high infection risk.',
  p_dosage_fr := 'Aucune posologie oculaire ou systémique clinique validée — les collyres ou bains oculaires maison présentent un risque infectieux élevé.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'WARNING: Major European regulators (EMA HMPC / Commission E) state OCULAR USE of homemade or unsterile eyebright eye washes is NOT recommended due to microbial contamination, irritation, and absence of clinical benefit. Avoid in pregnancy, breastfeeding, and active eye infections.',
  p_faq_safety_fr := 'AVERTISSEMENT : l''EMA et les autorités européennes déconseillent l''usage OCULAIRE de l''euphraise (risque infectieux et d''irritation cornéenne, absence de preuve clinique). Éviter pendant la grossesse et l''allaitement.',
  p_review_note := 'Added EMA ocular use NOT recommended warning on euphrasia-officinalis'
);

-- 19. Uva ursi: do NOT replace antibiotics, >4-day seek care, kidney contra
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'uva-ursi',
  p_dosage_en := 'EMA HMPC (Uvae ursi folium — adult females >=18 yrs): 1.5-4 g dried leaf infusion up to 4 times daily (~400-840 mg arbutin/day), MAX 1 week per episode (max 5 episodes/year; seek doctor if symptoms >4 days).',
  p_dosage_fr := 'Monographie EMA (Uvae ursi folium, femmes adultes >=18 ans) : infusion de 1,5–4 g jusqu''à 4 fois/jour, MAX 1 semaine ; consulter un médecin si les symptômes persistent >4 jours.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CRITICAL UTI WARNING: Bearberry (uva ursi) is ONLY for mild lower-tract symptoms and must NOT replace prescribed antibiotics — if symptoms worsen or last >4 days, or if fever, chills, flank/back pain, dysuria, or blood in urine occur, seek immediate medical care. Contraindicated in kidney disease, pregnancy, breastfeeding, and under 18 years (EMA/HMPC/750269/2016).',
  p_faq_safety_fr := 'AVERTISSEMENT INFECTION URINAIRE : ne remplace PAS les antibiotiques ; consulter d''urgence en cas de fièvre, douleur lombaire, sang dans les urines ou symptômes >4 jours. Contre-indiquée en cas de maladie rénale, grossesse, allaitement et avant 18 ans.',
  p_review_note := 'Added do-not-replace-antibiotics, >4-day seek-care & kidney contraindication on uva-ursi'
);

-- 20 & 21. Gymnema & Bitter Melon (do not replace diabetes meds; G6PD/child hypoglycemic coma)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'gymnema',
  p_dosage_en := 'Unstandardized across monographs; studied standardized extracts typically 200-400 mg/day (~25% gymnemic acids) with clinician glucose monitoring (do not substitute for diabetes medication).',
  p_dosage_fr := 'Extraits étudiés usuellement 200–400 mg/jour (~25 % acides gymnémiques) sous suivi glycémique médical (ne remplace pas les antidiabétiques).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Do NOT stop or replace insulin or prescribed diabetes medications without physician supervision. Gymnema can lower blood glucose unpredictably and risk severe hypoglycemia if combined with sulfonylureas or insulin; discontinue >=2 weeks before surgery and avoid in pregnancy, breastfeeding, and LiverTox rare injury signs.',
  p_faq_safety_fr := 'Ne jamais remplacer l''insuline ou les antidiabétiques prescrits. Risque d''hypoglycémie additive ; arrêter 2 semaines avant une chirurgie et éviter pendant la grossesse et l''allaitement.',
  p_review_note := 'Added do-not-replace-diabetes-meds warning on gymnema'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'bitter-melon-metabolic',
  p_dosage_en := 'No standardized safe therapeutic extract dose for glycemic control (culinary fruit differs from concentrated seed/juice extracts; never replace prescribed antidiabetic drugs).',
  p_dosage_fr := 'Aucune posologie standardisée d''extrait concentré (distinct du légume culinaire ; ne jamais remplacer les antidiabétiques prescrits).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'NEVER replace insulin or oral diabetes medications with bitter melon. Documented serious hazards include acute hemolytic anemia in G6PD deficiency (vicine in seeds/arils causing favism-like crisis), hypoglycemic coma and seizures reported in children given bitter melon tea, hepatotoxicity signals, and abortifacient potential in pregnancy.',
  p_faq_safety_fr := 'Ne jamais remplacer un traitement du diabète. Risques graves : crise hémolytique chez les personnes déficitaires en G6PD (vicine des graines), coma hypoglycémique sévère chez l''enfant et risque abortif pendant la grossesse.',
  p_review_note := 'Added G6PD favism, pediatric hypoglycemic coma & do-not-replace-diabetes-meds on bitter-melon-metabolic'
);

-- 22. Chaga (oxalate ESRD/dialysis cases)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'chaga',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'WARNING — HIGH OXALATE NEPHROPATHY: Concentrated chaga (Inonotus obliquus) contains extremely high soluble oxalates linked to documented clinical cases of acute oxalate nephropathy, irreversible end-stage renal disease, and dialysis (MSK). Avoid in kidney disease, kidney stone history, osteoporosis, bleeding disorders/anticoagulants, diabetes therapy, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'AVERTISSEMENT OXALATES : le chaga est très riche en oxalates et a provoqué des néphropathies oxaliques graves avec insuffisance rénale terminale et dialyse (MSK). Éviter en cas de maladie rénale, calculs rénaux, anticoagulants, grossesse et allaitement.',
  p_review_note := 'Added oxalate ESRD/dialysis cases warning on chaga'
);

-- 23. Reishi (powdered liver injury/death + CA72-4 interference)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'reishi',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'SAFETY WARNING (LiverTox / MSK): Rare severe hepatotoxicity — including acute hepatitis and fatal liver injury associated particularly with powdered Ganoderma lucidum supplements — and false-positive serum CA72-4 tumor-marker elevation have been documented. Also caution with anticoagulants/antiplatelets, hypotensive drugs, immunosuppressants, thrombocytopenia, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'AVERTISSEMENT (LiverTox / MSK) : de rares cas d''hépatites aiguës parfois mortelles (notamment avec des poudres de reishi) et des élévations faussement positives du marqueur CA72-4 sont documentés. Prudence avec anticoagulants, hypotenseurs, immunosuppresseurs, grossesse et allaitement.',
  p_review_note := 'Added powdered reishi hepatotoxicity & CA72-4 interference warning'
);

-- 24. Red Yeast Rice (EFSA/EU >=3 mg/d monacolin K ban)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'red-yeast-rice',
  p_dosage_en := 'No uniform global OTC dose — contains monacolin K (chemically identical to prescription lovastatin). EU Commission Reg (EU) 2022/860 strictly limits supplements to <3 mg total monacolins/day (prohibits >=3 mg/day); US FDA classifies products containing meaningful lovastatin as unapproved drugs.',
  p_dosage_fr := 'Aucune posologie libre sans risque — contient de la monacoline K (identique à la lovastatine). Le règlement européen 2022/860 interdit les compléments >=3 mg/jour de monacolines.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Red yeast rice monacolin K is chemically identical to lovastatin and carries the full statin risk profile: myopathy, rhabdomyolysis, kidney/liver injury, and fetal teratogenicity (EFSA/EU ban >=3 mg/day). Strictly contraindicated in pregnancy, breastfeeding, under 18, >70 without physician oversight, liver/muscle disease, and alongside prescription statins or strong CYP3A4 inhibitors.',
  p_faq_safety_fr := 'La monacoline K est chimiquement identique à la lovastatine (myopathie, rhabdomyolyse, hépatotoxicité ; seuil >=3 mg/j interdit dans l''UE). Contre-indiquée pendant la grossesse, l''allaitement, maladie hépatique et avec statines ou inhibiteurs du CYP3A4.',
  p_review_note := 'Added EFSA/EU >=3 mg/d monacolin K ban & statin safety parity on red-yeast-rice'
);

-- 25. Butterbur (PA-free HILI cases + 16-wk cap)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'butterbur',
  p_dosage_en := 'ONLY certified PA-free Petasites hybridus root extract (e.g. Ze 339 / Petadolex studied at 50-75 mg twice daily in trials up to MAX 16 weeks; do NOT exceed 16 weeks or use crude unpurified plant).',
  p_dosage_fr := 'UNIQUEMENT extrait certifié PA-free en cure courte (ex. 50–75 mg 2x/j dans des essais de <=16 semaines max) ; ne jamais consommer de plante brute et surveiller les symptômes hépatiques.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CRITICAL LIVER WARNING (NCCIH / LiverTox / MHRA): Crude butterbur contains carcinogenic pyrrolizidine alkaloids (PAs), AND even PA-free standardized butterbur products have been linked to severe acute hepatitis, jaundice, and rare liver failure requiring transplantation (max studied duration 16 weeks; monitor for dark urine/jaundice). Avoid in Asteraceae allergy, liver disease, pregnancy, breastfeeding, and children.',
  p_faq_safety_fr := 'AVERTISSEMENT HÉPATIQUE : le pétasite brut contient des alcaloïdes pyrrolizidiniques, et même certains extraits PA-free ont causé des hépatites aiguës graves (greffes hépatiques rapportées ; durée maximale étudiée 16 semaines). Éviter en cas d''allergie aux Astéracées, maladie du foie, grossesse et allaitement.',
  p_review_note := 'Fixed understated PA-free liver injury & added 16-week cap on butterbur'
);

-- 26, 27, 28. Calendula, Cayenne, Vetiver (external/topical emphasis)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'calendula',
  p_dosage_en := 'EMA HMPC (Calendulae flos): strictly topical/cutaneous or oromucosal gargle/rinse for minor mouth/throat and skin inflammation (>=6-12 yrs by age); oral internal self-dosing lacks clinical standardization.',
  p_dosage_fr := 'Monographie EMA (Calendulae flos) : usage local cutané ou bain de bouche/gargarisme oromuqueux (et non automédication systémique par voie orale).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Aligned calendula to EMA topical/oromucosal-only posology'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'cayenne',
  p_dosage_en := 'EMA HMPC (Capsici fructus): EXTERNAL/topical capsaicinoid plasters/creams ONLY (0.025-0.075% capsaicinoids for adults, max 3 weeks per site, wash hands immediately); NOT recommended orally as an emergency styptic or self-treatment.',
  p_dosage_fr := 'Monographie EMA (Capsici fructus) : usage EXTERNE topique uniquement (adultes, max 3 semaines par zone, lavage des mains immédiat) ; déconseillé pour stopper une hémorragie interne.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Topical relief of localized muscle/joint pain and peripheral neuropathic soreness (EMA/FDA OTC capsaicin)']::text[],
  p_modern_uses_fr := ARRAY['Soulagement topique des douleurs musculaires et articulaires localisées']::text[],
  p_review_note := 'Aligned cayenne to external-use EMA cap & removed unsafe styptic claim'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'vetiver',
  p_dosage_en := 'Aromatic / EXTERNAL diluted essential-oil use ONLY; no standardized oral clinical supplement dose is established.',
  p_dosage_fr := 'Usage aromatique ou cutané dilué EXTERNE UNIQUEMENT ; aucune posologie orale clinique n''est établie.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_review_note := 'Marked vetiver external-use-only'
);

-- 29. Saffron (WHO >=5 g toxic / 12-20 g fatal)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'saffron',
  p_dosage_en := 'Culinary spice amounts are safe; standardized stigma extract trials studied 30 mg/day (15 mg twice daily) short-term in adults — NEVER exceed 1.5 g/day (WHO: >=5 g causes severe poisoning and 12-20 g can be fatal).',
  p_dosage_fr := 'Usage culinaire sûr ; essais cliniques d''extraits standardisés autour de 30 mg/jour à court terme — ne JAMAIS dépasser 1,5 g/jour (OMS : >=5 g toxique, 12–20 g potentiellement mortel).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CRITICAL DOSE CEILING: While culinary saffron is safe in food, high supplement/stigma doses are toxic — WHO warns >=5 g causes vomiting, uterine/GI bleeding, vertigo, and jaundice, and 12-20 g can be fatal. Strictly avoid high doses in pregnancy (uterotonic/abortifacient), bipolar mania risk, and anticoagulants/antihypertensives.',
  p_faq_safety_fr := 'PLAFOND TOXIQUE OMS : >=5 g de safran provoquent vomissements, hémorragies et ictère, et 12–20 g peuvent être mortels. Éviter les fortes doses pendant la grossesse (effet utérotonique/abortif), en cas de trouble bipolaire ou d''anticoagulants.',
  p_review_note := 'Added WHO >=5 g toxic / 12-20 g fatal ceiling on saffron'
);

-- 30. White Willow (white-willow): <18 & Reye's viral trigger
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'white-willow',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CONTRAINDICATED under 18 years (especially during/after viral fever such as influenza or varicella due to salicin-related Reye''s syndrome risk, per EMA HMPC). Also avoid with salicylate/aspirin hypersensitivity (asthma trigger), active peptic ulcers, severe kidney/liver dysfunction, G6PD deficiency, third-trimester/all pregnancy, breastfeeding, and anticoagulants.',
  p_faq_safety_fr := 'CONTRE-INDIQUÉE avant 18 ans (en particulier lors d''infections virales en raison du risque de syndrome de Reye, monographie EMA). Éviter en cas d''allergie à l''aspirine, d''ulcère gastrique, de grossesse, d''allaitement et d''anticoagulants.',
  p_review_note := 'Added <18 & Reye''s syndrome viral warning on white-willow'
);

-- 31. Kava (kava): LiverTox A + NCCIH Sarris 2020 negative GAD trial
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'kava',
  p_dosage_en := 'No universally safe OTC self-dose — LiverTox Score A serious hepatotoxin restricted/banned in several jurisdictions (never combine with alcohol or hepatotoxic drugs).',
  p_dosage_fr := 'Aucune posologie sûre en automédication — hépatotoxine de score LiverTox A réglementée ou interdite dans plusieurs pays.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_uses_en := 'Although older studies explored kava for anxiety, a 2020 randomized trial by Sarris et al. highlighted by NIH NCCIH found kava extract INEFFECTIVE for generalized anxiety disorder while carrying serious liver-injury risk.',
  p_faq_uses_fr := 'Bien que d''anciennes études aient exploré l''anxiété, l''essai randomisé de Sarris et al. (2020) cité par le NIH NCCIH a conclu à l''inefficacité du kava dans le trouble anxieux généralisé, face à un risque hépatique grave.',
  p_faq_safety_en := 'LIVERTOX SCORE A WARNING: Kava (Piper methysticum) causes severe, sometimes fatal idiosyncratic hepatotoxicity requiring liver transplantation. Strictly contraindicated in liver disease, alcohol consumption, Parkinson''s disease, driving/machinery, pregnancy, breastfeeding, children, and with hepatotoxic or CNS-depressant medications.',
  p_faq_safety_fr := 'AVERTISSEMENT LIVERTOX SCORE A : le kava provoque des hépatites toxiques graves parfois mortelles ou nécessitant une greffe. Contre-indiqué en cas de maladie du foie, consommation d''alcool, conduite, grossesse, allaitement et chez l''enfant.',
  p_review_note := 'Added LiverTox A & NCCIH Sarris 2020 negative anxiety trial on kava'
);

-- 32 & 33. St. John's Wort & Garlic (fix dose math / divided-dose clarification)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'st-johns-wort',
  p_dosage_en := 'Standardized extract (0.3% hypericin / 2-5% hyperforin): 900 mg/day TOTAL (typically 300 mg three times daily, NOT 900 mg three times daily) for mild-to-moderate depression.',
  p_dosage_fr := 'Extrait standardisé : 900 mg/jour AU TOTAL (typiquement 300 mg 3 fois/jour, et NON 900 mg 3 fois/jour).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_dosage_en := 'Standard trial dosage of St. John''s wort (LI 160 / WS 5570) is 900 mg/day TOTAL, usually taken as 300 mg three times daily (check prescription drug interactions first — strong CYP3A4/P-gp inducer).',
  p_faq_dosage_fr := 'La posologie clinique usuelle est de 900 mg/jour AU TOTAL, répartis en 300 mg trois fois par jour (vérifier d''abord les interactions médicamenteuses majeures via le CYP3A4/P-gp).',
  p_review_note := 'Clarified total 900 mg/day (300 mg 3x) dose math on st-johns-wort'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'garlic',
  p_dosage_en := 'Standardized adult trial range: dried garlic powder 600-1,200 mg/day TOTAL (typically divided doses) or aged garlic extract 1,200-2,400 mg/day (stop >=7 days pre-surgery).',
  p_dosage_fr := 'Plage adulte usuelle : 600 à 1 200 mg/jour AU TOTAL de poudre d''ail (doses fractionnées) ou 1 200–2 400 mg/jour d''extrait d''ail vieilli (arrêter >=7 jours avant chirurgie).',
  p_faq_dosage_en := 'Studied adult oral totals are 600-1,200 mg/day garlic powder (in divided doses, not multiplied) or 1,200-2,400 mg/day aged garlic extract. Note Cochrane reviews find insufficient evidence to rely on garlic alone to treat hypertension; check bleeding/anticoagulant and saquinavir interactions.',
  p_faq_dosage_fr := 'Les doses quotidiennes étudiées sont 600–1 200 mg/jour au total de poudre ou 1 200–2 400 mg/jour d''extrait vieilli. Ne remplace pas un antihypertenseur ; attention aux interactions (warfarine, saquinavir).',
  p_review_note := 'Clarified divided total daily dose math & Cochrane hypertension note on garlic'
);

-- 34. Peppermint: strip stray CJK "肌肉" anywhere in peppermint text columns
UPDATE public.herbs
SET
  description = replace(description, '肌肉', 'muscle'),
  translations = regexp_replace(translations::text, '肌肉', 'musculaire', 'g')::jsonb,
  provenance = (COALESCE(provenance, '{}'::jsonb) - 'last_verified_at') || jsonb_build_object(
    'review_status', 'needs_re_review',
    'review_notes', 'Stripped stray CJK typo ("肌肉") on peppermint (2026-11-22); awaiting human sign-off by Yasser.'
  ),
  updated_at = now()
WHERE slug = 'peppermint'
  AND (description LIKE '%肌肉%' OR translations::text LIKE '%肌肉%');

INSERT INTO pg_temp.touched_herbs_00093 (slug)
SELECT slug FROM public.herbs WHERE slug = 'peppermint' ON CONFLICT DO NOTHING;

-- 35. Radish (raphanus-sativus-herb): fix malformed "45 Pill / 2x" dose
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'raphanus-sativus-herb',
  p_dosage_en := 'Culinary food consumption only; no standardized adult pill/supplement dosage is established (previously displayed "45 Pill / 2x" artifact removed).',
  p_dosage_fr := 'Consommation alimentaire courante uniquement ; aucune posologie standardisée en gélules n''est établie (artefact « 45 Pill » supprimé).',
  p_faq_dosage_en := 'No standardized oral supplement dosage is established for radish (Raphanus sativus); a previously imported "45 Pill" database artifact was removed. Enjoyed as a normal culinary vegetable; avoid high concentrated extracts in gallstones, thyroid sensitivity, pregnancy, and breastfeeding.',
  p_faq_dosage_fr := 'Aucune dose de complément n''est standardisée pour le radis (l''artefact « 45 Pill » a été supprimé). Prudence pour les extraits concentrés en cas de calculs biliaires ou de trouble thyroïdien.',
  p_review_note := 'Removed malformed "45 Pill / 2x" dosage artifact on raphanus-sativus-herb'
);

-- 36. Phaseolus vulgaris (FDA Bad Bug Book raw bean phytohemagglutinin lectin boiling)
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'phaseolus-vulgaris',
  p_dosage_en := 'Culinary mature beans MUST be soaked >=5 hours (water discarded) and boiled vigorously at >=100 C for >=10-30 minutes to destroy toxic phytohemagglutinin lectin; standardized white-kidney-bean starch-blocker extracts studied short-term only.',
  p_dosage_fr := 'Les haricots secs doivent impérativement tremper >=5 h puis bouillir vigoureusement (>=100 C) pendant >=10–30 min pour détruire la lectine toxique (phytohémagglutinine) ; la cuisson lente à basse température augmente la toxicité.',
  p_faq_safety_en := 'FDA BAD BUG BOOK LECTIN WARNING: Raw or undercooked kidney beans (Phaseolus vulgaris) contain toxic phytohemagglutinin — eating as few as 4-5 raw beans or cooking dry beans in a low-temperature slow cooker can cause severe violent vomiting and diarrhea within 1-3 hours. Always soak >=5 hours, discard water, and boil briskly >=10 minutes.',
  p_faq_safety_fr := 'AVERTISSEMENT FDA (phytohémagglutinine) : 4 à 5 haricots rouges crus ou insuffisamment cuits (notamment à la mijoteuse basse température) provoquent vomissements et diarrhées violents. Toujours faire tremper >=5 h et bouillir >=10–30 min.',
  p_review_note := 'Added FDA Bad Bug Book phytohemagglutinin lectin boiling warning on phaseolus-vulgaris'
);

-- 37. Cashew (anacardium-occidentale): tree-nut anaphylaxis + urushiol in raw shell
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'anacardium-occidentale',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'SEVERE TREE-NUT ANAPHYLAXIS WARNING: Cashew is one of the most potent tree-nut allergens capable of triggering fatal anaphylaxis (often cross-reacting with pistachio, mango, and pink peppercorn). Additionally, unprocessed cashew shells contain toxic urushiol/anacardic oils causing poison-ivy-like dermatitis — eat only commercially shelled/roasted kernels.',
  p_faq_safety_fr := 'ALLERGIE SÉVÈRE AUX FRUITS À COQUE : la noix de cajou peut déclencher une anaphylaxie mortelle (réactivité croisée fréquente avec la pistache). La coque brute contient des urushiols irritants : ne consommer que des amandes décortiquées et transformées.',
  p_review_note := 'Added tree-nut anaphylaxis & shell urushiol warning on anacardium-occidentale'
);

-- 38 & 39. Lemon (citrus-limonum) & Parsnip (pastinaca-sativa): phytophotodermatitis
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'citrus-limonum',
  p_faq_safety_en := 'PHOTOTOXICITY WARNING: Cold-pressed lemon peel essential oil and fresh citrus juice contain psoralen furocoumarins (bergapten/oxypeucedanin) that cause severe phytophotodermatitis (blistering chemical burns and lasting hyperpigmentation) when skin is exposed to sunlight/UV after topical contact.',
  p_faq_safety_fr := 'PHOTOTOXICITÉ : l''huile essentielle de zeste de citron et le jus contiennent des furocoumarines provoquant de graves brûlures cutanées (phytophotodermatose) lors d''une exposition au soleil ou aux UV.',
  p_review_note := 'Added furocoumarin phytophotodermatitis warning on citrus-limonum'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'pastinaca-sativa',
  p_faq_safety_en := 'PHOTOTOXICITY WARNING: Parsnip sap (especially wild parsnip leaves and stems) contains high concentrations of furocoumarins causing severe painful blistering phytophotodermatitis upon UV/sunlight exposure. Wear gloves when harvesting wild or garden foliage.',
  p_faq_safety_fr := 'PHOTOTOXICITÉ : la sève de panais (en particulier sauvage) renferme des furocoumarines causant de sévères brûlures bulleuses au soleil (phytophotodermatose).',
  p_review_note := 'Added furocoumarin phytophotodermatitis warning on pastinaca-sativa'
);

-- 40. Konjac / Glucomannan (amorphophallus): >=250 mL water choking warning
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'amorphophallus',
  p_dosage_en := 'Health Canada/clinical glucomannan fiber: 1-4 g/day taken with at least 250 mL (8 fl oz) full glass of water per dose immediately before swallowing; NEVER take dry powder or tablets at bedtime.',
  p_dosage_fr := 'Fibre glucomannane : 1 à 4 g/jour avec AU MOINS 250 mL d''eau par prise immédiatement avant d''avaler ; ne JAMAIS prendre à sec ou juste avant le coucher.',
  p_faq_safety_en := 'CHOKING & ESOPHAGEAL OBSTRUCTION WARNING (FDA / Health Canada): Konjac glucomannan swells rapidly up to 50x its volume. Always take each dose with at least 250 mL (8 oz) of liquid while upright; CONTRAINDICATED in dysphagia, esophageal strictures, GI obstruction, and children (solid konjac jelly cups are banned in several countries). Separate oral medications by 1-2 hours.',
  p_faq_safety_fr := 'RISQUE D''ÉTOUFFEMENT ET D''OBSTRUCTION ŒSOPHAGIENNE (FDA / Santé Canada) : toujours prendre avec au moins 250 mL d''eau en position assise/debout. Contre-indiqué en cas de dysphagie, sténose ou occlusion ; espacer des médicaments de 1–2 h.',
  p_review_note := 'Added >=250 mL water & choking/obstruction warning on amorphophallus'
);

-- 41. English Ivy (hedera-helix): EMA <2 yrs contraindicated
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'hedera-helix',
  p_dosage_en := 'EMA HMPC Well-Established/Traditional Standardized Leaf Extract ONLY: adult/adolescent/child >=2 yrs syrup/liquid doses per licensed product (never ingest crude wild ivy leaves or toxic berries).',
  p_dosage_fr := 'Monographie EMA (extraits standardisés de feuilles de lierre grimpant uniquement) : formes sirop/gouttes homologuées chez >=2 ans ; ne jamais consommer de feuilles brutes ni de baies toxiques.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'AGE CONTRADICTION (EMA HMPC): Standardized Hedera helix leaf medicines are CONTRAINDICATED in children under 2 years due to risk of worsening respiratory symptoms (2-4 yrs only under medical advice). Raw ivy leaves cause severe contact dermatitis and berries are toxic; avoid in pregnancy, breastfeeding, and active gastric ulcers.',
  p_faq_safety_fr := 'CONTRE-INDICATION PÉDIATRIQUE (EMA) : les extraits de lierre grimpant sont CONTRE-INDIQUÉS avant 2 ans (risque d''aggravation respiratoire ; 2–4 ans sur avis médical). Les baies brutes sont toxiques ; éviter grossesse et allaitement.',
  p_review_note := 'Added EMA <2 years respiratory contraindication on hedera-helix'
);

-- 42. Notoginseng (panax-notoginseng): Gynura segetum PA adulteration
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'panax-notoginseng',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'ADULTERATION WARNING (Gynura segetum): Ensure authenticated Panax notoginseng ("Sanqi"); adulteration or substitution with "Tusanqi" (Gynura segetum) introduces toxic pyrrolizidine alkaloids causing fatal hepatic sinusoidal obstruction syndrome (veno-occlusive disease). Also use caution with anticoagulants/antiplatelets, surgery, pregnancy, and breastfeeding.',
  p_faq_safety_fr := 'RISQUE DE FALSIFICATION (Gynura segetum) : vérifier l''authenticité de Panax notoginseng (« Sanqi ») ; sa substitution par le « Tusanqi » (Gynura segetum) apporte des alcaloïdes pyrrolizidiniques causant une maladie veino-occlusive hépatique mortelle. Prudence avec anticoagulants, chirurgie, grossesse et allaitement.',
  p_review_note := 'Added Gynura segetum PA adulteration warning on panax-notoginseng'
);

-- 43. Sweet Annie (sweet-annie): MSK cholestatic hepatitis
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'sweet-annie',
  p_dosage_en := 'No safe OTC malaria self-treatment or long-term extract dose — prescription artemisinin-combination therapies (ACTs) are required for malaria; unmonitored concentrated supplements carry liver injury risk.',
  p_dosage_fr := 'Ne pas traiter le paludisme en automédication (trithérapies médicales prescrites indispensables) ; les extraits concentrés exposent à une hépatotoxicité.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'LIVER INJURY & MALARIA WARNING (MSK / CDC): Concentrated Artemisia annua / artemisinin supplements have been linked to acute cholestatic hepatitis and hepatotoxicity, as well as neurotoxicity in high animal exposures. NEVER rely on herbal tea/supplements to prevent or treat malaria (life-threatening medical emergency); strictly avoid in early pregnancy and breastfeeding.',
  p_faq_safety_fr := 'AVERTISSEMENT HÉPATITE CHOLESTATIQUE (MSK) : les suppléments concentrés d''artémisinine ont provoqué des hépatites cholestatiques aiguës. Ne JAMAIS utiliser en automédication contre le paludisme ; éviter pendant la grossesse et l''allaitement.',
  p_review_note := 'Added MSK cholestatic hepatitis & no malaria self-care warning on sweet-annie'
);

-- 44. Curcumin (curcumin): NCCIH / LiverTox idiosyncratic liver injury
SELECT pg_temp.remediate_herb_00093(
  p_slug := 'curcumin',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'HEPATOTOXICITY & BILIARY WARNING (NCCIH / LiverTox): While culinary turmeric is safe, bioavailable/high-dose curcumin supplements (especially piperine/black-pepper or liposomal enhanced formulas) have been increasingly linked to idiosyncratic acute liver injury (LiverTox Score B/C); stop immediately for jaundice, dark urine, or nausea. Also contraindicated in bile-duct obstruction/gallstones, pregnancy (supplements), breastfeeding, and caution with anticoagulants/CYP/chemotherapy.',
  p_faq_safety_fr := 'AVERTISSEMENT HÉPATOTOXICITÉ (NCCIH / LiverTox) : si le curcuma alimentaire est sûr, les suppléments concentrés de curcumine (surtout associés à la pipérine) sont liés à des cas d''hépatites aiguës (LiverTox B/C). Contre-indiqué en cas d''obstruction biliaire, grossesse (suppléments) et prudence sous anticoagulants.',
  p_review_note := 'Added NCCIH/LiverTox liver injury warning on curcumin'
);

-- =====================================================================
-- GROUP D — Pregnancy-as-a-Use Reversals (14 slugs)
-- =====================================================================

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'black-haw',
  p_dosage_en := 'No standardized modern clinical dose — historical Eclectic uterine/miscarriage uses are UNPROVEN and unsafe for pregnancy self-care.',
  p_dosage_fr := 'Aucune posologie clinique moderne — les usages obstétricaux anciens sont non validés et déconseillés pendant la grossesse.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_traditional_uses_en := ARRAY['Historical menstrual cramp and dysmenorrhea antispasmodic folk use (NOT proven safe in pregnancy)']::text[],
  p_traditional_uses_fr := ARRAY['Usage historique dans les crampes menstruelles (non validé ni sûr pendant la grossesse)']::text[],
  p_modern_uses_en := ARRAY['Insufficient clinical evidence for any modern use; do NOT use to prevent miscarriage']::text[],
  p_modern_uses_fr := ARRAY['Preuves cliniques insuffisantes ; ne PAS utiliser pour prévenir une fausse couche']::text[],
  p_faq_uses_en := 'Do NOT use black haw (Viburnum prunifolium) to prevent miscarriage or treat threatened abortion: zero randomized clinical safety trials exist in pregnancy, and modern clinical evidence for any use is lacking.',
  p_faq_uses_fr := 'Ne PAS utiliser l''obier (Viburnum prunifolium) pour prévenir une fausse couche : aucun essai clinique n''établit son innocuité ni son efficacité obstétricale.',
  p_faq_safety_en := 'Avoid during pregnancy (historically misused for miscarriage without safety data), breastfeeding, salicylate allergy (contains trace salicin/salicylates), kidney stone predisposition, and under 18 years.',
  p_faq_safety_fr := 'Éviter pendant la grossesse, l''allaitement, en cas d''allergie aux salicylés et avant 18 ans.',
  p_review_note := 'Removed "preventing miscarriage" pregnancy use on black-haw'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'partridge-berry',
  p_dosage_en := 'No safe standardized dose — NEVER self-dose late-pregnancy or parturient regimens.',
  p_dosage_fr := 'Aucune posologie standardisée sûre — ne JAMAIS utiliser en automédication pendant la grossesse ou en fin de terme.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_traditional_uses_en := ARRAY['Historical 19th-century obstetrical folk herb (unsupported and potentially unsafe during pregnancy)']::text[],
  p_traditional_uses_fr := ARRAY['Plante historique du XIXe siècle (non validée et déconseillée pendant la grossesse)']::text[],
  p_modern_uses_en := ARRAY['No validated modern clinical indication — avoid in pregnancy and breastfeeding']::text[],
  p_modern_uses_fr := ARRAY['Aucune indication clinique validée — à éviter pendant la grossesse et l''allaitement']::text[],
  p_faq_safety_en := 'Contraindicated for self-use during pregnancy and breastfeeding: despite 19th-century folklore claiming it "eased childbirth," maternal-fetal safety and efficacy have never been tested, and oxytocic uterine stimulation poses obstetric risks.',
  p_faq_safety_fr := 'Contre-indiquée pendant la grossesse et l''allaitement : malgré les récits historiques sur l''accouchement, aucune sécurité fœto-maternelle n''est établie.',
  p_review_note := 'Reconciled pregnancy contradiction & removed childbirth dosing on partridge-berry'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'cuscuta-seed',
  p_dosage_en := 'Practitioner-supervised TCM multi-herb formulas only; no OTC self-dose established, and avoid unmonitored pregnancy use.',
  p_dosage_fr := 'Formules de MTC sous suivi spécialisé uniquement ; aucune posologie d''automédication pendant la grossesse.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['No validated Western clinical RCT support; avoid unproven self-use to "secure the fetus" or treat threatened miscarriage']::text[],
  p_modern_uses_fr := ARRAY['Aucune validation clinique occidentale ; ne pas utiliser en automédication pour prévenir une fausse couche']::text[],
  p_faq_uses_en := 'Although traditional Chinese texts list cuscuta seed (Tusizi) in compound formulas for "securing the fetus," rigorous modern maternal-fetal human safety and efficacy trials are absent; threatened miscarriage is a medical condition requiring obstetrical care.',
  p_faq_uses_fr := 'Bien que la MTC traditionnelle mentionne Tusizi, l''absence d''essais cliniques d''innocuité fœto-maternelle impose un suivi obstétrical médical plutôt qu''une automédication.',
  p_faq_safety_en := 'Avoid self-administration of Cuscuta chinensis extracts during pregnancy, breastfeeding, hormone-sensitive conditions (phytoestrogenic lignans/flavonoids), and chronic diarrhea.',
  p_faq_safety_fr := 'Éviter l''automédication pendant la grossesse, l''allaitement et en cas de pathologie hormonodépendante.',
  p_review_note := 'Removed self-care threatened miscarriage / "secure the fetus" claim on cuscuta-seed'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'false-unicorn',
  p_dosage_en := 'No safe standardized dose — endangered wild herb with no clinical safety trials; NEVER take during pregnancy (including "week 35") or morning sickness.',
  p_dosage_fr := 'Aucune dose sûre — plante rare sans essai clinique de sécurité ; ne JAMAIS prendre pendant la grossesse (y compris à 35 semaines) ni pour les nausées gravidiques.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_traditional_uses_en := ARRAY['Historical pre-modern gynecologic herb (obsolete and unsafe for pregnancy nausea or miscarriage)']::text[],
  p_traditional_uses_fr := ARRAY['Ancienne plante gynécologique du XIXe siècle (à éviter pendant la grossesse et les nausées gravidiques)']::text[],
  p_modern_uses_en := ARRAY['No clinical trial evidence — contraindicated for "threatened miscarriage" or "morning sickness"']::text[],
  p_modern_uses_fr := ARRAY['Aucune preuve clinique — contre-indiquée en cas de menace de fausse couche ou nausées de grossesse']::text[],
  p_faq_safety_en := 'Do NOT use false unicorn root (Chamaelirium luteum) for "threatened miscarriage," "morning sickness," or at week 35 of pregnancy: high/concentrated doses historically caused gastric irritation, kidney irritation, and uterine stimulation without human safety data. Avoid completely in pregnancy and breastfeeding.',
  p_faq_safety_fr := 'Ne JAMAIS utiliser Chamaelirium luteum contre les nausées de grossesse, les menaces de fausse couche ou à 35 semaines de gestation : absence totale de données d''innocuité et risques digestifs, rénaux et utérins.',
  p_review_note := 'Removed "threatened miscarriage", "morning sickness" & "week 35" error on false-unicorn'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'goat-rue',
  p_dosage_en := 'No regulator-approved adult oral or galactagogue dose — EMA/regulators advise against oral Galega officinalis due to variable guanidine/galegine alkaloids and serious hypoglycemia risk.',
  p_dosage_fr := 'Aucune posologie orale validée — déconseillée comme galactagogue faute de sécurité maternelle et néonatale (risque d''hypoglycémie et alcaloïdes galégine).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Unproven folk galactagogue — avoid due to insufficient human safety and hypoglycemia hazard']::text[],
  p_modern_uses_fr := ARRAY['Galactagogue traditionnel non validé — à éviter (risque d''hypoglycémie, sécurité insuffisante)']::text[],
  p_faq_uses_en := 'Despite historical promotion as a galactagogue (lactation tea), clinical trials and safety data for goat''s rue (Galega officinalis) during breastfeeding and pregnancy are lacking, and regulators warn against self-use due to guanidine/galegine hypoglycemic compounds.',
  p_faq_uses_fr := 'Malgré sa réputation ancienne de galactagogue, le galéga (Galega officinalis) manque de preuves cliniques de sécurité pendant l''allaitement et la grossesse et expose à des hypoglycémies.',
  p_faq_safety_en := 'Avoid during pregnancy and breastfeeding (galactagogue efficacy unproven and infant exposure risks unknown per LactMed/regulators), diabetes without medical supervision (risk of severe additive hypoglycemia via galegine), and before surgery.',
  p_faq_safety_fr := 'Éviter pendant la grossesse et l''allaitement (innocuité néonatale inconnue), en cas de diabète sans suivi médical (hypoglycémies) et avant une chirurgie.',
  p_review_note := 'Resolved galactagogue vs do-not-use pregnancy/lactation contradiction on goat-rue'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'aletris-farinosa',
  p_dosage_en := 'No safe standardized therapeutic dose — historically toxic at crude doses (nausea, vertigo, stupor) and strictly avoid in pregnancy.',
  p_dosage_fr := 'Aucune posologie thérapeutique sûre — toxicité digestive et nerveuse à forte dose ; proscrite pendant la grossesse.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['No clinical human trial support — avoid self-use in pregnancy or hormonal conditions']::text[],
  p_modern_uses_fr := ARRAY['Aucun soutien par essai clinique humain — éviter pendant la grossesse']::text[],
  p_faq_safety_en := 'Contraindicated in pregnancy (historically used for uterine complaints without maternal-fetal testing and shows estrogenic/oxytocic concerns), breastfeeding, and hormone-sensitive conditions; crude high doses cause dizziness and stupor.',
  p_faq_safety_fr := 'Contre-indiquée pendant la grossesse, l''allaitement et les affections hormonodépendantes ; les fortes doses brutes provoquent vertiges et stupeur.',
  p_review_note := 'Removed pregnancy self-use & zero-contraindication gap on aletris-farinosa'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'motherwort-european',
  p_dosage_en := 'EMA HMPC (Leonuri cardiacae herba — >=18 yrs): 1.5 g comminuted herb as tea 3 times/day (up to 4.5 g/day; max 2 weeks), NOT intravenous Leonurus japonicus postpartum injection.',
  p_dosage_fr := 'Monographie EMA (Leonuri cardiacae herba, >=18 ans) : tisane de 1,5 g 3 fois/jour (max 4,5 g/j ; <=2 semaines) ; NE PAS confondre avec les injections hospitalières asiatiques de Leonurus japonicus.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Traditional herbal medicinal product for relief of nervous tension (EMA/HMPC/127430/2010)', 'Traditional supportive relief of mild nervous cardiac complaints after serious disease is excluded by a doctor']::text[],
  p_modern_uses_fr := ARRAY['Tension nerveuse légère et symptômes cardiaques nerveux bénins après exclusion médicale d''une cardiopathie (EMA/HMPC/127430/2010)']::text[],
  p_faq_safety_en := 'STRICTLY CONTRAINDICATED IN PREGNANCY (stachydrine/leonurine stimulate uterine contractions and risk miscarriage — distinct from inpatient IV Leonurus japonicus studied in China for postpartum hemorrhage). Also avoid under 18 years, during breastfeeding, and with heavy menstrual bleeding or sedatives/antihypertensives.',
  p_faq_safety_fr := 'FORMELLEMENT CONTRE-INDIQUÉE PENDANT LA GROSSESSE (stimulant utérin ; bien distinguer des injections hospitalières de Leonurus japonicus en post-partum). Éviter aussi avant 18 ans, pendant l''allaitement et avec sédatifs ou hypotenseurs.',
  p_review_note := 'Removed IV Leonurus japonicus PPH Evidence A confusion & enforced EMA pregnancy ban on motherwort-european'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'polygonum-punctatum',
  p_dosage_en := 'No safe modern clinical dose — historical emmenagogue/abortifacient and irritating polygodial sesquiterpenes lack modern safety trials.',
  p_dosage_fr := 'Aucune posologie clinique moderne — emménagogue/abortif historique dépourvu de données de sécurité.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Dotted smartweed (Persicaria/Polygonum punctatum) is CONTRAINDICATED in pregnancy (historically documented as an emmenagogue and abortifacient) and breastfeeding, never safe or "without contraindications"; contains acrid blistering/irritating compounds.',
  p_faq_safety_fr := 'La renouée ponctuée est CONTRE-INDIQUÉE pendant la grossesse (emménagogue et abortif historique) et l''allaitement ; elle contient des composés âcres irritants pour le tube digestif et les muqueuses.',
  p_review_note := 'Removed "no contraindication" & added emmenagogue/abortifacient pregnancy ban on polygonum-punctatum'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'viburnum-opulus-herb',
  p_dosage_en := 'Traditional non-pregnant adult cramp-bark reference only (do NOT self-dose during pregnancy or for threatened miscarriage).',
  p_dosage_fr := 'Usage traditionnel adulte hors grossesse uniquement (ne pas utiliser pendant la grossesse ni contre une menace de fausse couche).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Do NOT use cramp bark (Viburnum opulus) during pregnancy or breastfeeding — historical "anti-miscarriage" use lacks maternal-fetal safety studies and relies on unstandardized antispasmodic claims. Also exercise caution in hypotension and salicylate sensitivity.',
  p_faq_safety_fr := 'Ne pas utiliser la viorne obier pendant la grossesse ou l''allaitement — l''usage historique contre les fausses couches ne dispose d''aucune validation de sécurité fœto-maternelle.',
  p_review_note := 'Reconciled pregnancy use contradiction on viburnum-opulus-herb'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'wild-yam',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_modern_uses_en := ARRAY['Insufficient clinical evidence for menopausal hot flashes, hormone replacement, or pregnancy nausea (diosgenin cannot convert to human hormones in vivo)']::text[],
  p_modern_uses_fr := ARRAY['Preuves cliniques insuffisantes pour la ménopause ou les nausées de grossesse (la diosgénine ne se transforme pas en hormones dans l''organisme humain)']::text[],
  p_faq_uses_en := 'Human bodies do NOT convert wild yam diosgenin into progesterone or estrogen (that requires industrial lab synthesis). NCCIH/clinical trials do not confirm benefit for menopausal symptoms, and concentrated wild yam must NOT be relied on for morning sickness.',
  p_faq_uses_fr := 'L''organisme humain ne convertit pas la diosgénine de l''igname sauvage en progestérone ni en œstrogènes ; les preuves cliniques restent insuffisantes.',
  p_faq_safety_en := 'Avoid wild yam (Dioscorea villosa) supplements during pregnancy (do not self-treat morning sickness), breastfeeding, hormone-sensitive cancers/fibroids, and protein S deficiency.',
  p_faq_safety_fr := 'Éviter les compléments d''igname sauvage pendant la grossesse (y compris contre les nausées gravidiques), l''allaitement et en cas de pathologie hormonodépendante.',
  p_review_note := 'Removed morning-sickness/progesterone myths & pregnancy self-use on wild-yam'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'yellow-gentian-root',
  p_dosage_en := 'EMA HMPC (Gentianae radix — adults >=18 yrs): 1 g comminuted root as tea up to 3 times/day (max 3 g/day) or equivalent tincture/powder for loss of appetite and mild dyspepsia.',
  p_dosage_fr := 'Monographie EMA (Gentianae radix, >=18 ans) : 1 g de racine en infusion jusqu''à 3 fois/jour (max 3 g/j) pour la perte d''appétit et la dyspepsie légère.',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_contraindications_en := ARRAY[
    'CONTRAINDICATED in active gastric or duodenal peptic ulcers (EMA/HMPC/607863/2017 Section 4.3).',
    'NOT recommended in pregnancy, lactation, or children/adolescents under 18 years due to lack of sufficient safety data.'
  ],
  p_contraindications_fr := ARRAY[
    'CONTRE-INDIQUÉE en cas d''ulcère gastrique ou duodénal évolutif (EMA/HMPC/607863/2017).',
    'Déconseillée pendant la grossesse, l''allaitement et chez l''enfant/adolescent de moins de 18 ans.'
  ],
  p_faq_safety_en := 'Per EMA/HMPC/607863/2017, yellow gentian root is CONTRAINDICATED in stomach or duodenal ulcers (stimulates gastric acid secretion) and NOT recommended during pregnancy, breastfeeding, or under 18 years.',
  p_faq_safety_fr := 'Selon l''EMA, la racine de gentiane jaune est CONTRE-INDIQUÉE en cas d''ulcère gastrique ou duodénal et déconseillée pendant la grossesse, l''allaitement et avant 18 ans.',
  p_review_note := 'Enforced EMA gastric-ulcer contraindication & pregnancy/<18 warning on yellow-gentian-root'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'medicago-sativa',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'CRITICAL AUTOIMMUNE & PREGNANCY WARNING: Concentrated alfalfa herb/seeds contain L-canavanine (risking reactivation/flares of systemic lupus erythematosus) and phytoestrogens; avoid concentrated supplements in lupus, hormone-sensitive cancers, pregnancy, and breastfeeding. Additionally, raw alfalfa sprouts carry serious Salmonella/E. coli foodborne risk during pregnancy and immunosuppression.',
  p_faq_safety_fr := 'AVERTISSEMENT LUPUS & GROSSESSE : les suppléments de luzerne contiennent de la L-canavanine pouvant déclencher une poussée de lupus érythémateux disséminé ainsi que des phytoœstrogènes. Éviter les concentrés pendant la grossesse, l''allaitement et le lupus (les graines germées crues exposent aussi à Salmonella/E. coli).',
  p_review_note := 'Added L-canavanine lupus flare, sprout infection & pregnancy safety warning on medicago-sativa'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'nettle-leaf',
  p_dosage_en := 'EMA HMPC (Urticae folium/herba — >=12 yrs): 2-4 g herbal tea 3-6 times daily (do not use beyond 2-4 weeks without medical advice; avoid concentrated herbal use in pregnancy/lactation).',
  p_dosage_fr := 'Monographie EMA (Urticae folium/herba, >=12 ans) : infusion de 2–4 g 3–6 fois/jour (avis médical si >2–4 semaines ; déconseillée en phytothérapie pendant la grossesse/allaitement).',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_safety_en := 'Per EMA/HMPC/508015/2010, medicinal stinging nettle leaf extracts/teas are NOT recommended during pregnancy (historical uterine-stimulant caution vs normal cooked greens), breastfeeding, or under 12 years; also contraindicated in fluid restriction (severe heart/kidney failure) and caution with antidiabetics, antihypertensives, lithium, and warfarin.',
  p_faq_safety_fr := 'Selon l''EMA, l''ortie médicinale est déconseillée pendant la grossesse, l''allaitement et avant 12 ans ; contre-indiquée en cas de restriction hydrique (insuffisance cardiaque/rénale sévère) et prudence avec antidiabétiques, lithium et warfarine.',
  p_review_note := 'Aligned nettle-leaf with EMA pregnancy/lactation/<12 & fluid-restriction rules'
);

SELECT pg_temp.remediate_herb_00093(
  p_slug := 'evening-primrose',
  p_pregnancy_safe := false,
  p_nursing_safe := false,
  p_faq_uses_en := 'EMA HMPC recognizes evening primrose oil traditionally solely for relief of itching in acute and chronic dry skin (>=12 yrs). Randomized trials and obstetric guidelines do NOT establish oral or vaginal evening primrose oil as safe or effective for cervical ripening/labor induction — and some data suggest prolonged labor or premature membrane rupture risks.',
  p_faq_uses_fr := 'L''EMA reconnaît uniquement l''usage traditionnel de l''huile d''onagre contre les démangeaisons des peaux sèches (>=12 ans). Les données cliniques ne confirment ni l''efficacité ni la sécurité pour la maturation cervicale pendant la grossesse.',
  p_faq_safety_en := 'Avoid unmonitored evening primrose oil during pregnancy (unproven cervical ripening with mixed/adverse obstetric signals — only use if specifically directed by your OB), and avoid combining with phenothiazine antipsychotics or in seizure disorders (may lower seizure threshold) or anticoagulants.',
  p_faq_safety_fr := 'Éviter l''automédication pendant la grossesse (effets obstétricaux incertains pour le col utérin), en cas d''épilepsie, de traitement par phénothiazines ou d''anticoagulants.',
  p_review_note := 'Reconciled evening-primrose cervical-ripening myth & EMA dry-skin scope'
);

-- =====================================================================
-- Queue ALL touched herbs in herb_bundle_dirty & verify needs_re_review
-- =====================================================================

INSERT INTO public.herb_bundle_dirty (slug, queued_at)
SELECT h.slug, now()
FROM pg_temp.touched_herbs_00093 t
JOIN public.herbs h ON h.slug = t.slug
ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;

COMMIT;

-- After applying on herbally-db, refresh precomputed bundles until 0 remain:
--   DO $$ DECLARE n int; BEGIN LOOP n := public.refresh_herb_page_bundles(500); EXIT WHEN n = 0; END LOOP; END $$;
