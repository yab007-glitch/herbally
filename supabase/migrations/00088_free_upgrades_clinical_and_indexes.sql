-- Migration 00088: Drop unused indexes, fill remaining zero-citation and
-- short-FR gaps, complete regulator-grounded clinical fields, and add curated
-- bilingual drug interactions for high-traffic clinical herbs.

BEGIN;

-- 1. Drop 2 unused indexes (0 scans, pure write overhead)
DROP INDEX IF EXISTS public.idx_herbs_provenance_method;
DROP INDEX IF EXISTS public.idx_herb_faqs_featured;

-- 2. Add verified PubMed citations to the 5 published herbs currently at 0 citations
UPDATE public.herbs
SET citations = $ct$[
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/33366424/",
    "pmid": "33366424",
    "year": 2019,
    "title": "The complete chloroplast genome of an endangered plant-Nomocharis aperta.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/25062885/",
    "pmid": "25062885",
    "year": 2014,
    "title": "Size-dependent gender modification in Lilium apertum (Liliaceae): does this species exhibit gender diphasy?",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/26219287/",
    "pmid": "26219287",
    "year": 2015,
    "title": "Morphological and ecological divergence of Lilium and Nomocharis within the Hengduan Mountains and Qinghai-Tibetan Plateau may result from habitat specialization and hybridization.",
    "source": "PubMed"
  }
]$ct$::jsonb,
    updated_at = now()
WHERE slug = 'nomocharis-aperta';

UPDATE public.herbs
SET citations = $ct$[
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/23495677/",
    "pmid": "23495677",
    "year": 2014,
    "title": "The effect of phosphatidylserine administration on memory and symptoms of attention-deficit hyperactivity disorder: a randomised, double-blind, placebo-controlled clinical trial.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/21103402/",
    "pmid": "21103402",
    "year": 2010,
    "title": "The effect of phosphatidylserine-containing omega-3 fatty acids on memory abilities in subjects with subjective memory complaints: a pilot study.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/11842880/",
    "pmid": "11842880",
    "year": 2001,
    "title": "The influence of soy-derived phosphatidylserine on cognition in age-associated memory impairment.",
    "source": "PubMed"
  }
]$ct$::jsonb,
    updated_at = now()
WHERE slug = 'phosphatidylserine-noot';

UPDATE public.herbs
SET citations = $ct$[
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/33537435/",
    "pmid": "33537435",
    "year": 2021,
    "title": "The complete chloroplast genome of Polygonatum cirrhifolium (Wall.) Royle, a medicine herb.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/28386511/",
    "pmid": "28386511",
    "year": 2017,
    "title": "Protective Effects of an Ancient Chinese Kidney-Tonifying Formula against H(2)O(2)-Induced Oxidative Damage to MES23.5 Cells.",
    "source": "PubMed"
  }
]$ct$::jsonb,
    updated_at = now()
WHERE slug = 'tibetan-solomon-seal';

UPDATE public.herbs
SET citations = $ct$[
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/21686920/",
    "pmid": "21686920",
    "year": 2009,
    "title": "Wild lettuce (Lactuca virosa) toxicity.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/37740775/",
    "pmid": "37740775",
    "year": 2023,
    "title": "Genome assembly and analysis of Lactuca virosa: implications for lettuce breeding.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/34381482/",
    "pmid": "34381482",
    "year": 2021,
    "title": "Sequence of the Mitochondrial Genome of Lactuca virosa Suggests an Unexpected Role in Lactuca sativa's Evolution.",
    "source": "PubMed"
  }
]$ct$::jsonb,
    updated_at = now()
WHERE slug = 'wild-lettuce';

UPDATE public.herbs
SET citations = $ct$[
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/26358682/",
    "pmid": "26358682",
    "year": 2016,
    "title": "The complete chloroplast genome of Eleutherococcus gracilistylus (W.W.Sm.) S.Y.Hu (Araliaceae).",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/38972441/",
    "pmid": "38972441",
    "year": 2024,
    "title": "Identification of lignans as selective cyclooxygenase-2 inhibitors from the extract of Acanthopanacis cortex.",
    "source": "PubMed"
  },
  {
    "url": "https://pubmed.ncbi.nlm.nih.gov/35910160/",
    "pmid": "35910160",
    "year": 2022,
    "title": "Identification and Quantification of Chlorogenic Acids from the Root Bark of Acanthopanax gracilistylus by UHPLC-Q-Exactive Orbitrap Mass Spectrometry.",
    "source": "PubMed"
  }
]$ct$::jsonb,
    updated_at = now()
WHERE slug = 'wu-jia-pi';

