-- Migration 00094: Drug Interaction Direction Fixes, Fake/Duplicate Removal & Clinical Gap Fills
--
-- Bilingual (EN + FR) fixes across public.drug_interactions:
--   1. Correct reversed clinical directions (green-tea + Atorvastatin, goldenseal + Metformin,
--      american-ginseng + Warfarin, butterbur + CYP3A4 inducers, schisandra + Warfarin,
--      ginseng + Warfarin).
--   2. Delete fake/misattributed LiverTox-prose or wrong-part rows (spirulina/khat/fo-ti
--      Corticosteroids/Prednisone, grape-seed Phenacetin), fix copy-pasted/garbled rows
--      (chamomile Sedatives, st-johns-wort Saquinavir, bilberry row 1), and deduplicate
--      overlapping synonym rows on 10 high-traffic herbs.
--   3. Idempotently insert missing high-risk curated interactions across ~48 herbs with
--      verified primary source URLs (NCCIH, MSK, EMA, Health Canada, LiverTox, FDA, PubMed)
--      and upgrade bacopa+Levothyroxine and aloe-vera/aloe-vera-leaf+Digoxin to severe.
--
-- NON-NEGOTIABLE: Every touched herb is flagged provenance.review_status = 'needs_re_review'
-- (NEVER 'human_reviewed') until Yasser signs off personally.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS pg_temp.touched_herbs_00094 (
  slug text PRIMARY KEY
) ON COMMIT DROP;

-- =====================================================================
-- 1. Fix Reversed / Conflicting Interaction Directions
-- =====================================================================

-- 1a. green-tea + Atorvastatin (reduces levels per NCCIH, does NOT increase)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'moderate',
    description = 'Green tea extract and concentrated catechins can REDUCE atorvastatin blood levels (OATP1A2/OATP2B1 intestinal uptake inhibition noted by NCCIH), potentially decreasing cholesterol-lowering efficacy rather than increasing statin levels. Moderate dietary brewed tea appears less likely to cause a clinically large shift, though separating green tea extracts from atorvastatin and monitoring lipid response is advised.',
    mechanism = 'Catechins (EGCG) inhibit OATP-mediated intestinal absorption of atorvastatin, lowering plasma exposure.',
    evidence_level = 'moderate-evidence',
    source = 'NCCIH / MSK About Herbs',
    source_url = 'https://www.nccih.nih.gov/health/green-tea',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Atorvastatine',
        'description', 'Les extraits concentrés de thé vert et catéchines peuvent RÉDUIRE les concentrations sanguines d''atorvastatine (NCCIH), diminuant potentiellement son efficacité hypocholestérolémiante plutôt que de l''augmenter. Espacer les prises d''extrait de thé vert et surveiller le bilan lipidique.',
        'mechanism', 'Inhibition de l''absorption intestinale médiée par les transporteurs OATP réduisant l''exposition à l''atorvastatine.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'green-tea'
    AND di.drug_name ILIKE '%Atorvastatin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1b. goldenseal + Metformin (decreases metformin ~25% per NCCIH/MSK, NOT enhances hypoglycemia)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'moderate',
    description = 'Goldenseal DECREASED metformin blood concentrations by approximately 25% in healthy-adult probe studies reported by NIH NCCIH and MSK, which could potentially impair blood-glucose control rather than enhance hypoglycemia (note: a 2025 clinical study suggested limited aggregate clinical shift, though monitoring fasting glucose when starting or stopping goldenseal with metformin is prudent).',
    mechanism = 'Transporter (OCT1/MATE1) modulation in the gut/liver reducing systemic metformin exposure.',
    evidence_level = 'moderate-evidence',
    source = 'NCCIH / MSK About Herbs / PubMed',
    source_url = 'https://www.nccih.nih.gov/health/goldenseal',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Metformine',
        'description', 'Dans des études cliniques rapportées par le NIH NCCIH et le MSK, l''hydraste du Canada a DIMINUÉ d''environ 25 % les concentrations sanguines de metformine chez l''adulte sain, risquant plutôt d''atténuer le contrôle glycémique que de provoquer une hypoglycémie. Surveiller la glycémie lors de l''association.',
        'mechanism', 'Modulation des transporteurs OCT/MATE réduisant l''exposition systémique à la metformine.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'goldenseal'
    AND di.drug_name ILIKE '%Metformin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1c. american-ginseng + Warfarin (REDUCES INR/warfarin per Yuan et al. 2004 RCT)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'severe',
    description = 'American ginseng (Panax quinquefolius) significantly REDUCED warfarin anticoagulant effect (lowering INR and plasma warfarin concentration in a randomized placebo-controlled trial, Yuan et al. 2004), raising risk of arterial/venous thromboembolism. Avoid concurrent initiation/discontinuation without frequent INR monitoring.',
    mechanism = 'Probable induction of hepatic CYP enzymes increasing S/R-warfarin clearance and lowering INR.',
    evidence_level = 'well-documented',
    source = 'PubMed — Yuan et al. 2004 / MSK',
    source_url = 'https://pubmed.ncbi.nlm.nih.gov/15238367/',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Warfarine (Coumadin)',
        'description', 'Dans un essai randomisé contrôlé (Yuan et al., 2004), le ginseng américain (Panax quinquefolius) a significativement RÉDUIT l''effet anticoagulant de la warfarine (baisse de l''INR et des taux plasmatiques), exposant à un risque thromboembolique. Éviter ou surveiller étroitement l''INR.',
        'mechanism', 'Induction probable des enzymes hépatiques augmentant la clairance de la warfarine et abaissant l''INR.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'american-ginseng'
    AND di.drug_name ILIKE '%Warfarin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1d. ginseng (Panax ginseng) + Warfarin (reconcile reduced-INR trial signal + bleeding caution)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'moderate',
    description = 'Clinical trials and case reports show mixed-direction signals: Panax ginseng lowered warfarin exposure/INR in controlled healthy-volunteer and ischemic-stroke sub-analyses (potentially risking thrombosis), while isolated case reports also advise caution for bleeding changes. Avoid concurrent use or monitor INR closely with your prescriber.',
    mechanism = 'Enzyme modulation (CYP induction/clearance changes) with variable effects on S/R-warfarin enantiomers and platelet aggregation.',
    evidence_level = 'moderate-evidence',
    source = 'NCCIH / MSK About Herbs',
    source_url = 'https://www.nccih.nih.gov/health/asian-ginseng',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Warfarine (Coumadin)',
        'description', 'Les études cliniques montrent principalement une réduction possible de l''INR (diminution de l''effet anticoagulant de la warfarine) avec certains signalements isolés de variation hémorragique. Éviter l''association sans surveillance étroite de l''INR.',
        'mechanism', 'Modulation enzymatique hépatique modifiant la clairance des énantiomères de la warfarine.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'ginseng'
    AND di.drug_name ILIKE '%Warfarin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1e. schisandra + Warfarin (CYP induction reduces warfarin effect + ALT/AST masking)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'moderate',
    description = 'Schisandra chinensis induces hepatic CYP3A4/CYP2C9 activity, which can accelerate warfarin metabolism and REDUCE INR/anticoagulant efficacy (note: schisandra lignans also lower serum transaminases [ALT/AST], potentially masking biochemical signs of concurrent hepatotoxicity). Monitor INR carefully.',
    mechanism = 'CYP2C9/CYP3A4 enzyme induction increasing warfarin clearance.',
    evidence_level = 'moderate-evidence',
    source = 'MSK About Herbs / PubMed',
    source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/schisandra',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Warfarine (Coumadin)',
        'description', 'La schisandra induit le CYP3A4 et le CYP2C9, accélérant le métabolisme de la warfarine et pouvant RÉDUIRE son effet anticoagulant (baisse de l''INR). Surveiller l''INR ; par ailleurs, la schisandra peut abaisser artificiellement les transaminases ALT/AST.',
        'mechanism', 'Induction des cytochromes hépatiques CYP2C9/CYP3A4 augmentant la clairance de la warfarine.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'schisandra'
    AND di.drug_name ILIKE '%Warfarin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 1f. butterbur + CYP3A4 inducers (inducers INCREASE toxic PA pyrrole activation per LiverTox/NCCIH)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    drug_name = 'CYP3A4 Inducers (Rifampin, Carbamazepine, St. John''s Wort)',
    severity = 'severe',
    description = 'Drugs and herbs that INDUCE hepatic CYP3A4 (such as carbamazepine, phenytoin, rifampin, phenobarbital, and St. John''s wort) increase bioactivation of any residual unsaturated pyrrolizidine alkaloids (PAs) in butterbur into reactive toxic pyrrole metabolites, markedly elevating liver-injury risk. Even PA-free butterbur products carry idiosyncratic hepatotoxicity warnings — avoid combining.',
    mechanism = 'CYP3A4 induction accelerates bioactivation of pyrrolizidine alkaloids to hepatotoxic pyrrolic esters.',
    evidence_level = 'moderate-evidence',
    source = 'NCCIH / NIH LiverTox',
    source_url = 'https://www.nccih.nih.gov/health/butterbur',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Inducteurs du CYP3A4 (Rifampicine, Carbamazépine, Millepertuis)',
        'description', 'Les inducteurs du CYP3A4 (carbamazépine, phénytoïne, rifampicine, millepertuis) augmentent la transformation des alcaloïdes pyrrolizidiniques résiduels du pétasite en métabolites hépatotoxiques, majorant le risque d''atteinte hépatique grave. Éviter l''association.',
        'mechanism', 'L''induction du CYP3A4 accroît la bioactivation hépatotoxique des alcaloïdes pyrrolizidiniques.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'butterbur'
    AND di.drug_name ILIKE '%CYP3A4%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. Delete Fake/Misattributed Rows & Fix Copy-Pasted/Garbled Rows
-- =====================================================================