-- 3. Expand the 3 short French descriptions (<250 chars) to match their full English prose
UPDATE public.herbs
SET translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb($fr$Collinsonia canadensis (collinsonie du Canada) est une plante herbacée vivace atteignant deux à quatre pieds de hauteur, dotée d'une tige carrée et de grandes feuilles grossièrement dentées. Ses fleurs jaune verdâtre apparaissent de la fin de l'été au début de l'automne en grappes terminales. Elle était traditionnellement utilisée pour de nombreux troubles, notamment les affections gynécologiques, les hémorroïdes, les troubles urinaires et gastro-intestinaux, ainsi qu'en cataplasme externe sur les brûlures, ecchymoses, plaies, ulcères et entorses.$fr$::text),
      true
    ),
    updated_at = now()
WHERE slug = 'collinsonia-canadensis-herb';

UPDATE public.herbs
SET translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb($fr$Guaiacum officinale (gaïac officinal) produit une résine cassante et vitreuse, brun verdâtre à l'extérieur et brun rougeâtre à l'intérieur, d'odeur légère et agréable et de saveur âcre et réchauffante. Elle était traditionnellement employée contre les rhumatismes chroniques, la goutte, la syphilis secondaire, la scrofule et les éruptions cutanées, bien que son efficacité fût jugée incertaine. Cette résine était également classée comme stimulant et altérant, réputée favoriser la sudation avec des boissons chaudes.$fr$::text),
      true
    ),
    updated_at = now()
WHERE slug = 'guayacan';

UPDATE public.herbs
SET translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb($fr$Stillingia sylvatica (racine de stillingia) est une plante vivace originaire d'Amérique du Nord, aux tiges herbacées de deux à trois pieds. Ses feuilles sont alternes, sessiles, oblongues ou lancéolées à bord finement denté, tandis que les fleurs jaunes mâles et femelles poussent séparément sur un même épi. Sa racine épaisse et ligneuse, brun rougeâtre à l'extérieur et à écorce spongieuse, possède une saveur amère et âcre. Elle était traditionnellement utilisée pour les affections syphilitiques et scrofuleuses, bien que son utilité réelle fût jugée faible.$fr$::text),
      true
    ),
    updated_at = now()
WHERE slug = 'stillingia-root';

-- 4. Backfill route-specific oral safety flags from reviewed herb-level flags
-- Exclude topical oils and topical-only regulator entries such as rosmarinus-officinalis-l.
UPDATE public.herbs
SET pregnancy_safe_oral = COALESCE(pregnancy_safe_oral, pregnancy_safe),
    nursing_safe_oral   = COALESCE(nursing_safe_oral, nursing_safe),
    updated_at = now()
WHERE is_published = true
  AND pregnancy_safe IS NOT NULL
  AND pregnancy_safe_oral IS NULL
  AND slug <> 'rosmarinus-officinalis-l'
  AND slug NOT LIKE '%-oil'
  AND slug NOT LIKE '%-essential-oil%'
  AND name NOT ILIKE '%essential oil%'
  AND name NOT ILIKE '% oil'
  AND coalesce(dosage_adult, '') NOT ILIKE '%external use only%';

-- Authoritative regulator-monograph clinical backfills (Health Canada, NCCIH, EMA HMPC)
UPDATE public.herbs
SET side_effects = ARRAY['Nausea', 'Headache', 'Diarrhea and gastrointestinal symptoms', 'Rare liver injury (hepatotoxicity)'],
    dosage_adult = 'Adults 18 years and older: 2 to 3 g daily of extract standardized to 50–60% hydroxycitric acid (1.5 to 2 g per single dose) [Health Canada].',
    translations = jsonb_set(
      jsonb_set(
        coalesce(translations, '{}'::jsonb),
        '{fr,side_effects}',
        '["Nausées", "Maux de tête", "Diarrhée et troubles gastro-intestinaux", "Atteinte hépatique rare (hépatotoxicité)"]'::jsonb,
        true
      ),
      '{fr,dosage_adult}',
      to_jsonb('Adultes de 18 ans et plus : 2 à 3 g par jour d''extrait normalisé à 50–60 % d''acide hydroxycitrique (1,5 à 2 g par dose) [Santé Canada].'::text),
      true
    ),
    updated_at = now()
WHERE slug = 'garcinia-gummi-gutta';