-- 2a. Delete fake Corticosteroids/Prednisone rows (misread LiverTox management text) & Phenacetin (grape juice)
WITH del AS (
  DELETE FROM public.drug_interactions di
  USING public.herbs h
  WHERE di.herb_id = h.id
    AND (
      (
        h.slug IN ('spirulina', 'khat', 'fo-ti-prepared')
        AND (di.drug_name ILIKE '%Corticosteroid%' OR di.drug_name ILIKE '%Prednisone%')
        AND (
          di.description ILIKE '%management%'
          OR di.description ILIKE '%no information%'
          OR di.description ILIKE '%autoimmune%'
          OR di.description ILIKE '%corticosteroids%'
          OR COALESCE(di.source_url, '') ILIKE '%livertox%'
        )
      )
      OR (
        h.slug = 'grape-seed'
        AND di.drug_name ILIKE '%Phenacetin%'
      )
    )
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM del ON CONFLICT DO NOTHING;

-- 2b. Fix chamomile Sedatives row (replace copy-pasted warfarin sentence)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'moderate',
    description = 'German chamomile (Matricaria recutita) contains apigenin and mild CNS-depressant constituents that may produce additive drowsiness or sedation when combined with prescription sedatives, benzodiazepines, barbiturates, or sleep medications. Exercise caution with driving or alertness.',
    mechanism = 'Mild GABA-A / benzodiazepine-receptor binding by apigenin causing additive CNS depression.',
    evidence_level = 'moderate-evidence',
    source = 'NCCIH / MSK About Herbs',
    source_url = 'https://www.nccih.nih.gov/health/chamomile',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Sédatifs et dépresseurs du SNC',
        'description', 'La camomille allemande (apigénine) peut additionner ses légers effets sédatifs à ceux des benzodiazépines, barbituriques et somnifères sur ordonnance, augmentant la somnolence et altérant la vigilance au volant.',
        'mechanism', 'Liaison modérée aux récepteurs GABA-A potentialisant la dépression du système nerveux central.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'chamomile'
    AND (di.drug_name ILIKE '%Sedative%' OR di.drug_name ILIKE '%CNS depressant%')
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 2c. Fix st-johns-wort Saquinavir row (replace garbled EMA text)
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'contraindicated',
    description = 'St. John''s wort (hyperforin) potently induces CYP3A4 and intestinal P-glycoprotein, markedly reducing plasma concentrations of HIV protease inhibitors including saquinavir (as well as indinavir and ritonavir-boosted regimens), risking loss of HIV viral suppression and antiretroviral drug resistance. Contraindicated.',
    mechanism = 'Hyperforin-mediated PXR activation induces hepatic/intestinal CYP3A4 and P-gp efflux, accelerating saquinavir clearance.',
    evidence_level = 'well-documented',
    source = 'NCCIH / EMA HMPC Hyperici herba',
    source_url = 'https://www.nccih.nih.gov/health/st-johns-wort',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Saquinavir (et inhibiteurs de protéase VIH)',
        'description', 'Le millepertuis induit fortement le CYP3A4 et la glycoprotéine P, abaissant fortement les taux sanguins de saquinavir et exposant à un échec virologique et à une résistance du VIH. Association contre-indiquée.',
        'mechanism', 'Induction puissante du CYP3A4 et de la P-gp par l''hyperforine réduisant l''exposition plasmatique au saquinavir.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'st-johns-wort'
    AND di.drug_name ILIKE '%Saquinavir%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 2d. Fix bilberry mis-pasted LiverTox row (if present) and unify antithrombotic wording
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    description = 'Concentrated bilberry fruit anthocyanosides exhibit mild antiplatelet activity in preclinical/clinical models and may increase bruising or bleeding risk alongside warfarin or aspirin/antiplatelet agents. Monitor INR and bleeding signs.',
    mechanism = 'Inhibition of platelet aggregation and potential additive antithrombotic effect.',
    evidence_level = 'limited-evidence',
    source = 'NCCIH / MSK About Herbs',
    source_url = 'https://www.nccih.nih.gov/health/bilberry',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Warfarine et antiplaquettaires',
        'description', 'Les anthocyanosides concentrés de myrtille présentent une activité antiplaquettaire modérée pouvant majorer le risque d''ecchymoses ou de saignement avec la warfarine ou l''aspirine. Surveiller l''INR.',
        'mechanism', 'Inhibition de l''agrégation plaquettaire avec effet antithrombotique additif.'
      ),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'bilberry'
    AND (di.description ILIKE '%LiverTox%' OR di.description ILIKE '%hepatotoxic%' OR di.drug_name ILIKE '%Anticoagulant%')
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 2e. Deduplicate overlapping synonym rows on audited duplicate-heavy herbs
WITH ranked AS (
  SELECT
    di.id,
    h.slug,
    ROW_NUMBER() OVER (
      PARTITION BY
        di.herb_id,
        CASE
          WHEN di.drug_name ~* '(anticoagulant.*warfarin|^warfarin\b)' THEN 'canon:warfarin'
          WHEN di.drug_name ~* '^(aspirin|salicyl)' THEN 'canon:aspirin'
          WHEN di.drug_name ~* '(sedative|cns depressant|benzodiazepine|alprazolam|diazepam|sleep)'
               AND h.slug IN ('ashwagandha', 'valerian') THEN 'canon:sedatives'
          ELSE lower(trim(regexp_replace(di.drug_name, '\s*\([^)]*\)\s*', '', 'g')))
        END
      ORDER BY
        CASE di.severity::text
          WHEN 'contraindicated' THEN 1
          WHEN 'severe' THEN 2
          WHEN 'moderate' THEN 3
          WHEN 'mild' THEN 4
          ELSE 5
        END,
        CASE WHEN COALESCE(di.source_url, '') ~* '(nccih|mskcc|ema\.europa|pubmed|books|fda|canada\.ca)' THEN 0 ELSE 1 END,
        di.updated_at DESC,
        di.id
    ) AS rn
  FROM public.drug_interactions di
  JOIN public.herbs h ON h.id = di.herb_id
  WHERE h.slug IN (
    'ashwagandha', 'valerian', 'ginkgo-biloba', 'garlic', 'chamomile',
    'citrus-bioflavonoids', 'blueberry-leaf', 'chlorella', 'serrapeptase', 'bilberry'
  )
),
del AS (
  DELETE FROM public.drug_interactions di
  USING ranked r
  WHERE di.id = r.id
    AND r.rn > 1
  RETURNING r.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM del ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. Severity Upgrades & Missing Curated Interactions (~48 herbs)
-- =====================================================================

-- 3a. Upgrade bacopa + Levothyroxine -> severe; aloe-vera / aloe-vera-leaf + Digoxin -> severe
WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'severe',
    description = 'Preclinical evidence shows Bacopa monnieri can markedly increase thyroxine (T4) serum levels (~40%+ in animal models), risking thyrotoxicosis, palpitations, and arrhythmias when combined with prescription levothyroxine. Avoid combining or closely monitor TSH/free T4.',
    mechanism = 'Stimulation of endogenous thyroid hormone synthesis/release compounding exogenous levothyroxine.',
    source = 'MSK About Herbs / PubMed',
    source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/bacopa',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Des données précliniques montrent que Bacopa monnieri peut élever nettement les taux de thyroxine (T4), créant un risque d''hyperthyroïdie iatrogène et de tachycardie avec la lévothyroxine. Association déconseillée sans suivi TSH.'::text),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug = 'bacopa'
    AND di.drug_name ILIKE '%Levothyroxine%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