UPDATE public.herbs
SET dosage_adult = 'Adults 18 years and older (topical use): 5–100% dried leaf extract decoction concentrate (equivalent to 50 mg crude dried leaves per mL); dried leaves prepared as a decoction before application [Health Canada].',
    pregnancy_safe_topical = false,
    nursing_safe_topical = false,
    translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,dosage_adult}',
      to_jsonb('Adultes de 18 ans et plus (usage topique) : concentré de décoction à 5–100 % d''extrait de feuilles séchées (équivalant à 50 mg de feuilles séchées par mL) ; feuilles préparées en décoction avant application [Santé Canada].'::text),
      true
    ),
    updated_at = now()
WHERE slug = 'rosmarinus-officinalis-l';

UPDATE public.herbs
SET dosage_adult = 'Adults 18 years and older: 600 to 1,200 mg of Quercetin per day, not to exceed 600 mg per single dose or 1,200 mg daily [Health Canada].',
    translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,dosage_adult}',
      to_jsonb('Adultes de 18 ans et plus : 600 à 1 200 mg de quercétine par jour, sans dépasser 600 mg par dose unique ni 1 200 mg par jour [Santé Canada].'::text),
      true
    ),
    updated_at = now()
WHERE slug = 'sophora-japonica-quercetin-phosphatidylcholine-complex';

-- EMA HMPC Rhamnus frangula monograph explicitly contraindicates pregnancy and lactation
UPDATE public.herbs
SET pregnancy_safe = false,
    pregnancy_safe_oral = false,
    nursing_safe = false,
    nursing_safe_oral = false,
    contraindications = ARRAY[
      'Hypersensitivity to buckthorn bark or hydroxyanthracene derivatives',
      'Intestinal obstruction, stenosis, bowel atony, appendicitis, or inflammatory bowel disease (Crohn disease, ulcerative colitis)',
      'Abdominal pain of unknown origin or severe dehydration with electrolyte depletion',
      'Pregnancy and breastfeeding (EMA HMPC contraindication due to genotoxic anthranoids and rhein transfer into breast milk)',
      'Children under 12 years of age; do not use longer than 1 week without medical supervision'
    ],
    translations = jsonb_set(
      coalesce(translations, '{}'::jsonb),
      '{fr,contraindications}',
      '[
        "Hypersensibilité à l''écorce de bourdaine ou aux dérivés hydroxyanthracéniques",
        "Obstruction ou sténose intestinale, atonie intestinale, appendicite ou maladie inflammatoire de l''intestin (maladie de Crohn, rectocolite hémorragique)",
        "Douleur abdominale d''origine inconnue ou déshydratation sévère avec déséquilibre électrolytique",
        "Grossesse et allaitement (contre-indication EMA HMPC en raison du risque génotoxique des anthranoïdes et du passage de la rhéine dans le lait maternel)",
        "Enfants de moins de 12 ans ; ne pas dépasser 1 semaine d''utilisation sans avis médical"
      ]'::jsonb,
      true
    ),
    updated_at = now()
WHERE slug = 'rhamnus-frangula';

-- 5. Add curated, bilingual, primary-source cited drug_interactions for 6 high-traffic herbs
INSERT INTO public.drug_interactions (
  herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations
)
SELECT
  h.id, v.drug_name, v.rxcui, v.severity::public.interaction_severity, v.description, v.mechanism, v.evidence_level, v.source, v.source_url, v.translations