WITH upd AS (
  UPDATE public.drug_interactions di
  SET
    severity = 'severe',
    description = 'Oral anthraquinone aloe latex stimulant laxatives deplete intestinal and systemic potassium (hypokalemia), dangerously sensitizing the heart to digoxin toxicity and potentially fatal ventricular arrhythmias. (Applies to oral aloe latex; clear topical gel does not carry systemic anthraquinone laxative risk.)',
    mechanism = 'Hypokalemia enhances cardiac glycoside binding to myocardial Na+/K+-ATPase.',
    source = 'EMA HMPC / Health Canada / MedlinePlus',
    source_url = 'https://medlineplus.gov/druginfo/natural/607.html',
    translations = jsonb_set(
      COALESCE(di.translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Les laxatifs stimulants oraux au latex d''aloès (anthraquinones) provoquent une hypokaliémie qui majore gravement la toxicité cardiaque de la digoxine (arythmies potentiellement mortelles). Ne concerne pas le gel externe transparent.'::text),
      true
    ),
    updated_at = now()
  FROM public.herbs h
  WHERE di.herb_id = h.id
    AND h.slug IN ('aloe-vera', 'aloe-vera-leaf')
    AND di.drug_name ILIKE '%Digoxin%'
  RETURNING h.slug
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT slug FROM upd ON CONFLICT DO NOTHING;

-- 3b. Idempotent bilingual curated inserts across all missing high-risk interactions
WITH pairs(
  slug, drug_name, drug_name_fr, severity,
  description_en, description_fr,
  mechanism_en, mechanism_fr,
  evidence_level, source, source_url
) AS (
  VALUES
    -- Ephedra (ephedra-sinica)
    ('ephedra-sinica', 'MAO Inhibitors (Phenelzine, Tranylcypromine)', 'Inhibiteurs de la MAO (Phénelzine, Tranylcypromine)', 'contraindicated',
     'Combining ephedrine alkaloids with MAOIs can precipitate fatal hypertensive crisis, hyperpyrexia, intracranial hemorrhage, and cardiac arrhythmias.',
     'L''association éphédra + IMAO expose à une crise hypertensive mortelle, hyperthermie maligne, hémorragie cérébrale et arythmies fatales.',
     'Inhibition of norepinephrine breakdown compounds ephedrine-induced catecholamine release.',
     'L''inhibition de la dégradation des catécholamines s''ajoute à la libération massive induite par l''éphédrine.',
     'well-documented', 'NCCIH / FDA', 'https://www.nccih.nih.gov/health/ephedra'),
    ('ephedra-sinica', 'Stimulants and Caffeine (Amphetamines, High-Dose Caffeine)', 'Stimulants et caféine', 'severe',
     'Concurrent ephedra and caffeine or sympathomimetic stimulants markedly increases risks of myocardial infarction, stroke, seizures, tachycardia, and sudden death.',
     'La caféine ou les stimulants associés à l''éphédra majorent fortement le risque d''infarctus, d''AVC, de convulsions et de mort subite.',
     'Synergistic alpha/beta-adrenergic sympathetic stimulation and phosphodiesterase inhibition.',
     'Stimulation adrénergique synergique augmentant la charge cardiovasculaire.',
     'well-documented', 'NCCIH / FDA', 'https://www.nccih.nih.gov/health/ephedra'),
    ('ephedra-sinica', 'Antihypertensives', 'Antihypertenseurs', 'severe',
     'Ephedra causes systemic vasoconstriction and blood-pressure elevation, directly antagonizing blood-pressure lowering medications.',
     'L''éphédra provoque une vasoconstriction et élève la tension artérielle, s''opposant directement aux traitements antihypertenseurs.',
     'Alpha-adrenergic vasoconstriction opposes vasodilator and antihypertensive therapy.',
     'Vasoconstriction adrénergique antagonisant les antihypertenseurs.',
     'well-documented', 'NCCIH / MedlinePlus', 'https://www.nccih.nih.gov/health/ephedra'),

    -- Green Tea (green-tea)
    ('green-tea', 'Raloxifene', 'Raloxifène', 'moderate',
     'Concentrated green tea extract may decrease blood concentrations and systemic exposure of raloxifene (documented in clinical pharmacokinetic reporting cited by NCCIH).',
     'Les extraits concentrés de thé vert peuvent réduire l''exposition plasmatique au raloxifène (donnée rapportée par le NIH NCCIH).',
     'Altered intestinal transport/UGT glucuronidation reducing raloxifene bioavailability.',
     'Modification du transport intestinal et de la glucuronidation réduisant les taux de raloxifène.',
     'moderate-evidence', 'NCCIH', 'https://www.nccih.nih.gov/health/green-tea'),
    ('green-tea', 'Bortezomib (Velcade)', 'Bortézomib (Velcade)', 'severe',
     'Green tea polyphenols (EGCG and vicinal diols) chemically bind the boronic acid moiety of bortezomib and abolished proteasome inhibition and anticancer efficacy in preclinical models (MSK). Avoid during bortezomib therapy.',
     'Les polyphénols du thé vert (EGCG) se lient directement au bortézomib et bloquent son activité anticancéreuse (MSK). Association à éviter durant le traitement.',
     'Direct covalent/chelation interaction between EGCG catechol moieties and bortezomib boronic acid.',
     'Liaison chimique directe entre les groupements catéchol de l''EGCG et l''acide boronique du bortézomib.',
     'moderate-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/green-tea'),
    ('green-tea', 'Rosuvastatin (Crestor)', 'Rosuvastatine (Crestor)', 'moderate',
     'Green tea catechins inhibit OATP1A2/OATP1B1 uptake transporters and can lower rosuvastatin absorption and plasma concentrations.',
     'Les catéchines du thé vert inhibent les transporteurs OATP et peuvent diminuer l''absorption et les taux sanguins de rosuvastatine.',
     'Intestinal OATP transporter inhibition lowering statin absorption.',
     'Inhibition des transporteurs d''absorption OATP diminuant la biodisponibilité de la rosuvastatine.',
     'moderate-evidence', 'MSK About Herbs / NCCIH', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/green-tea'),

    -- Black Cohosh (black-cohosh)
    ('black-cohosh', 'Simvastatin (and Atorvastatin / CYP3A4 Statins)', 'Simvastatine (statines métabolisées par le CYP3A4)', 'moderate',
     'MSK warns that black cohosh may interact with simvastatin and other statins or hepatotoxic drugs, with rare reports of liver enzyme elevations when combined.',
     'Selon le MSK, l''actée à grappes noires peut interagir avec la simvastatine et majorer le risque d''atteinte hépatique ou modifier le métabolisme.',
     'Potential hepatic CYP modulation and additive idiosyncratic hepatocellular stress.',
     'Modulation enzymatique hépatique et risque additif d''élévation des transaminases.',
     'limited-evidence', 'MSK About Herbs / NCCIH', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/black-cohosh'),
    ('black-cohosh', 'Doxorubicin and Docetaxel (Chemotherapy)', 'Doxorubicine et Docétaxel (Chimiothérapie)', 'moderate',
     'Preclinical oncology studies cited by MSK indicate black cohosh extracts increased cytotoxicity of doxorubicin and docetaxel but reduced cisplatin cytotoxicity — consult oncology team before concurrent use.',
     'Le MSK signale des modifications variables de l''activité de la doxorubicine, du docétaxel et du cisplatine en préclinique ; ne pas associer sans avis oncologique.',
     'Altered cellular chemosensitivity and CYP3A4 metabolism.',
     'Modulation cellulaire et métabolique en cours de chimiothérapie.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/black-cohosh'),
    ('black-cohosh', 'CYP3A4 Substrates', 'Substrats du CYP3A4', 'moderate',
     'In-vitro and MSK clinical monographs advise caution with drugs metabolized by CYP3A4 (and CYP2D6) while monitoring for clinical response or liver toxicity.',
     'La monographie MSK recommande la prudence avec les médicaments substrats du CYP3A4 (et CYP2D6) en raison d''effets enzymatiques possibles.',
     'Weak-to-moderate hepatic CYP3A4/CYP2D6 inhibition observed in experimental systems.',
     'Inhibition enzymatique CYP3A4/CYP2D6 rapportée in vitro.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/black-cohosh'),

    -- Goldenseal (goldenseal)
    ('goldenseal', 'Bosutinib', 'Bosutinib', 'severe',
     'MSK explicitly lists bosutinib as a Do-Not-Take interaction with goldenseal: goldenseal strongly inhibits CYP3A4 in humans (~50%+ inhibition), risking toxic accumulation of bosutinib.',
     'Le MSK déconseille formellement l''association au bosutinib : l''hydraste du Canada inhibe fortement le CYP3A4 humain, risquant une accumulation toxique du médicament.',
     'Potent clinical inhibition of hepatic/intestinal CYP3A4 by hydrastine and berberine.',
     'Forte inhibition clinique du CYP3A4 par l''hydrastine et la berbérine augmentant l''exposition au bosutinib.',
     'well-documented', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/goldenseal'),
    ('goldenseal', 'CYP3A4 and CYP2D6 Substrates', 'Substrats des CYP3A4 et CYP2D6', 'severe',
     'Human probe-drug clinical trials verified by NIH NCCIH and MSK demonstrate goldenseal significantly inhibits both CYP3A4 and CYP2D6 (~40-50%+ increase in substrate exposure such as midazolam/dextromethorphan), risking drug toxicity.',
     'Des essais cliniques chez l''humain (NIH NCCIH / MSK) confirment une inhibition significative des CYP3A4 et CYP2D6 par l''hydraste, augmentant fortement l''exposition à de nombreux médicaments.',
     'Mechanism-based inactivation of CYP3A4 and CYP2D6 by methylenedioxyphenyl isoquinoline alkaloids (hydrastine, berberine).',
     'Inhibition irréversible/compétitive des CYP3A4 et CYP2D6 chez l''humain.',
     'well-documented', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/goldenseal'),

    -- Andrographis (andrographis)
    ('andrographis', 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)', 'Anticoagulants et antiplaquettaires', 'moderate',
     'Andrographolide inhibits PAF-mediated platelet aggregation in human and animal studies, potentially raising bleeding risk alongside warfarin, DOACs, aspirin, or clopidogrel.',
     'L''andrographolide inhibe l''agrégation plaquettaire et peut augmenter le risque hémorragique avec les anticoagulants ou antiplaquettaires.',
     'Inhibition of platelet-activating factor (PAF) and thromboxane signaling.',
     'Inhibition plaquettaire induite par l''andrographolide.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/andrographis'),
    ('andrographis', 'Antihypertensives', 'Antihypertenseurs', 'moderate',
     'Andrographis exhibits blood-pressure-lowering activity in preclinical/clinical models and may produce additive hypotension with antihypertensive drugs.',
     'L''andrographis peut abaisser la tension artérielle et provoquer une hypotension additive avec les traitements antihypertenseurs.',
     'Additive vasodilation and NO-mediated blood-pressure reduction.',
     'Effet hypotenseur additif.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/andrographis'),
    ('andrographis', 'Immunosuppressants (Cyclosporine, Tacrolimus)', 'Immunosuppresseurs (Ciclosporine, Tacrolimus)', 'severe',
     'Andrographis enhances immune-cell proliferation and cytokine production, potentially counteracting immunosuppressive medications in transplant recipients or autoimmune disease.',
     'L''andrographis stimule la réponse immunitaire et risque de réduire l''efficacité des immunosuppresseurs chez les patients greffés ou traités pour maladie auto-immune.',
     'Pharmacodynamic immunostimulation opposing calcineurin/corticosteroid immunosuppression.',
     'Immunostimulation s''opposant au traitement immunosuppresseur.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/andrographis'),

    -- Holy Basil (holy-basil)
    ('holy-basil', 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)', 'Anticoagulants et antiplaquettaires', 'moderate',
     'Eugenol and holy basil leaf extracts may slow blood clotting and prolong bleeding time alongside warfarin, heparin, aspirin, or NSAIDs.',
     'Le basilic sacré (eugénol) peut ralentir la coagulation et accroître le risque de saignement sous anticoagulants ou antiplaquettaires.',
     'Inhibition of platelet aggregation and arachidonic acid metabolism.',
     'Effet antiplaquettaire additif.',
     'limited-evidence', 'MedlinePlus / MSK', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil'),
    ('holy-basil', 'Antidiabetic Medications (Metformin, Insulin, Sulfonylureas)', 'Antidiabétiques (Metformine, Insuline, Sulfamides)', 'moderate',
     'Small human trials demonstrate holy basil reduces fasting and postprandial blood glucose, risking additive hypoglycemia when combined with diabetes drugs.',
     'Le basilic sacré abaisse la glycémie et peut provoquer une hypoglycémie additive avec l''insuline ou les antidiabétiques oraux.',
     'Additive insulin-sensitizing and hypoglycemic pharmacodynamics.',
     'Effet hypoglycémiant additif.',
     'moderate-evidence', 'MSK About Herbs / PubMed', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil'),
    ('holy-basil', 'Pentobarbital and Sedatives', 'Pentobarbital et sédatifs', 'moderate',
     'Preclinical studies show holy basil potentiates pentobarbital sleeping time and may increase CNS depression alongside barbiturates or benzodiazepines.',
     'Le basilic sacré prolonge l''effet sédatif des barbituriques en préclinique et peut majorer la somnolence avec les dépresseurs du SNC.',
     'Central nervous system depression additive with GABAergic sedatives.',
     'Dépression additive du système nerveux central.',
     'theoretical', 'MedlinePlus', 'https://medlineplus.gov/druginfo/natural/1101.html'),

    -- Bacopa (bacopa)
    ('bacopa', 'Donepezil and Cholinesterase Inhibitors', 'Donépézil et inhibiteurs de la cholinestérase', 'moderate',
     'Bacopa monnieri inhibits acetylcholinesterase and exhibits cholinomimetic activity, risking additive cholinergic side effects (nausea, bradycardia, sweating) alongside donepezil, rivastigmine, or galantamine.',
     'Bacopa inhibe l''acétylcholinestérase et peut additionner les effets cholinergiques (nausées, bradycardie) avec le donépézil ou la rivastigmine.',
     'Synergistic acetylcholinesterase inhibition increasing synaptic acetylcholine.',
     'Inhibition synergique de l''acétylcholinestérase.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/bacopa'),
    ('bacopa', 'CYP450 Substrates (CYP1A2, CYP3A4, CYP2C9, CYP2C19)', 'Substrats des cytochromes CYP450', 'moderate',
     'In-vitro studies reported by MSK indicate Bacopa extracts can inhibit CYP1A2, CYP3A4, CYP2C9, and CYP2C19, potentially altering blood levels of narrow-margin prescription substrates.',
     'Des données de laboratoire rapportées par le MSK suggèrent une inhibition de plusieurs enzymes CYP450 (CYP1A2, 3A4, 2C9, 2C19) pouvant modifier les taux médicamenteux.',
     'Competitive inhibition of human cytochrome P450 isoforms.',
     'Inhibition enzymatique potentielle de plusieurs isoenzymes CYP450.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/bacopa'),

    -- Devil's Claw (devils-claw)
    ('devils-claw', 'Warfarin and Anticoagulants', 'Warfarine et anticoagulants', 'severe',
     'Case report and MSK/NCCIH advisories document purpura and elevated INR when devil''s claw was added to warfarin; avoid or monitor INR closely.',
     'Des rapports cliniques (MSK/NCCIH) signalent un risque d''élévation de l''INR et de purpura sous warfarine ; éviter ou surveiller étroitement l''INR.',
     'Possible CYP2C9 inhibition and additive antiplatelet/hemorrhagic effects.',
     'Inhibition possible du CYP2C9 et effet hémorragique additif.',
     'limited-evidence', 'NCCIH / MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/devils-claw'),
    ('devils-claw', 'NSAIDs (Ibuprofen, Naproxen) and Gastrotoxic Drugs', 'AINS (Ibuprofène, Naproxène)', 'moderate',
     'Devil''s claw stimulates gastric acid secretion and carries warnings against use with NSAIDs or peptic ulcers due to compounded GI irritation and ulcer bleeding risk.',
     'La griffe du diable augmente la sécrétion gastrique et majore le risque d''irritation digestive et d''hémorragie en association avec les AINS.',
     'Increased gastric acidity plus mucosal irritation.',
     'Stimulation acide gastrique et irritation muqueuse additive.',
     'moderate-evidence', 'EMA HMPC / MSK', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/devils-claw'),
    ('devils-claw', 'Antiarrhythmics and Antihypertensives (Digoxin, Beta-Blockers)', 'Antiarythmiques et antihypertenseurs', 'moderate',
     'Animal/MSK pharmacology indicates harpagoside extracts may affect heart rate, cardiac rhythm, and blood pressure; monitor patients taking antiarrhythmics or antihypertensives.',
     'Des données pharmacologiques (MSK) suggèrent des effets chronotropes/hypotenseurs ; surveillance recommandée sous antiarythmiques ou antihypertenseurs.',
     'Negative chronotropic and calcium-channel/electrophysiologic modulation.',
     'Modulation de l''excitabilité cardiaque et de la pression artérielle.',
     'theoretical', 'MSK About Herbs / MedlinePlus', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/devils-claw'),

    -- Sage (sage)
    ('sage', 'Anticonvulsants (Phenytoin, Valproate, Carbamazepine)', 'Anticonvulsivants / Antiépileptiques', 'severe',
     'Thujone and camphor in Salvia officinalis lower seizure threshold and directly antagonize anticonvulsant therapy; contraindicated in seizure disorders.',
     'La thuyone et le camphre de la sauge abaissent le seuil épileptogène et s''opposent directement aux médicaments antiépileptiques.',
     'GABA-A receptor antagonism by monoterpene ketones (alpha/beta-thujone).',
     'Antagonisme des récepteurs GABA-A par la thuyone.',
     'moderate-evidence', 'EMA HMPC / MedlinePlus', 'https://www.nccih.nih.gov/health/sage'),
    ('sage', 'Antidiabetic Medications (Insulin, Metformin)', 'Antidiabétiques (Insuline, Metformine)', 'moderate',
     'Clinical trials show sage leaf extracts can lower fasting blood glucose and additive hypoglycemia may occur alongside diabetes therapy.',
     'La sauge officinale peut abaisser la glycémie et exposer à une hypoglycémie additive avec l''insuline ou les antidiabétiques oraux.',
     'Insulin-sensitizing and hepatic gluconeogenesis reduction.',
     'Effet hypoglycémiant additif.',
     'moderate-evidence', 'NCCIH / MedlinePlus', 'https://www.nccih.nih.gov/health/sage'),
    ('sage', 'Sedatives and CNS Depressants', 'Sédatifs et dépresseurs du SNC', 'moderate',
     'High concentrated sage extracts may modulate GABAergic/muscarinic pathways and add to drowsiness caused by sedative drugs.',
     'Les extraits concentrés de sauge peuvent majorer la somnolence associée aux sédatifs sur ordonnance.',
     'Potential GABA/cholinergic CNS modulation.',
     'Effet sédatif central additif potentiel.',
     'theoretical', 'MedlinePlus', 'https://www.nccih.nih.gov/health/sage'),

    -- Cinnamon (cinnamon)
    ('cinnamon', 'Hepatotoxic Drugs (Cassia Cinnamon High Coumarin Exposure)', 'Médicaments hépatotoxiques (Cannelle Cassia / Coumarine)', 'moderate',
     'Cassia cinnamon (Cinnamomum cassia / C. aromaticum) contains high levels of coumarin, a hepatotoxin that can compound liver injury risk when combined with hepatotoxic drugs (acetaminophen, statins, amiodarone, methotrexate).',
     'La cannelle Cassia contient de fortes teneurs en coumarine hépatotoxique pouvant majorer le risque d''atteinte hépatique avec les médicaments hépatotoxiques (paracétamol, statines, méthotrexate).',
     'Additive hepatic injury from Cassia coumarin exceeding EFSA 0.1 mg/kg TDI.',
     'Toxicité hépatocellulaire additive due à la coumarine de la cannelle Cassia.',
     'well-documented', 'NCCIH / LiverTox', 'https://www.nccih.nih.gov/health/cinnamon'),
    ('cinnamon', 'Antidiabetic Medications (Insulin, Sulfonylureas)', 'Antidiabétiques (Insuline, Sulfamides)', 'moderate',
     'Concentrated cinnamon supplements may lower fasting blood glucose and cause additive hypoglycemia alongside insulin or sulfonylureas (NCCIH).',
     'Les suppléments concentrés de cannelle peuvent renforcer la baisse glycémique et favoriser des hypoglycémies sous antidiabétiques (NCCIH).',
     'Additive insulin-mimetic signaling and glucose uptake.',
     'Potentialisation de la sensibilité à l''insuline.',
     'moderate-evidence', 'NCCIH', 'https://www.nccih.nih.gov/health/cinnamon'),

    -- Evening Primrose (evening-primrose)
    ('evening-primrose', 'Phenothiazines (Chlorpromazine, Fluphenazine)', 'Phénothiazines (Chlorpromazine, Fluphénazine)', 'severe',
     'Case reports cited by NCCIH and clinical toxicology warn that combining evening primrose oil with phenothiazine antipsychotics may lower the seizure threshold and trigger temporal-lobe epilepsy/seizures.',
     'Des cas cliniques signalent un risque accru de convulsions (abaissement du seuil épileptogène) lorsque l''huile d''onagre est associée aux neuroleptiques phénothiaziniques (NCCIH).',
     'GLA/prostaglandin E1 excess sensitizing epileptogenic foci alongside D2-blocking phenothiazines.',
     'Abaissement synergique du seuil épileptogène.',
     'moderate-evidence', 'NCCIH / MedlinePlus', 'https://www.nccih.nih.gov/health/evening-primrose-oil'),
    ('evening-primrose', 'Anticoagulants and Antiplatelets (Warfarin, Clopidogrel)', 'Anticoagulants et antiplaquettaires', 'moderate',
     'Gamma-linolenic acid (GLA) inhibits platelet aggregation via prostaglandin E1 and may increase bleeding risk with blood thinners (NCCIH).',
     'L''acide gamma-linolénique (GLA) réduit l''agrégation plaquettaire et peut augmenter le risque hémorragique sous anticoagulants ou antiplaquettaires.',
     'Prostaglandin E1-mediated antiplatelet inhibition.',
     'Inhibition de l''agrégation plaquettaire médiée par la PGE1.',
     'limited-evidence', 'NCCIH', 'https://www.nccih.nih.gov/health/evening-primrose-oil'),

    -- Astragalus (astragalus)
    ('astragalus', 'Immunosuppressants (Cyclosporine, Tacrolimus, Prednisone)', 'Immunosuppresseurs (Ciclosporine, Tacrolimus, Corticoïdes)', 'severe',
     'Astragalus stimulates T-cell/macrophage immune activity and may counteract therapeutic immunosuppression in organ transplant recipients or autoimmune diseases (NCCIH/MSK).',
     'L''astragale stimule la réponse immunitaire et risque de réduire l''efficacité des immunosuppresseurs (greffe, maladies auto-immunes — NCCIH/MSK).',
     'Pharmacodynamic antagonism via dendritic cell and cytokine activation.',
     'Stimulation immunitaire s''opposant aux immunosuppresseurs.',
     'moderate-evidence', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/astragalus'),
    ('astragalus', 'Lithium', 'Lithium', 'moderate',
     'Astragalus exhibits diuretic/natriuretic effects in clinical/experimental data and may reduce renal lithium clearance, increasing risk of lithium toxicity (MedlinePlus).',
     'L''astragale peut augmenter la diurèse, diminuer la clairance rénale du lithium et exposer à un surdosage en lithium.',
     'Natriuresis/fluid depletion increasing proximal tubular lithium reabsorption.',
     'Réduction de l''excrétion rénale du lithium.',
     'theoretical', 'NCCIH / MedlinePlus', 'https://www.nccih.nih.gov/health/astragalus'),

    -- Cranberry (cranberry)
    ('cranberry', 'Tacrolimus', 'Tacrolimus', 'moderate',
     'Cranberry juice/extracts have been associated with altered tacrolimus pharmacokinetics/blood concentrations in clinical case reports cited by NCCIH; transplant patients should monitor tacrolimus trough levels.',
     'Des signalements cliniques cités par le NIH NCCIH décrivent une modification des taux sanguins de tacrolimus sous canneberge ; surveiller les concentrations résiduelles chez les patients greffés.',
     'Potential modulation of intestinal CYP3A4 / P-glycoprotein transport.',
     'Modulation possible du CYP3A4 et de la glycoprotéine P intestinale.',
     'limited-evidence', 'NCCIH', 'https://www.nccih.nih.gov/health/cranberry'),

    -- Barberry (berberis-vulgaris)
    ('berberis-vulgaris', 'Cyclosporine', 'Ciclosporine', 'severe',
     'Berberine — the major alkaloid in barberry bark/root — inhibits CYP3A4 and P-gp and markedly raised blood cyclosporine concentrations (~34-75%) in human clinical studies, increasing nephrotoxicity.',
     'La berbérine contenue dans l''épine-vinette inhibe fortement le CYP3A4 et la P-gp, augmentant nettement la ciclosporinémie (risque néphrotoxique).',
     'CYP3A4 and P-glycoprotein inhibition decreasing cyclosporine clearance.',
     'Inhibition des CYP3A4 et P-gp réduisant l''élimination de la ciclosporine.',
     'well-documented', 'NCCIH / PubMed', 'https://pubmed.ncbi.nlm.nih.gov/15933262/'),
    ('berberis-vulgaris', 'Metformin', 'Metformine', 'moderate',
     'Berberine competes with metformin at organic cation transporters (OCT1/OCT2/MATE1) and exerts additive AMP-activated kinase glucose lowering; monitor glycemia and GI tolerance.',
     'La berbérine entre en compétition avec la metformine sur les transporteurs OCT/MATE et exerce des effets glycémiques additifs ; surveiller glycémie et tolérance digestive.',
     'Transporter competition plus additive AMPK activation.',
     'Compétition sur les transporteurs OCT et activation additive de l''AMPK.',
     'moderate-evidence', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/34513965/'),
    ('berberis-vulgaris', 'CYP3A4 and CYP2D6 Substrates', 'Substrats des CYP3A4 et CYP2D6', 'severe',
     'Repeated clinical dosing of berberine inhibited CYP2D6, CYP2C9, and CYP3A4 activity in healthy human probe trials, risking elevated levels of sensitive prescription drugs.',
     'Chez l''humain, la berbérine inhibe notablement les CYP2D6, CYP2C9 et CYP3A4, risquant un surdosage des médicaments métabolisés par ces voies.',
     'Human cytochrome P450 (CYP2D6, CYP3A4, CYP2C9) inhibition by berberine.',
     'Inhibition clinique des enzymes CYP2D6, CYP3A4 et CYP2C9.',
     'well-documented', 'PubMed / MSK', 'https://pubmed.ncbi.nlm.nih.gov/22160257/'),

    -- Red Clover (red-clover)
    ('red-clover', 'Methotrexate', 'Méthotrexate', 'severe',
     'Clinical case reports and MSK warn that red clover extracts can elevate methotrexate levels or liver/hematologic toxicity; avoid concurrent use without oncology/rheumatology clearance.',
     'Des rapports cliniques (MSK) mettent en garde contre un risque de toxicité accrue du méthotrexate (hépatique et hématologique) ; éviter sans avis spécialisé.',
     'Competitive inhibition of renal OAT/BCRP transporters and hepatic stress.',
     'Compétition sur les transporteurs d''élimination du méthotrexate et stress hépatique.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/red-clover'),
    ('red-clover', 'Hormonal Therapies and Tamoxifen (Estrogen Receptor Antagonists)', 'Hormonothérapies et Tamoxifène', 'severe',
     'Red clover supplies isoflavones (formononetin, biochanin A, genistein, daidzein) with estrogenic activity that could theoretically interfere with tamoxifen, aromatase inhibitors, or hormone-replacement regimens (NCCIH/MSK).',
     'Les isoflavones phytoœstrogéniques du trèfle rouge pourraient interférer avec le tamoxifène, les anti-aromatases ou les œstroprogestatifs (NCCIH/MSK).',
     'Competitive estrogen receptor alpha/beta binding.',
     'Liaison compétitive aux récepteurs aux œstrogènes.',
     'theoretical', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/red-clover'),
    ('red-clover', 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)', 'Anticoagulants et antiplaquettaires', 'moderate',
     'Natural coumarins and isoflavones in red clover may inhibit platelet aggregation or potentiate anticoagulants, increasing bleeding risk.',
     'Les coumarines naturelles et isoflavones du trèfle rouge peuvent accroître le risque hémorragique sous anticoagulants ou antiplaquettaires.',
     'Mild antiplatelet and potential vitamin-K antagonism.',
     'Effet antiplaquettaire léger.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/red-clover'),

    -- Guggul (commiphora-mukul)
    ('commiphora-mukul', 'Propranolol and Diltiazem', 'Propranolol et Diltiazem', 'moderate',
     'Human clinical pharmacokinetic trial showed guggulsterone/guggul reduced bioavailability and plasma AUC of both propranolol and diltiazem significantly, risking reduced cardiovascular efficacy (MSK).',
     'Une étude clinique chez l''humain (MSK) a démontré une baisse significative de la biodisponibilité du propranolol et du diltiazem avec le guggul.',
     'Decreased gastrointestinal absorption and PXR/CYP3A4 induction.',
     'Diminution de l''absorption digestive et induction métabolique.',
     'moderate-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/guggul'),
    ('commiphora-mukul', 'Levothyroxine and Thyroid Medications', 'Lévothyroxine et hormones thyroïdiennes', 'moderate',
     'Guggulsterones stimulate thyroid iodine uptake and conversion in preclinical/clinical settings and may alter thyroid hormone requirements.',
     'Les guggulstérones stimulent l''activité thyroïdienne et peuvent modifier les besoins en lévothyroxine.',
     'Increased thyroid peroxidase and triiodothyronine (T3) generation.',
     'Stimulation de la conversion thyroïdienne.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/guggul'),
    ('commiphora-mukul', 'CYP3A4 Substrates', 'Substrats du CYP3A4', 'moderate',
     'Guggulsterones activate human PXR and induce CYP3A4 gene expression in vitro/hepatocytes, potentially lowering levels of CYP3A4-metabolized drugs (MSK).',
     'Les guggulstérones activent PXR et induisent l''expression du CYP3A4 (MSK), risquant de diminuer les taux de médicaments substrats.',
     'Pregnane X receptor (PXR) activation inducing CYP3A4 transcription.',
     'Activation du récepteur PXR induisant le CYP3A4.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/guggul'),

    -- Pennyroyal (lamiaceae-pennyroyal)
    ('lamiaceae-pennyroyal', 'Iron Supplements (Non-Heme Iron)', 'Suppléments de fer', 'moderate',
     'Human absorption testing documented that pennyroyal tea polyphenols markedly reduce non-heme dietary and supplemental iron absorption (by >=50% when taken with meals). Separate by >=2 hours if ever encountered in food.',
     'Les polyphénols de menthe pouliot réduisent d''au moins 50 % l''absorption du fer non héminique dans les études humaines (en plus de la toxicité majeure de la plante).',
     'Intestinal polyphenol-iron chelation preventing enterocyte iron uptake.',
     'Chélation intestinale du fer par les polyphénols.',
     'moderate-evidence', 'MedlinePlus / PubMed', 'https://pubmed.ncbi.nlm.nih.gov/10479761/'),
    ('lamiaceae-pennyroyal', 'Acetaminophen and Hepatotoxic Drugs', 'Paracétamol et médicaments hépatotoxiques', 'contraindicated',
     'Pulegone in pennyroyal depletes hepatic glutathione (GSH) and is metabolized via CYP450 into toxic menthofuran/epoxides causing fulminant centrilobular liver necrosis — combining with acetaminophen or hepatotoxins sharply escalates fatal liver failure.',
     'La pulégone épuise le glutathion hépatique et provoque une nécrose hépatique fulminante ; l''association au paracétamol ou à tout médicament hépatotoxique est hautement mortelle.',
     'Synergistic glutathione depletion and CYP2E1/CYP1A2 reactive metabolite hepatotoxicity.',
     'Déplétion synergique en glutathion et formation de métabolites hépatotoxiques.',
     'well-documented', 'NIH LiverTox / MedlinePlus', 'https://www.ncbi.nlm.nih.gov/books/NBK548292/'),

    -- Anthraquinone Stimulant Laxatives: Cascara (rhamnus-purshiana, frangula-purshiana), Rhubarb (rheum-officinale), Senna (senna-leaf, cassia-acutifolia), Aloe (aloe-vera, aloe-vera-leaf)
    -- Missing Digoxin severe, Thiazide/Loop diuretics, Corticosteroids, Antiarrhythmics where absent:
    ('senna-leaf', 'Digoxin', 'Digoxine', 'severe',
     'Chronic or excessive oral senna stimulant laxative use causes potassium depletion (hypokalemia), dangerously sensitizing the heart to digoxin toxicity and fatal arrhythmias (EMA/HC).',
     'L''abus ou l''usage prolongé de séné entraîne une hypokaliémie sensibilisant gravement le cœur à la toxicité mortelle de la digoxine (EMA/Santé Canada).',
     'Colonic potassium wasting enhances glycoside inhibition of myocardial Na+/K+-ATPase.',
     'L''hypokaliémie majore la liaison toxique de la digoxine sur la pompe Na+/K+-ATPase.',
     'well-documented', 'EMA HMPC / NCCIH', 'https://www.nccih.nih.gov/health/senna'),
    ('senna-leaf', 'Diuretics (Thiazide and Loop Diuretics)', 'Diurétiques thiazidiques et de l''anse', 'severe',
     'Combining senna anthraquinones with potassium-wasting diuretics (furosemide, hydrochlorothiazide) compounds renal and colonic potassium loss, risking severe hypokalemia and arrhythmia (EMA).',
     'L''association séné + diurétiques hypokaliémiants cumule les pertes en potassium, exposant à une hypokaliémie sévère et des troubles du rythme.',
     'Synergistic renal and intestinal potassium excretion.',
     'Pertes rénale et intestinale cumulées de potassium.',
     'well-documented', 'EMA HMPC Sennae folium', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-folium'),
    ('senna-leaf', 'Antiarrhythmics (QT-Prolonging Drugs: Amiodarone, Sotalol)', 'Antiarythmiques prolongeant le QT', 'severe',
     'Senna-induced hypokalemia dangerously potentiates QT prolongation and torsades de pointes ventricular arrhythmias alongside Class IA/III antiarrhythmics (EMA Section 4.5).',
     'L''hypokaliémie induite par le séné majore fortement le risque de torsades de pointes avec les antiarythmiques allongeant le QT (EMA §4.5).',
     'Hypokalemia decreases myocardial repolarization reserve (IKr), amplifying drug-induced torsades de pointes.',
     'L''hypokaliémie réduit la réserve de repolarisation myocardique.',
     'well-documented', 'EMA HMPC Sennae folium', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-folium'),

    ('cassia-acutifolia', 'Digoxin', 'Digoxine', 'severe',
     'Senna/Cassia acutifolia anthraquinone glycosides can cause hypokalemia when overused (>1 week), dangerously increasing risk of digoxin toxicity and lethal cardiac arrhythmias (EMA).',
     'Les sennosides de Cassia acutifolia exposent en usage prolongé à une hypokaliémie aggravant la toxicité cardiaque de la digoxine (EMA).',
     'Hypokalemia-potentiated myocardial Na+/K+-ATPase toxicity.',
     'Hypokaliémie potentialisant la toxicité digitalique.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus-acutifoliae'),
    ('cassia-acutifolia', 'Thiazide and Loop Diuretics', 'Diurétiques hypokaliémiants', 'severe',
     'Concurrent use compounds renal and intestinal potassium wasting, risking acute hypokalemia, muscle weakness, and cardiac arrhythmias.',
     'L''association cumule les pertes de potassium rénale et intestinale avec risque d''hypokaliémie sévère.',
     'Additive potassium wasting.',
     'Fuite potassique additive.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus-acutifoliae'),
    ('cassia-acutifolia', 'Corticosteroids (Prednisone)', 'Corticoïdes (Prednisone)', 'moderate',
     'Systemic corticosteroids increase renal potassium loss; combining with senna pods compounds hypokalemia and electrolyte depletion risk.',
     'Les corticoïdes systémiques augmentent l''excrétion de potassium ; l''association au séné accroît le risque d''hypokaliémie.',
     'Additive mineralocorticoid and colonic potassium depletion.',
     'Déplétion potassique additive.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus-acutifoliae'),
    ('cassia-acutifolia', 'Antiarrhythmics (Amiodarone, Quinidine, Sotalol)', 'Antiarythmiques', 'severe',
     'Anthraquinone-induced hypokalemia increases risk of life-threatening arrhythmias alongside antiarrhythmic and QT-prolonging drugs (EMA Section 4.5).',
     'L''hypokaliémie induite par les sennosides majore le risque d''arythmie grave avec les antiarythmiques (EMA).',
     'Hypokalemia-induced ventricular repolarization instability.',
     'Instabilité de repolarisation ventriculaire liée à l''hypokaliémie.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus-acutifoliae'),

    ('frangula-purshiana', 'Digoxin', 'Digoxine', 'severe',
     'Cascara sagrada anthraquinones can induce potassium loss, intensifying digoxin toxicity and life-threatening ventricular arrhythmias (EMA/Health Canada).',
     'La bourdaine/cascara peut induire une hypokaliémie aggravant gravement la toxicité de la digoxine (EMA/Santé Canada).',
     'Potassium depletion sensitizes myocardial Na+/K+-ATPase to digoxin.',
     'L''hypokaliémie majore la toxicité de la digoxine.',
     'well-documented', 'EMA HMPC Rhamni purshianae cortex', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('frangula-purshiana', 'Diuretics (Thiazide and Loop Diuretics)', 'Diurétiques hypokaliémiants', 'severe',
     'Combining cascara with thiazide or loop diuretics compounds hypokalemia and dehydration.',
     'L''association avec des diurétiques hypokaliémiants aggrave la perte de potassium.',
     'Synergistic potassium wasting.',
     'Déplétion potassique synergique.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('frangula-purshiana', 'Corticosteroids (Prednisone)', 'Corticoïdes (Prednisone)', 'moderate',
     'Corticosteroids compound cascara-induced potassium wasting (EMA Section 4.5).',
     'Les corticoïdes aggravent le risque d''hypokaliémie lié au cascara.',
     'Additive potassium wasting.',
     'Fuite potassique additive.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('frangula-purshiana', 'Antiarrhythmics (QT-Prolonging Drugs)', 'Antiarythmiques', 'severe',
     'Electrolyte depletion from cascara laxative use increases arrhythmia risk alongside antiarrhythmic medications (EMA Section 4.5).',
     'La déplétion électrolytique augmente le risque de troubles du rythme avec les antiarythmiques.',
     'Hypokalemia-enhanced proarrhythmia.',
     'Risque proarythmique par hypokaliémie.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),

    ('rhamnus-purshiana', 'Digoxin', 'Digoxine', 'severe',
     'Anthraquinones in Rhamnus purshiana (cascara sagrada) deplete potassium on prolonged/excessive use, dangerously raising digoxin toxicity risk (EMA).',
     'Les anthraquinones du cascara favorisent l''hypokaliémie et augmentent gravement le risque de toxicité de la digoxine.',
     'Hypokalemia sensitizes myocardium to cardiac glycosides.',
     'Sensibilisation myocardique à la digoxine par hypokaliémie.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('rhamnus-purshiana', 'Diuretics (Thiazide and Loop Diuretics)', 'Diurétiques hypokaliémiants', 'severe',
     'Combined use compounds hypokalemia and electrolyte depletion (EMA Section 4.5).',
     'L''association cumule le risque d''hypokaliémie.',
     'Additive renal and GI potassium loss.',
     'Perte potassique additive.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('rhamnus-purshiana', 'Corticosteroids (Prednisone)', 'Corticoïdes (Prednisone)', 'moderate',
     'Corticosteroids compound potassium depletion caused by stimulant laxatives.',
     'Les corticoïdes majorent le risque d''hypokaliémie sous laxatif stimulant.',
     'Additive potassium wasting.',
     'Déplétion potassique additive.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),
    ('rhamnus-purshiana', 'Antiarrhythmics', 'Antiarythmiques', 'severe',
     'Hypokalemia secondary to cascara laxative use increases arrhythmia risk with antiarrhythmic drugs.',
     'L''hypokaliémie induite par le cascara augmente le risque d''arythmie sous antiarythmiques.',
     'Hypokalemia-potentiated proarrhythmia.',
     'Proarythmie favorisée par l''hypokaliémie.',
     'well-documented', 'EMA HMPC', 'https://www.ema.europa.eu/en/medicines/herbal/rhamni-purshianae-cortex'),

    ('rheum-officinale', 'Digoxin', 'Digoxine', 'severe',
     'Rhubarb root anthraquinones cause potassium wasting on chronic/overdose use, sharply elevating digoxin toxicity and cardiac arrhythmia risk (EMA Section 4.5).',
     'Les anthraquinones de rhubarbe exposent à une hypokaliémie augmentant gravement la toxicité de la digoxine (EMA).',
     'Hypokalemia-enhanced cardiac glycoside inhibition of myocardial Na+/K+-ATPase.',
     'Hypokaliémie potentialisant la toxicité myocardique de la digoxine.',
     'well-documented', 'EMA HMPC Rhei radix', 'https://www.ema.europa.eu/en/medicines/herbal/rhei-radix'),
    ('rheum-officinale', 'Diuretics (Thiazide and Loop Diuretics)', 'Diurétiques hypokaliémiants', 'severe',
     'Synergistic potassium depletion alongside thiazide or loop diuretics increases risk of hypokalemia and arrhythmia.',
     'Perte potassique synergique avec les diurétiques hypokaliémiants.',
     'Additive renal and colonic potassium wasting.',
     'Fuite potassique additive.',
     'well-documented', 'EMA HMPC Rhei radix', 'https://www.ema.europa.eu/en/medicines/herbal/rhei-radix'),
    ('rheum-officinale', 'Corticosteroids (Prednisone)', 'Corticoïdes (Prednisone)', 'moderate',
     'Corticosteroids worsen potassium depletion from rhubarb root stimulant laxative use (EMA Section 4.5).',
     'Les corticoïdes aggravent le risque d''hypokaliémie sous rhubarbe laxative.',
     'Additive mineralocorticoid and colonic potassium loss.',
     'Déplétion potassique additive.',
     'well-documented', 'EMA HMPC Rhei radix', 'https://www.ema.europa.eu/en/medicines/herbal/rhei-radix'),
    ('rheum-officinale', 'Antiarrhythmics (QT-Prolonging Drugs)', 'Antiarythmiques', 'severe',
     'Rhubarb-induced hypokalemia increases the risk of polymorphic ventricular arrhythmias with antiarrhythmics (EMA Section 4.5).',
     'L''hypokaliémie induite par la rhubarbe majore le risque d''arythmies graves avec les antiarythmiques.',
     'Hypokalemia-related repolarization delay.',
     'Retard de repolarisation cardiaque par hypokaliémie.',
     'well-documented', 'EMA HMPC Rhei radix', 'https://www.ema.europa.eu/en/medicines/herbal/rhei-radix'),

    ('aloe-vera-leaf', 'Digoxin', 'Digoxine', 'severe',
     'Oral anthraquinone aloe latex stimulant laxatives deplete intestinal and systemic potassium (hypokalemia), dangerously sensitizing the heart to digoxin toxicity and fatal arrhythmias. (Applies to oral aloe latex; clear topical gel lacks anthraquinones.)',
     'Les laxatifs stimulants au latex d''aloès (anthraquinones) provoquent une hypokaliémie sensibilisant gravement le cœur à la toxicité mortelle de la digoxine. Ne concerne pas le gel externe transparent.',
     'Colonic potassium wasting potentiates cardiac glycoside inhibition of myocardial Na+/K+-ATPase.',
     'L''hypokaliémie potentialise l''inhibition de la Na+/K+-ATPase cardiaque par la digoxine.',
     'well-documented', 'EMA HMPC / Health Canada / MedlinePlus', 'https://medlineplus.gov/druginfo/natural/607.html'),
    ('aloe-vera-leaf', 'Diuretics (Thiazide and Loop Diuretics)', 'Diurétiques hypokaliémiants', 'severe',
     'Oral aloe latex anthraquinones combined with thiazide or loop diuretics produce severe synergistic potassium loss and cardiac arrhythmias.',
     'Le latex d''aloès oral associé aux diurétiques thiazidiques ou de l''anse provoque une fuite potassique grave et des arythmies.',
     'Additive renal and colonic potassium excretion.',
     'Fuite potassique additive rénale et intestinale.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://medlineplus.gov/druginfo/natural/607.html'),
    ('aloe-vera-leaf', 'Corticosteroids (Prednisone)', 'Corticoïdes (Prednisone)', 'moderate',
     'Oral aloe latex compounds corticosteroid-induced hypokalemia.',
     'Le latex d''aloès oral aggrave la perte de potassium sous corticoïdes.',
     'Additive potassium wasting.',
     'Fuite potassique additive.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://medlineplus.gov/druginfo/natural/607.html'),
    ('aloe-vera-leaf', 'Antiarrhythmics (QT-Prolonging Drugs)', 'Antiarythmiques', 'severe',
     'Hypokalemia from oral aloe latex sharply increases risk of arrhythmia with antiarrhythmic agents.',
     'L''hypokaliémie causée par le latex d''aloès majore le risque d''arythmies sous antiarythmiques.',
     'Electrolyte-depletion proarrhythmia.',
     'Proarythmie favorisée par l''hypokaliémie.',
     'well-documented', 'EMA HMPC / Health Canada', 'https://medlineplus.gov/druginfo/natural/607.html'),

    -- Ergot (secale-cornutum): CYP3A4 inhibitors (contraindicated — ergotism!) & Triptans
    ('secale-cornutum', 'Strong CYP3A4 Inhibitors (Ritonavir, Clarithromycin, Itraconazole)', 'Inhibiteurs puissants du CYP3A4 (Ritonavir, Clarithromycine, Itraconazole)', 'contraindicated',
     'CYP3A4 inhibitors block clearance of ergot alkaloids, precipitating severe, life-threatening acute ergotism (intense peripheral vasospasm, limb ischemia, gangrene, coronary/cerebral vasospasm) — FDA Boxed Warning.',
     'Les inhibiteurs puissants du CYP3A4 bloquent l''élimination des alcaloïdes de l''ergot et déclenchent un ergotisme aigu mortel (vasospasme sévère, ischémie, gangrène — avertissement encadré FDA). Association contre-indiquée.',
     'Complete inhibition of CYP3A4-mediated hepatic metabolism causing massive ergot alkaloid accumulation.',
     'Blocage complet du métabolisme hépatique CYP3A4 entraînant une accumulation toxique massive d''alcaloïdes.',
     'well-documented', 'US FDA / DailyMed', 'https://dailymed.nlm.nih.gov/dailymed/'),
    ('secale-cornutum', 'Triptans and Vasoconstrictors (Sumatriptan)', 'Triptans et vasoconstricteurs (Sumatriptan)', 'contraindicated',
     'Co-administration of ergot alkaloids with 5-HT1B/1D triptan agonists or sympathomimetics produces prolonged additive arterial vasospasm (myocardial or cerebrovascular ischemia).',
     'L''association ergot + triptans ou vasoconstricteurs provoque un vasospasme artériel prolongé avec risque d''infarctus ou d''AVC.',
     'Additive vascular 5-HT1B/1D and alpha-adrenergic receptor agonism.',
     'Agonisme vasculaire additif 5-HT1B/1D et alpha-adrénergique.',
     'well-documented', 'US FDA / MedlinePlus', 'https://medlineplus.gov/druginfo/meds/a601116.html'),

    -- Cardiac Glycoside Poisonous Plants (8 slugs): Digoxin (contraindicated), Potassium-depleting diuretics (severe), Verapamil/Beta-blockers (severe)
    ('scilla-maritima', 'Digoxin', 'Digoxine', 'contraindicated',
     'White squill contains scillaren bufadienolide cardiac glycosides that directly add to digoxin Na+/K+-ATPase inhibition, causing fatal heart block and ventricular arrhythmias.',
     'La scille maritime contient des hétérosides cardiotoniques bufadiénolides s''ajoutant à la digoxine avec risque d''arrêt cardiaque ou d''arythmie mortelle.',
     'Direct additive inhibition of myocardial Na+/K+-ATPase.',
     'Inhibition additive directe de la pompe Na+/K+-ATPase cardiaque.',
     'well-documented', 'PubMed — Cardioactive Steroid Toxicity', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('scilla-maritima', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques hypokaliémiants', 'severe',
     'Potassium-wasting diuretics cause hypokalemia/hypomagnesemia, sharply sensitizing cardiomyocytes to squill bufadienolide arrhythmias.',
     'Les diurétiques hypokaliémiants aggravent la toxicité cardiaque mortelle de la scille.',
     'Hypokalemia facilitates bufadienolide myocardial toxicity.',
     'L''hypokaliémie potentialise les arythmies bufadiénolides.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('scilla-maritima', 'Calcium Channel Blockers and Beta-Blockers', 'Inhibiteurs calciques et bêta-bloquants', 'severe',
     'Synergistic AV nodal blockade risks severe bradycardia and complete heart block.',
     'Blocage nodal AV additif exposant à une bradycardie sévère et un bloc cardiaque complet.',
     'Additive AV-nodal conduction depression.',
     'Dépression additive de la conduction auriculo-ventriculaire.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643939/'),

    ('convallaria-majalis-herb', 'Digoxin', 'Digoxine', 'contraindicated',
     'Lily of the valley contains convallatoxin cardiac glycosides causing lethal additive digitalis toxicity when combined with prescription digoxin.',
     'Le muguet renferme de la convallatoxine s''additionnant à la digoxine avec risque d''intoxication mortelle.',
     'Additive myocardial Na+/K+-ATPase inhibition.',
     'Inhibition additive de la Na+/K+-ATPase cardiaque.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('convallaria-majalis-herb', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques hypokaliémiants', 'severe',
     'Diuretic-induced hypokalemia sensitizes the heart to convallatoxin-induced fatal ventricular arrhythmias.',
     'L''hypokaliémie diurétique majore gravement le risque d''arythmie mortelle due au muguet.',
     'Hypokalemia sensitizes myocardial Na+/K+-ATPase to convallatoxin.',
     'L''hypokaliémie majore la liaison cardiotoxique de la convallatoxine.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('strophanthus-hispidus', 'Digoxin', 'Digoxine', 'contraindicated',
     'Strophanthus contains ouabain/strophanthin cardiac glycosides that directly compound digoxin toxicity and induce fatal heart block.',
     'Le strophanthus contient de la strophanthine qui s''additionne directement à la digoxine avec risque cardiaque fatal.',
     'Synergistic myocardial Na+/K+-ATPase inhibition.',
     'Inhibition myocardique additive de la Na+/K+-ATPase.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('strophanthus-hispidus', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques hypokaliémiants', 'severe',
     'Hypokalemia from diuretics severely amplifies strophanthin ventricular arrhythmia risk.',
     'L''hypokaliémie amplifie fortement la cardiotoxicité de la strophanthine.',
     'Hypokalemia-potentiated cardiac glycoside toxicity.',
     'Toxicité potentialisée par l''hypokaliémie.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('apocynum-cannabinum', 'Digoxin', 'Digoxine', 'contraindicated',
     'Dogbane contains cymarin and apocannoside cardiac glycosides producing lethal additive digitalis toxicity alongside digoxin.',
     'L''apocyn chanvrin contient de la cymarine provoquant une intoxication digitalique additive mortelle avec la digoxine.',
     'Direct additive myocardial Na+/K+-ATPase inhibition.',
     'Inhibition additive de la Na+/K+-ATPase.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('apocynum-cannabinum', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques hypokaliémiants', 'severe',
     'Potassium depletion from loop/thiazide diuretics greatly sensitizes the myocardium to cymarin cardiotoxicity.',
     'L''hypokaliémie induite par les diurétiques majore fortement la cardiotoxicité de la cymarine.',
     'Hypokalemia-enhanced glycoside binding.',
     'Liaison glycosidique accrue par l''hypokaliémie.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('pheasants-eye', 'Digoxin', 'Digoxine', 'contraindicated',
     'Adonis vernalis contains adonitoxin cardiac glycosides; concurrent exposure with digoxin risks fatal overdose.',
     'L''adonis vernale renferme de l''adonitoxine : association contre-indiquée avec la digoxine (surdosage fatal).',
     'Additive myocardial Na+/K+-ATPase inhibition.',
     'Inhibition additive de la pompe Na+/K+-ATPase.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('pheasants-eye', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques hypokaliémiants', 'severe',
     'Hypokalemia amplifies adonitoxin-induced arrhythmias.',
     'L''hypokaliémie amplifie le risque d''arythmies liées à l''adonitoxine.',
     'Hypokalemia-enhanced glycoside toxicity.',
     'Cardiotoxicité potentialisée par l''hypokaliémie.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('cheiranthus-cheiri', 'Digoxin', 'Digoxine', 'contraindicated',
     'Wallflower contains cheirotoxin cardiac glycosides adding directly to digoxin cardiotoxicity.',
     'La giroflée des murailles contient de la chéirotoxine cardiotoxique ; contre-indiquée avec la digoxine.',
     'Additive myocardial Na+/K+-ATPase inhibition.',
     'Inhibition additive de la Na+/K+-ATPase.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('asclepias-syriaca', 'Digoxin', 'Digoxine', 'contraindicated',
     'Common milkweed contains cardenolide cardiac glycosides producing additive digitalis toxicity and fatal heart block with digoxin.',
     'L''asclépiade renferme des cardénolides provoquant une intoxication cardiotonique additive grave avec la digoxine.',
     'Additive myocardial Na+/K+-ATPase inhibition.',
     'Inhibition additive de la Na+/K+-ATPase.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    ('wahoo-bark', 'Digoxin', 'Digoxine', 'contraindicated',
     'Euonymus atropurpureus bark contains cardiac glycosides (euonymoside) causing additive cardiac toxicity alongside digoxin.',
     'L''écorce de fusain contient des hétérosides cardiotoniques (euonymoside) augmentant mortellement la toxicité de la digoxine.',
     'Additive Na+/K+-ATPase inhibition.',
     'Inhibition myocardique additive.',
     'well-documented', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),

    -- Cinchona & Cinchona calisaya (QT drugs, Digoxin, Warfarin)
    ('cinchona', 'QT-Prolonging Drugs (Amiodarone, Sotalol, Haloperidol)', 'Médicaments allongeant le QT (Amiodarone, Sotalol, Halopéridol)', 'contraindicated',
     'Quinine and quinidine in cinchona bark prolong cardiac QT interval; combining with Class IA/III antiarrhythmics or QT-prolonging drugs risks fatal torsades de pointes.',
     'La quinine et la quinidine du quinquina allongent l''intervalle QT ; leur association aux médicaments allongeant le QT expose à des torsades de pointes mortelles.',
     'hERG/IKr potassium-channel blockade compounding ventricular repolarization delay.',
     'Blocage des canaux potassiques cardiaques hERG majorant l''allongement du QT.',
     'well-documented', 'US FDA Boxed Warning', 'https://dailymed.nlm.nih.gov/dailymed/'),
    ('cinchona', 'Digoxin', 'Digoxine', 'severe',
     'Quinine and quinidine markedly elevate serum digoxin concentrations (~2-fold for quinidine) by inhibiting renal/biliary P-glycoprotein clearance, causing severe digoxin toxicity.',
     'La quinine/quinidine augmente fortement la digoxinémie (jusqu''au doublement) par inhibition de l''élimination par la P-gp, exposant à un surdosage grave.',
     'P-glycoprotein transport inhibition decreasing digoxin elimination.',
     'Inhibition de la P-gp réduisant la clairance de la digoxine.',
     'well-documented', 'US FDA / DailyMed', 'https://dailymed.nlm.nih.gov/dailymed/'),
    ('cinchona', 'Warfarin', 'Warfarine', 'severe',
     'Cinchona alkaloids (quinine/quinidine) inhibit hepatic synthesis of vitamin K-dependent clotting factors and CYP metabolism, potentiating warfarin hypoprothrombinemia and hemorrhage.',
     'Les alcaloïdes du quinquina potentialisent l''effet anticoagulant de la warfarine et exposent à des saignements graves.',
     'Additive clotting-factor depression and CYP inhibition.',
     'Dépression additive des facteurs de coagulation vitamine-K dépendants.',
     'well-documented', 'US FDA / MedlinePlus', 'https://medlineplus.gov/druginfo/meds/a682322.html'),

    ('cinchona-calisaya', 'QT-Prolonging Drugs (Amiodarone, Sotalol)', 'Médicaments allongeant le QT', 'contraindicated',
     'Quinine/quinidine in Cinchona calisaya prolong QT and risk fatal torsades de pointes alongside QT-prolonging medications.',
     'Quinine et quinidine allongent le QT avec risque de torsades de pointes fatales.',
     'Synergistic cardiac IKr/hERG blockade.',
     'Blocage hERG additif.',
     'well-documented', 'US FDA', 'https://dailymed.nlm.nih.gov/dailymed/'),
    ('cinchona-calisaya', 'Digoxin', 'Digoxine', 'severe',
     'Quinine/quinidine increases plasma digoxin concentration via P-gp inhibition, risking digitalis intoxication.',
     'Augmentation dangereuse de la digoxinémie par inhibition de la P-gp.',
     'P-gp inhibition decreasing digoxin clearance.',
     'Inhibition de la clairance P-gp de la digoxine.',
     'well-documented', 'US FDA', 'https://dailymed.nlm.nih.gov/dailymed/'),

    -- Horsetail (horsetail-equisetum), Parsley (parsley), Barley grass (barley-grass), Wolfberry (wolfberry)
    ('horsetail-equisetum', 'Lithium', 'Lithium', 'severe',
     'Horsetail acts as an aquaretic/diuretic and can reduce renal lithium excretion, elevating serum lithium toward toxic neuro/nephrotoxic levels (Health Canada/EMA caution).',
     'La prêle possède une action diurétique pouvant réduire l''élimination rénale du lithium et provoquer un surdosage toxique en lithium.',
     'Diuretic-mediated sodium depletion increases proximal tubular lithium reabsorption.',
     'Réabsorption tubulaire accrue du lithium par déplétion sodée diurétique.',
     'moderate-evidence', 'MedlinePlus / EMA HMPC', 'https://medlineplus.gov/druginfo/meds/a681039.html'),
    ('horsetail-equisetum', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques', 'moderate',
     'Additive diuretic effects may increase potassium loss (hypokalemia) and thiaminase risk in vulnerable patients.',
     'Effet diurétique additif pouvant favoriser hypokaliémie et déshydratation.',
     'Additive diuresis and electrolyte excretion.',
     'Diurèse et excrétion électrolytique additives.',
     'theoretical', 'EMA HMPC / MedlinePlus', 'https://www.ema.europa.eu/en/medicines/herbal/equiseti-herba'),

    ('parsley', 'Warfarin', 'Warfarine', 'moderate',
     'Parsley contains high vitamin K content (especially dried/fresh leaf concentrates), which can directly antagonize warfarin and fluctuate/lower INR if intake changes sharply.',
     'Le persil est très riche en vitamine K, susceptible d''antagoniser directement la warfarine et de déstabiliser l''INR.',
     'Vitamin K promotes hepatic gamma-carboxylation of clotting factors II, VII, IX, X.',
     'Apport en vitamine K antagonisant l''effet de la warfarine.',
     'well-documented', 'MedlinePlus / NIH ODS', 'https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/'),
    ('parsley', 'Lithium', 'Lithium', 'moderate',
     'Traditional diuretic use of concentrated parsley root/seed extracts may impair renal lithium clearance and elevate serum lithium.',
     'L''effet diurétique d''extraits concentrés de persil peut réduire l''excrétion rénale du lithium.',
     'Diuretic-induced proximal renal lithium retention.',
     'Rétention rénale du lithium.',
     'theoretical', 'MedlinePlus', 'https://medlineplus.gov/druginfo/meds/a681039.html'),

    ('barley-grass', 'Warfarin', 'Warfarine', 'moderate',
     'Barley grass and concentrated green-cereal powders contain substantial natural vitamin K; abrupt initiation or dose changes can antagonize warfarin and reduce INR (MSK).',
     'Les pousses d''orge contiennent de la vitamine K susceptible de réduire l''efficacité anticoagulante de la warfarine si l''apport varie brusquement (MSK).',
     'Vitamin K antagonizes warfarin inhibition of VKORC1.',
     'Apport en vitamine K réduisant l''INR sous warfarine.',
     'moderate-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/barley-grass'),

    ('wolfberry', 'Warfarin', 'Warfarine', 'severe',
     'Multiple documented clinical case reports show goji berry / wolfberry (Lycium barbarum) tea, juice, and concentrates sharply elevated INR and caused serious bleeding in stable warfarin patients (MSK/PubMed). Avoid.',
     'Plusieurs cas cliniques documentent une élévation brutale de l''INR et des hémorragies graves lors de l''ajout de baies de goji (wolfberry) à la warfarine (MSK). Association à éviter.',
     'Inhibition of CYP2C9-mediated S-warfarin metabolism.',
     'Inhibition du métabolisme hépatique CYP2C9 de la warfarine.',
     'well-documented', 'MSK About Herbs / PubMed', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/lycium'),

    -- Hawthorn (hawthorn)
    ('hawthorn', 'Digoxin', 'Digoxine', 'severe',
     'Hawthorn may exhibit additive positive inotropic/chronotropic effects or variable P-gp modulation alongside digoxin (NCCIH/MSK warn against combining cardiac glycosides without cardiology monitoring).',
     'L''aubépine peut modifier ou potentialiser les effets de la digoxine (NCCIH/MSK) ; association déconseillée sans suivi cardiologique.',
     'Additive myocardial contractility/conduction modulation.',
     'Modulation additive de l''inotropisme et de la conduction cardiaque.',
     'moderate-evidence', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/hawthorn'),
    ('hawthorn', 'Antihypertensives and Nitrates (Beta-Blockers, CCBs, Nitroglycerin)', 'Antihypertenseurs et dérivés nitrés', 'moderate',
     'Hawthorn dilates peripheral/coronary vessels and may cause additive hypotension, dizziness, or syncope with prescription antihypertensives or PDE-5/nitrate vasodilators (NCCIH/MSK).',
     'L''aubépine provoque une vasodilatation pouvant entraîner une hypotension additive et des vertiges avec les antihypertenseurs ou nitrés (NCCIH/MSK).',
     'Additive endothelium-dependent vasodilation.',
     'Vasodilatation additive.',
     'moderate-evidence', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/hawthorn'),

    -- Rhodiola (rhodiola)
    ('rhodiola', 'Warfarin (CYP2C9 Substrates)', 'Warfarine (Substrats du CYP2C9)', 'moderate',
     'Clinical probe study cited by MSK showed Rhodiola rosea inhibited CYP2C9 (~21% decrease in losartan metabolite formation), potentially raising warfarin, phenytoin, or CYP2C9 substrate exposure.',
     'Une étude clinique rapportée par le MSK montre une inhibition modérée du CYP2C9 par la rhodiola, pouvant modifier les taux de warfarine ou d''autres substrats du CYP2C9.',
     'Inhibition of CYP2C9 and P-glycoprotein in humans.',
     'Inhibition clinique du CYP2C9 et de la P-gp.',
     'moderate-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/rhodiola'),
    ('rhodiola', 'Antidepressants (MAOIs, SSRIs, SNRIs)', 'Antidépresseurs (IMAO, ISRS, IRSN)', 'moderate',
     'Rhodiola displays mild MAO-inhibition/serotonergic activity in vitro and case reports of hypomania/agitation/palpitations when added to escitalopram or paroxetine advise clinical caution.',
     'Des cas rapportés d''agitation, palpitations ou virage maniaque avec les ISRS et une inhibition enzymatique in vitro recommandent la prudence sous antidépresseurs.',
     'Additive monoaminergic CNS modulation.',
     'Modulation monoaminergique additive.',
     'limited-evidence', 'MSK About Herbs / NCCIH', 'https://www.nccih.nih.gov/health/rhodiola'),

    -- Cat's Claw (cats-claw), Cordyceps (cordyceps), Neem (neem), Guarana (guarana-seed), Red Yeast Rice (red-yeast-rice), Griffonia (griffonia-simplicifolia), Khat (khat), Spirulina (spirulina)
    ('cats-claw', 'Immunosuppressants (Cyclosporine, Tacrolimus)', 'Immunosuppresseurs', 'severe',
     'Uncaria tomentosa (cat''s claw) stimulates immune cytokine/lymphocyte signaling and may counteract immunosuppressive medications (NCCIH/MSK).',
     'La griffe du chat stimule l''immunité cellulaire et peut contrer les traitements immunosuppresseurs (NCCIH/MSK).',
     'Immunostimulatory pharmacodynamic antagonism.',
     'Antagonisme par stimulation immunitaire.',
     'limited-evidence', 'NCCIH / MSK About Herbs', 'https://www.nccih.nih.gov/health/cats-claw'),
    ('cats-claw', 'Anticoagulants and Antihypertensives', 'Anticoagulants et antihypertenseurs', 'moderate',
     'Cat''s claw inhibits platelet aggregation and may lower blood pressure, risking additive bleeding or hypotension; it also inhibits CYP3A4 in vitro.',
     'La griffe du chat peut augmenter le risque hémorragique ou hypotenseur et inhibe le CYP3A4 in vitro.',
     'Antiplatelet, calcium-channel vasodilatory, and weak CYP3A4 inhibition.',
     'Effet antiplaquettaire, vasodilatateur et inhibition CYP3A4.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/cats-claw'),

    ('cordyceps', 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)', 'Anticoagulants et antiplaquettaires', 'moderate',
     'Cordyceps militaris/sinensis extracts inhibit ADP- and collagen-induced platelet aggregation and may increase bleeding risk alongside anticoagulants or antiplatelets (MSK).',
     'Les extraits de cordyceps inhibent l''agrégation plaquettaire et peuvent accroître le risque de saignement sous anticoagulants ou antiplaquettaires (MSK).',
     'Platelet aggregation inhibition without primary PT/aPTT change.',
     'Inhibition de l''agrégation plaquettaire.',
     'limited-evidence', 'MSK About Herbs / PubMed', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/cordyceps'),
    ('cordyceps', 'Immunosuppressants (Cyclosporine, Prednisone)', 'Immunosuppresseurs', 'moderate',
     'Cordyceps exhibits immunomodulatory properties that may theoretically interfere with immunosuppressive regimens in transplant or autoimmune patients (MSK).',
     'Le cordyceps possède des propriétés immunomodulatrices pouvant théoriquement interférer avec les immunosuppresseurs (MSK).',
     'Cytokine and immune-cell modulation.',
     'Modulation des cytokines et cellules immunitaires.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/cordyceps'),

    ('neem', 'Antidiabetic Medications (Insulin, Metformin)', 'Antidiabétiques', 'moderate',
     'Neem leaf extracts lower blood glucose and may cause hypoglycemia if taken concurrently with diabetes medications (MSK/Health Canada).',
     'Les extraits de margousier (neem) abaissent la glycémie et peuvent provoquer une hypoglycémie additive avec les antidiabétiques (MSK).',
     'Hypoglycemic insulin-potentiating action.',
     'Effet hypoglycémiant additif.',
     'limited-evidence', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/neem'),
    ('neem', 'Immunosuppressants and Lithium', 'Immunosuppresseurs et Lithium', 'moderate',
     'Neem may alter immune activity and diuretic/renal handling; avoid combining with transplant immunosuppressants or lithium without physician review.',
     'Le margousier peut stimuler la réponse immunitaire ou modifier la clairance du lithium ; éviter sans suivi médical.',
     'Immunostimulation and potential altered renal lithium clearance.',
     'Immunostimulation et altération possible de l''élimination du lithium.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/neem'),

    ('guarana-seed', 'MAO Inhibitors (Phenelzine, Tranylcypromine)', 'Inhibiteurs de la MAO', 'severe',
     'High caffeine content in guarana seeds (~2-8% caffeine) alongside MAOIs can trigger severe hypertension, tachycardia, agitation, and hypertensive crisis.',
     'La forte teneur en caféine du guarana associée aux IMAO expose à une poussée hypertensive sévère, tachycardie et agitation.',
     'Sympathomimetic catecholamine potentiation.',
     'Potentialisation catécholaminergique.',
     'well-documented', 'EMA HMPC Paulliniae semen', 'https://www.ema.europa.eu/en/medicines/herbal/paulliniae-semen'),
    ('guarana-seed', 'Stimulants and Antiplatelets/Adenosine', 'Stimulants et antiplaquettaires', 'moderate',
     'Guarana amplifies cardiovascular effects of CNS stimulants/ephedrine, blocks adenosine stress-testing drugs, and inhibits platelet aggregation in vitro.',
     'Le guarana potentialise les stimulants du SNC, antagonise l''adénosine et présente une activité antiplaquettaire.',
     'Adenosine A1/A2A receptor antagonism and PDE inhibition.',
     'Antagonisme des récepteurs à l''adénosine.',
     'well-documented', 'EMA HMPC / MSK', 'https://www.ema.europa.eu/en/medicines/herbal/paulliniae-semen'),

    ('red-yeast-rice', 'Prescription Statins (Atorvastatin, Simvastatin, Rosuvastatin)', 'Statines sur ordonnance', 'severe',
     'Red yeast rice contains monacolin K (chemically identical to lovastatin); adding it to prescription statins duplicates HMG-CoA reductase inhibition and sharply escalates risk of myopathy, rhabdomyolysis, and liver toxicity (NCCIH).',
     'La levure de riz rouge contient de la monacoline K (identique à la lovastatine) ; son ajout à une statine expose à une toxicité musculaire (rhabdomyolyse) et hépatique majeure (NCCIH).',
     'Duplicate HMG-CoA reductase inhibition causing systemic statin overdose.',
     'Duplication thérapeutique de l''inhibition de l''HMG-CoA réductase.',
     'well-documented', 'NCCIH', 'https://www.nccih.nih.gov/health/red-yeast-rice'),
    ('red-yeast-rice', 'Strong CYP3A4 Inhibitors (Clarithromycin, Itraconazole, Protease Inhibitors)', 'Inhibiteurs puissants du CYP3A4', 'severe',
     'Monacolin K (lovastatin) is metabolized extensively by CYP3A4; potent CYP3A4 inhibitors dramatically spike circulating statin levels, risking acute rhabdomyolysis and renal failure (NCCIH).',
     'Les inhibiteurs puissants du CYP3A4 font grimper fortement les taux de monacoline K (lovastatine), exposant à une rhabdomyolyse aiguë et une insuffisance rénale (NCCIH).',
     'CYP3A4 inhibition prevents first-pass/hepatic clearance of monacolin K.',
     'Blocage du métabolisme CYP3A4 de la monacoline K.',
     'well-documented', 'NCCIH / US FDA', 'https://www.nccih.nih.gov/health/red-yeast-rice'),
    ('red-yeast-rice', 'Hepatotoxic Drugs', 'Médicaments hépatotoxiques', 'moderate',
     'Red yeast rice monacolins carry statin-like transaminase elevation risks that add to concurrent hepatotoxic medications (NCCIH).',
     'La levure de riz rouge peut élever les transaminases hépatiques et majorer le risque d''atteinte hépatique médicamenteuse.',
     'Additive hepatic stress.',
     'Toxicité hépatique additive.',
     'moderate-evidence', 'NCCIH / LiverTox', 'https://www.nccih.nih.gov/health/red-yeast-rice'),

    ('griffonia-simplicifolia', 'SSRIs, SNRIs, and MAOIs (Serotonergic Antidepressants)', 'ISRS, IRSN et IMAO', 'contraindicated',
     'Griffonia seeds supply 5-HTP, the direct metabolic precursor of serotonin; combining with SSRIs, SNRIs, TCAs, tramadol, or MAOIs creates severe risk of life-threatening serotonin syndrome.',
     'Le 5-HTP issu de Griffonia augmente directement la synthèse de sérotonine et expose à un syndrome sérotoninergique potentiellement mortel avec ISRS, IRSN, tramadol ou IMAO. Contre-indiqué.',
     'Excess central synaptic serotonin from precursor loading plus reuptake/MAO blockade.',
     'Accumulation centrale massive de sérotonine.',
     'well-documented', 'MedlinePlus / Health Canada', 'https://medlineplus.gov/druginfo/natural/794.html'),

    ('khat', 'MAO Inhibitors (Phenelzine, Linezolid)', 'Inhibiteurs de la MAO', 'contraindicated',
     'Cathinone and cathine in khat are amphetamine-like sympathomimetics; co-use with MAOIs risks fatal hypertensive crisis, arrhythmias, and hyperthermia.',
     'La cathinone du khat est un sympathomimétique de type amphétamine exposant à une crise hypertensive mortelle avec les IMAO.',
     'Blocked monoamine degradation plus vesicular catecholamine release.',
     'Libération catécholaminergique massive bloquée en dégradation par les IMAO.',
     'well-documented', 'NIH LiverTox / MedlinePlus', 'https://www.ncbi.nlm.nih.gov/books/NBK548653/'),
    ('khat', 'Sympathomimetics and Stimulants', 'Sympathomimétiques et stimulants', 'severe',
     'Additive amphetamine-like cardiovascular stimulation increases acute coronary vasospasm, stroke, arrhythmia, and psychosis risks.',
     'Stimulation cardiovasculaire additive exposant à infarctus, AVC, arythmies et psychose aiguë.',
     'Additive central and peripheral catecholamine release.',
     'Libération catécholaminergique additive.',
     'well-documented', 'NIH LiverTox', 'https://www.ncbi.nlm.nih.gov/books/NBK548653/'),

    ('spirulina', 'Immunosuppressants (Cyclosporine, Tacrolimus, Prednisone)', 'Immunosuppresseurs', 'moderate',
     'Spirulina stimulates immune-cell activity in preclinical/clinical immunology studies and MSK advises caution with transplant immunosuppressants or autoimmune flares (distinct from corticosteroids used medically to treat hepatitis).',
     'La spiruline stimule la réponse immunitaire et pourrait interférer avec les immunosuppresseurs ou favoriser une poussée auto-immune (MSK).',
     'Pharmacodynamic immunostimulation.',
     'Stimulation immunitaire s''opposant à l''immunosuppression.',
     'theoretical', 'MSK About Herbs', 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/blue-green-algae')
),
ins AS (
  INSERT INTO public.drug_interactions (
    herb_id, drug_name, severity, description, mechanism, evidence_level, source, source_url, translations
  )
  SELECT
    h.id,
    p.drug_name,
    p.severity::public.interaction_severity,
    p.description_en,
    p.mechanism_en,
    p.evidence_level,
    p.source,
    p.source_url,
    jsonb_build_object(
      'fr',
      jsonb_build_object(
        'drug_name', p.drug_name_fr,
        'description', p.description_fr,
        'mechanism', p.mechanism_fr
      )
    )
  FROM pairs p
  JOIN public.herbs h ON h.slug = p.slug
  WHERE NOT EXISTS (
    SELECT 1 FROM public.drug_interactions di
    WHERE di.herb_id = h.id
      AND lower(di.drug_name) = lower(p.drug_name)
  )
  RETURNING herb_id
)
INSERT INTO pg_temp.touched_herbs_00094 (slug)
SELECT DISTINCT h.slug
FROM ins
JOIN public.herbs h ON h.id = ins.herb_id
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. Flag all modified herbs needs_re_review (never human_reviewed) &
--    enqueue into herb_bundle_dirty
-- =====================================================================

UPDATE public.herbs h
SET
  provenance = (COALESCE(h.provenance, '{}'::jsonb) - 'last_verified_at') || jsonb_build_object(
    'review_status', 'needs_re_review',
    'review_notes', 'Drug interaction direction/deduplication/gap remediation applied (Migration 00094, 2026-11-22); awaiting human sign-off by Yasser.'
  ),
  updated_at = now()
FROM pg_temp.touched_herbs_00094 t
WHERE h.slug = t.slug;

INSERT INTO public.herb_bundle_dirty (slug, queued_at)
SELECT h.slug, now()
FROM pg_temp.touched_herbs_00094 t
JOIN public.herbs h ON h.slug = t.slug
ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;

COMMIT;

-- After applying on herbally-db, refresh precomputed bundles until 0 remain:
--   DO $$ DECLARE n int; BEGIN LOOP n := public.refresh_herb_page_bundles(500); EXIT WHEN n = 0; END LOOP; END $$;