FROM (
  VALUES
  -- chamomile-roman (Chamaemelum nobile)
  (
    'chamomile-roman',
    'Warfarin (Coumadin)',
    '11289',
    'moderate',
    'Roman chamomile contains coumarin-related and flavonoid constituents that may add to the anticoagulant effect of warfarin and increase bleeding risk. Monitor INR closely and avoid concentrated preparations unless supervised by a clinician.',
    'Additive antiplatelet and coumarin-derived anticoagulant potential, alongside possible inhibition of hepatic CYP enzymes involved in warfarin clearance.',
    'moderate-evidence',
    'NCCIH / EMA HMPC',
    'https://www.nccih.nih.gov/health/chamomile',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Warfarine (Coumadin)',
      'description', 'La camomille romaine contient des dérivés coumariniques et des flavonoïdes pouvant renforcer l''effet anticoagulant de la warfarine et augmenter le risque hémorragique. Surveillez l''INR et évitez les extraits concentrés sans avis médical.',
      'mechanism', 'Effet antiplaquettaire et anticoagulant additif potentiel lié aux coumarines et flavonoïdes, associé à une possible inhibition des enzymes hépatiques CYP.'
    ))
  ),
  (
    'chamomile-roman',
    'Aspirin',
    '1191',
    'moderate',
    'Concentrated Roman chamomile extracts may mildly inhibit platelet aggregation and add to aspirin''s antiplatelet effect, increasing the likelihood of bruising or bleeding.',
    'Flavonoid constituents may suppress platelet aggregation and thromboxane signaling, complementing aspirin''s irreversible COX-1 blockade.',
    'limited-evidence',
    'NCCIH / EMA HMPC',
    'https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-chamaemelum-nobile-l-all-flos_en.pdf',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Aspirine',
      'description', 'Les extraits concentrés de camomille romaine peuvent légèrement inhiber l''agrégation plaquettaire et s''ajouter à l''effet fluidifiant de l''aspirine, augmentant le risque d''ecchymoses ou de saignement.',
      'mechanism', 'Les flavonoïdes peuvent freiner l''agrégation plaquettaire et compléter l''inhibition irréversible de la COX-1 par l''aspirine.'
    ))
  ),
  (
    'chamomile-roman',
    'Sedatives and CNS depressants',
    NULL,
    'moderate',
    'Roman chamomile may have mild sedative properties and could enhance drowsiness or central nervous system depression when combined with benzodiazepines, sleep medications, or other CNS depressants.',
    'Flavonoid ligands such as apigenin and luteolin show affinity for central GABA-A / benzodiazepine binding sites, producing additive sedation.',
    'limited-evidence',
    'NCCIH / PubMed 2022',
    'https://pubmed.ncbi.nlm.nih.gov/36615326/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Sédatifs et dépresseurs du SNC',
      'description', 'La camomille romaine possède des propriétés apaisantes légères et peut accentuer la somnolence ou la dépression du système nerveux central avec les benzodiazépines, somnifères ou autres sédatifs.',
      'mechanism', 'Des flavonoïdes comme l''apigénine et la lutéoline interagissent avec les récepteurs centraux GABA-A / benzodiazépines, produisant une sédation additive.'
    ))
  ),
  (
    'chamomile-roman',
    'Cyclosporine',
    '3008',
    'moderate',
    'Chamomile preparations may alter hepatic and intestinal drug-metabolizing enzymes, potentially increasing blood concentrations and toxicity risk of cyclosporine. Consult a transplant specialist before use.',
    'Suspected inhibition of CYP3A4-mediated cyclosporine metabolism in the gut wall and liver.',
    'limited-evidence',
    'NCCIH',
    'https://www.nccih.nih.gov/health/chamomile',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Cyclosporine',
      'description', 'Les préparations de camomille peuvent modifier l''activité d''enzymes hépatiques et intestinales et augmenter les concentrations sanguines de cyclosporine ainsi que le risque d''effets indésirables. Demandez l''avis de l''équipe médicale.',
      'mechanism', 'Inhibition suspectée du métabolisme de la cyclosporine médié par le CYP3A4 intestinal et hépatique.'
    ))
  ),
  -- hawthorn-leaf-flower (Crataegus laevigata)
  (
    'hawthorn-leaf-flower',
    'Digoxin',
    '3407',
    'moderate',
    'Hawthorn leaf and flower may enhance the cardiac effects of digoxin and can interfere with serum digoxin immunoassays. Use together only under direct physician supervision with close clinical monitoring.',
    'Cardioactive flavonoids and oligomeric procyanidins exert positive inotropic effects and structural similarity may cross-react in laboratory digoxin assays.',
    'moderate-evidence',
    'Health Canada / PubMed — Arch Pathol Lab Med 2010',
    'https://pubmed.ncbi.nlm.nih.gov/20670141/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Digoxine',
      'description', 'Les feuilles et fleurs d''aubépine peuvent renforcer les effets cardiaques de la digoxine et interférer avec certains dosages sanguins de digoxine. Association uniquement sous surveillance médicale stricte.',
      'mechanism', 'Les flavonoïdes et procyanidines cardiotoniques exercent un effet inotrope positif additif et peuvent perturber certains immuno-essais de digoxine.'
    ))
  ),
  (
    'hawthorn-leaf-flower',
    'Beta-blockers (Metoprolol)',
    '221124',
    'moderate',
    'Combining hawthorn leaf and flower with beta-blockers such as metoprolol may produce additive blood pressure lowering and bradycardia, increasing dizziness or orthostatic hypotension.',
    'Procyanidin-mediated endothelium-dependent vasodilation and mild negative chronotropic activity add to beta-adrenergic blockade.',
    'moderate-evidence',
    'NCCIH / EMA HMPC',
    'https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-crataegus-spp-folium-cum-flore_en.pdf',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Bêtabloquants (Métoprolol)',
      'description', 'L''association des feuilles et fleurs d''aubépine avec un bêtabloquant comme le métoprolol peut provoquer une baisse additive de la tension artérielle ou de la fréquence cardiaque, favorisant étourdissements et hypotension.',
      'mechanism', 'La vasodilatation endothéliale et le léger effet chronotrope négatif des procyanidines s''additionnent au blocage bêta-adrénergique.'
    ))
  ),
  (
    'hawthorn-leaf-flower',
    'Antihypertensives',
    NULL,
    'moderate',
    'Hawthorn leaf and flower extracts exert modest vasodilatory and blood-pressure-lowering activity that can add to prescribed antihypertensive drugs, requiring blood pressure monitoring.',
    'Enhanced endothelial nitric oxide release and peripheral vasodilation mediated by oligomeric procyanidins and vitexin flavonoids.',
    'moderate-evidence',
    'NCCIH / PubMed — Systematic Review 2024',
    'https://pubmed.ncbi.nlm.nih.gov/38706368/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Antihypertenseurs',
      'description', 'Les extraits de feuilles et fleurs d''aubépine ont un effet vasodilatateur et hypotenseur modéré susceptible de s''ajouter à celui des médicaments antihypertenseurs, justifiant un suivi tensionnel.',
      'mechanism', 'Stimulation du monoxyde d''azote endothélial et vasodilatation périphérique par les procyanidines oligomères et flavonoïdes de type vitexine.'
    ))
  ),
  (
    'hawthorn-leaf-flower',
    'Phosphodiesterase-5 inhibitors (Sildenafil)',
    '136411',
    'moderate',
    'Co-administration of hawthorn leaf and flower with PDE5 inhibitors such as sildenafil or tadalafil may cause excessive vasodilation and symptomatic hypotension.',
    'Additive cGMP-mediated vascular smooth muscle relaxation from nitric-oxide-stimulating procyanidins and PDE5 inhibition.',
    'limited-evidence',
    'NCCIH',
    'https://www.nccih.nih.gov/health/hawthorn',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Inhibiteurs de la PDE5 (Sildénafil)',
      'description', 'La prise conjointe de feuilles et fleurs d''aubépine avec un inhibiteur de la PDE5 comme le sildénafil peut majorer la vasodilatation et exposer à une hypotension symptomatique.',
      'mechanism', 'Relaxation vasculaire additive médiée par le GMPc entre la stimulation du monoxyde d''azote par l''aubépine et l''inhibition de la PDE5.'
    ))
  ),
  -- curcumin (Curcuma longa concentrated extracts)
  (
    'curcumin',
    'Warfarin (Coumadin)',
    '11289',
    'severe',
    'Bioavailability-enhanced curcumin extracts can potentiate warfarin''s anticoagulant effect and increase bleeding risk. Avoid combining or obtain close INR monitoring from your prescriber, and discontinue before surgery.',
    'Curcuminoids inhibit platelet aggregation and CYP2C9/CYP3A4 warfarin metabolism, while piperine-enhanced formulations further boost systemic curcumin and drug exposure.',
    'moderate-evidence',
    'NCCIH / PubMed — Pharm Biol 2021',
    'https://pubmed.ncbi.nlm.nih.gov/34062109/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Warfarine (Coumadin)',
      'description', 'Les extraits concentrés de curcumine à biodisponibilité améliorée peuvent renforcer l''effet anticoagulant de la warfarine et accroître le risque hémorragique. Association déconseillée sans suivi strict de l''INR ; arrêter avant toute chirurgie.',
      'mechanism', 'Les curcuminoïdes inhibent l''agrégation plaquettaire ainsi que les enzymes CYP2C9/CYP3A4 métabolisant la warfarine, effet amplifié par la pipérine.'
    ))
  ),
  (
    'curcumin',
    'Aspirin',
    '1191',
    'moderate',
    'Concentrated curcumin may enhance aspirin''s antiplatelet effect and prolong bleeding time. Watch for unusual bruising or bleeding and stop at least 2 weeks before surgical procedures.',
    'Additive suppression of platelet aggregation and thromboxane A2 synthesis alongside aspirin''s irreversible COX-1 inhibition.',
    'moderate-evidence',
    'NCCIH',
    'https://www.nccih.nih.gov/health/turmeric',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Aspirine',
      'description', 'La curcumine concentrée peut renforcer l''action antiplaquettaire de l''aspirine et allonger le temps de saignement. Surveillez l''apparition d''ecchymoses et interrompez la prise au moins 2 semaines avant une chirurgie.',
      'mechanism', 'Inhibition additive de l''agrégation plaquettaire et de la synthèse du thromboxane A2 en complément du blocage irréversible de la COX-1 par l''aspirine.'
    ))
  ),
  (
    'curcumin',
    'Clopidogrel (Plavix)',
    '236991',
    'moderate',
    'High-absorption curcumin extracts may add to clopidogrel''s antiplatelet effect and could alter hepatic prodrug activation, increasing bleeding risk or unpredictable response.',
    'Dual antiplatelet inhibition plus potential modulation of CYP enzymes (CYP3A4 / CYP2C19) and piperine-related bioavailability interactions.',
    'moderate-evidence',
    'NCCIH / EMA HMPC',
    'https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-curcuma-longa-l-rhizoma-revision-1_en.pdf',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Clopidogrel (Plavix)',
      'description', 'Les extraits de curcumine à haute absorption peuvent s''ajouter à l''effet antiplaquettaire du clopidogrel et modifier son activation hépatique, augmentant le risque hémorragique.',
      'mechanism', 'Double inhibition plaquettaire et modulation potentielle des isoenzymes CYP3A4 / CYP2C19 impliquées dans le métabolisme du clopidogrel.'
    ))
  ),
  (
    'curcumin',
    'Sulfasalazine',
    '9524',
    'moderate',
    'Curcumin has been shown in human pharmacokinetic studies to substantially increase blood levels of sulfasalazine, raising the risk of systemic adverse effects.',
    'Inhibition of intestinal ABCG2 (BCRP) and P-glycoprotein efflux transporters increases oral sulfasalazine absorption.',
    'well-documented',
    'NCCIH',
    'https://www.nccih.nih.gov/health/turmeric',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Sulfasalazine',
      'description', 'Des études pharmacocinétiques chez l''humain montrent que la curcumine augmente nettement les concentrations sanguines de sulfasalazine, ce qui peut majorer ses effets indésirables.',
      'mechanism', 'L''inhibition du transporteur d''efflux intestinal BCRP (ABCG2) et de la P-glycoprotéine accroît l''absorption systémique de la sulfasalazine.'
    ))
  ),
  (
    'curcumin',
    'Metformin (Glucophage)',
    '235743',
    'mild',
    'Curcumin supplementation may lower blood glucose levels and add to metformin''s hypoglycemic effect; monitor blood sugar closely to adjust therapy if needed.',
    'Improved insulin sensitivity and hepatic gluconeogenesis suppression via AMPK activation.',
    'moderate-evidence',
    'NCCIH',
    'https://www.nccih.nih.gov/health/turmeric',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Metformine (Glucophage)',
      'description', 'La supplémentation en curcumine peut abaisser la glycémie et s''ajouter à l''effet hypoglycémiant de la metformine ; une surveillance glycémique est recommandée.',
      'mechanism', 'Amélioration de la sensibilité à l''insuline et réduction de la néoglucogenèse hépatique via l''activation de l''AMPK.'
    ))
  ),
  (
    'curcumin',
    'Tacrolimus',
    '42316',
    'moderate',
    'Case reports indicate concentrated curcumin or turmeric products (especially with piperine) can raise blood tacrolimus levels and precipitate nephrotoxicity in transplant recipients.',
    'Inhibition of intestinal and hepatic CYP3A4 and P-glycoprotein reduces tacrolimus first-pass clearance.',
    'limited-evidence',
    'PubMed — Eur J Hosp Pharm 2023',
    'https://pubmed.ncbi.nlm.nih.gov/37586787/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Tacrolimus',
      'description', 'Des cas cliniques montrent que la curcumine concentrée (notamment associée à la pipérine) peut élever les taux sanguins de tacrolimus et provoquer une néphrotoxicité chez les patients greffés.',
      'mechanism', 'L''inhibition du CYP3A4 et de la P-glycoprotéine réduit l''élimination présystémique et hépatique du tacrolimus.'
    ))
  ),
  -- frankincense (Boswellia sacra)
  (
    'frankincense',
    'Warfarin (Coumadin)',
    '11289',
    'moderate',
    'Frankincense resin (Boswellia spp.) may inhibit warfarin metabolism and possess mild antiplatelet activity, potentially raising INR and bleeding risk.',
    'Boswellic acids inhibit CYP2C9 and CYP3A4 in vitro and may dampen platelet aggregation.',
    'moderate-evidence',
    'NCCIH / PubMed 2014',
    'https://pubmed.ncbi.nlm.nih.gov/25233607/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Warfarine (Coumadin)',
      'description', 'La résine d''encens (Boswellia spp.) peut freiner le métabolisme de la warfarine et exercer une légère activité antiplaquettaire, exposant à une hausse de l''INR et du risque de saignement.',
      'mechanism', 'Les acides boswelliques inhibent les isoenzymes CYP2C9 et CYP3A4 in vitro et peuvent réduire l''agrégation plaquettaire.'
    ))
  ),
  (
    'frankincense',
    'Ibuprofen and NSAIDs',
    NULL,
    'mild',
    'Frankincense provides complementary anti-inflammatory activity via 5-lipoxygenase inhibition when used alongside NSAIDs; monitor gastrointestinal tolerance and consult a clinician.',
    'Boswellic acids selectively inhibit 5-lipoxygenase while NSAIDs inhibit cyclooxygenase enzymes.',
    'moderate-evidence',
    'NCCIH',
    'https://www.nccih.nih.gov/health/boswellia',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Ibuprofène et AINS',
      'description', 'L''encens exerce une activité anti-inflammatoire complémentaire par inhibition de la 5-lipoxygénase en association avec les AINS ; surveillez la tolérance digestive avec un professionnel de santé.',
      'mechanism', 'Les acides boswelliques inhibent sélectivement la 5-lipoxygénase tandis que les AINS bloquent les cyclo-oxygénases.'
    ))
  ),
  -- saffron (Crocus sativus)
  (
    'saffron',
    'Antidepressants (SSRIs)',
    NULL,
    'moderate',
    'Standardized saffron extracts have clinically demonstrated serotonergic and mood-elevating activity; combining them with SSRIs or SNRIs can cause additive serotonergic side effects and warrants physician oversight.',
    'Crocin and safranal modulate monoamine reuptake (serotonin, dopamine, norepinephrine), potentially adding to selective serotonin reuptake inhibition.',
    'moderate-evidence',
    'PubMed — 2019 RCT & Systematic Reviews',
    'https://pubmed.ncbi.nlm.nih.gov/31669837/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Antidépresseurs (ISRS)',
      'description', 'Les extraits standardisés de safran possèdent une activité sérotoninergique démontrée ; leur association à des ISRS ou IRSN expose à des effets sérotoninergiques additifs et nécessite un avis médical.',
      'mechanism', 'La crocine et le safranal modulent la recapture des monoamines (sérotonine, dopamine, noradrénaline), s''additionnant au blocage sérotoninergique des ISRS.'
    ))
  ),
  (
    'saffron',
    'Antihypertensives',
    NULL,
    'mild',
    'Meta-analyses of randomized trials report modest blood pressure reductions with saffron supplementation; combining with antihypertensive medications may slightly enhance hypotensive effects.',
    'Crocin-induced endothelial nitric oxide enhancement and calcium channel modulation causing additive vasodilation.',
    'moderate-evidence',
    'PubMed — Systematic Review & Meta-Analysis 2021',
    'https://pubmed.ncbi.nlm.nih.gov/34444896/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Antihypertenseurs',
      'description', 'Les méta-analyses d''essais cliniques indiquent une baisse modérée de la tension artérielle sous safran ; l''association avec un antihypertenseur peut légèrement majorer l''effet hypotenseur.',
      'mechanism', 'La crocine favorise la production endothéliale de monoxyde d''azote et module les canaux calciques, entraînant une vasodilatation additive.'
    ))
  ),
  (
    'saffron',
    'Metformin (Glucophage)',
    '235743',
    'mild',
    'Systematic reviews indicate saffron lowers fasting blood glucose and HbA1c, which could enhance the blood-glucose-lowering action of metformin and related antidiabetic agents.',
    'Enhanced peripheral glucose uptake and antioxidant protection of pancreatic beta cells complementing metformin.',
    'moderate-evidence',
    'PubMed — GRADE Meta-Analysis 2025',
    'https://pubmed.ncbi.nlm.nih.gov/39818282/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Metformine (Glucophage)',
      'description', 'Les revues systématiques montrent que le safran diminue la glycémie à jeun et l''HbA1c, pouvant renforcer l''effet hypoglycémiant de la metformine et des antidiabétiques.',
      'mechanism', 'Augmentation de la captation périphérique du glucose et soutien des cellules bêta pancréatiques en complément de la metformine.'
    ))
  ),
  (
    'saffron',
    'Warfarin (Coumadin)',
    '11289',
    'moderate',
    'High-dose saffron supplements may inhibit platelet aggregation and modulate cytochrome P450 enzymes, potentially increasing bleeding risk when taken with warfarin.',
    'Antithrombotic platelet suppression from crocin/safranal and potential CYP enzyme modulation.',
    'limited-evidence',
    'PubMed — CYP450 & Antiplatelet Review 2025',
    'https://pubmed.ncbi.nlm.nih.gov/40167627/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Warfarine (Coumadin)',
      'description', 'Les compléments fortement dosés en safran peuvent freiner l''agrégation plaquettaire et moduler les enzymes CYP450, augmentant potentiellement le risque hémorragique sous warfarine.',
      'mechanism', 'Inhibition de l''activation plaquettaire par les caroténoïdes du safran et modulation potentielle du métabolisme hépatique CYP.'
    ))
  ),
  -- cayenne (Capsicum annuum)
  (
    'cayenne',
    'Lisinopril (ACE inhibitors)',
    '29046',
    'moderate',
    'Capsaicin from cayenne sensitizes airway cough receptors and can worsen dry cough triggered by ACE inhibitors such as lisinopril or enalapril, even with topical formulations if inhaled or transferred.',
    'ACE inhibitors accumulate bradykinin and substance P in the airways while capsaicin directly activates TRPV1 sensory C-fibers to release substance P.',
    'limited-evidence',
    'PubMed — Capsaicin Cough Sensitivity Review',
    'https://pubmed.ncbi.nlm.nih.gov/25468411/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Lisinopril (Inhibiteurs de l''ECA)',
      'description', 'La capsaïcine du poivre de Cayenne sensibilise les récepteurs de la toux et peut aggraver la toux sèche induite par les inhibiteurs de l''ECA tels que le lisinopril ou l''énalapril.',
      'mechanism', 'Les inhibiteurs de l''ECA augmentent la bradykinine et la substance P bronchiques tandis que la capsaïcine active les fibres sensorielles TRPV1 et majore le réflexe tussigène.'
    ))
  ),
  (
    'cayenne',
    'Warfarin (Coumadin)',
    '11289',
    'moderate',
    'Concentrated oral cayenne supplements contain capsaicinoids that may decrease platelet aggregation and enhance fibrinolysis, increasing bleeding risk when combined with warfarin.',
    'Capsaicin-mediated attenuation of platelet aggregation and altered arachidonic acid signaling alongside vitamin-K-antagonist anticoagulation.',
    'limited-evidence',
    'PubMed — Warfarin-Herb Interactions 2014',
    'https://pubmed.ncbi.nlm.nih.gov/25233607/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Warfarine (Coumadin)',
      'description', 'Les compléments oraux concentrés de poivre de Cayenne peuvent réduire l''agrégation plaquettaire et accroître le risque de saignement chez les personnes traitées par warfarine.',
      'mechanism', 'La capsaïcine diminue l''agrégation plaquettaire et la voie de l''acide arachidonique en synergie avec l''anticoagulation par antivitamine K.'
    ))
  ),
  (
    'cayenne',
    'Aspirin',
    '1191',
    'moderate',
    'Oral cayenne supplements may irritate the gastric mucosa and exert additive antiplatelet effects when taken with aspirin, increasing the risk of stomach irritation or bleeding.',
    'Additive antiplatelet activity combined with local gastrointestinal mucosal irritation.',
    'limited-evidence',
    'PubMed — Antiplatelet Natural Products 2017',
    'https://pubmed.ncbi.nlm.nih.gov/27881059/',
    jsonb_build_object('fr', jsonb_build_object(
      'drug_name', 'Aspirine',
      'description', 'Les compléments oraux de Cayenne peuvent irriter la muqueuse gastrique et ajouter un léger effet antiplaquettaire à celui de l''aspirine, augmentant le risque d''inconfort digestif ou de saignement.',
      'mechanism', 'Activité antiplaquettaire additive associée à une irritation locale de la muqueuse gastro-intestinale.'
    ))
  )
) AS v(herb_slug, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations)
JOIN public.herbs h ON h.slug = v.herb_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.drug_interactions di
  WHERE di.herb_id = h.id AND lower(di.drug_name) = lower(v.drug_name)
);

-- 6. Prune off-topic 16285 citation on thuja-plicata and restore missing title on melanthium-virginicum
UPDATE public.herbs
SET citations = (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(coalesce(citations, '[]'::jsonb)) AS elem
      WHERE elem->>'pmid' IS DISTINCT FROM '16285'
    ),
    updated_at = now()
WHERE slug = 'thuja-plicata'
  AND citations::text LIKE '%16285%';

UPDATE public.herbs
SET citations = '[{"url": "https://pubmed.ncbi.nlm.nih.gov/36512668/", "pmid": "36512668", "year": 2006, "title": "Appalachian bunchflower.", "source": "PubMed"}]'::jsonb,
    updated_at = now()
WHERE slug = 'melanthium-virginicum';

COMMIT;
