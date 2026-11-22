-- Migration 00089: Clinical safety, interaction grading/deduplication,
-- historical OCR/misplacement cleanup, and LNHPD noise remediation from the
-- Nov 22 live audit.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Lethal & toxic plant descriptions: lead with explicit toxicity warning
--    and frame any historical or pharmaceutical context as non-self-use.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.herbs
SET description = 'Poison hemlock (Conium maculatum) is a highly lethal plant containing piperidine alkaloids (coniine and gamma-coniceine) that cause ascending neuromuscular paralysis and fatal respiratory failure. Every part of the plant — especially seeds, roots, and fresh leaves — is poisonous, and there is no safe home, dietary, or external medicinal use. Historically, hemlock was used in ancient Greece as a judicial poison and studied in obsolete 19th-century pharmacy texts for pain, all of which are now recognized as unsafe.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('La grande ciguë (Conium maculatum) est une plante hautement mortelle contenant des alcaloïdes pipéridiniques (coniine et gamma-conicéine) provoquant une paralysie neuromusculaire ascendante et une défaillance respiratoire fatale. Toutes les parties — en particulier les graines, les racines et les feuilles — sont toxiques ; aucun usage médical domestique ou externe n''est sûr. Autrefois employée comme poison judiciaire en Grèce antique et étudiée dans d''anciens traités du XIXe siècle, elle est totalement proscrite pour l''automédication.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'conium-maculatum-herb';

UPDATE public.herbs
SET description = 'Atropa belladonna (deadly nightshade) is a highly poisonous Solanaceae plant containing potent tropane alkaloids (atropine, scopolamine, and hyoscyamine). All parts — especially its sweet dark berries and roots — can cause fatal anticholinergic poisoning, delirium, tachycardia, hyperthermia, and respiratory arrest; accidental berry ingestion in children is a medical emergency. Standardized belladonna alkaloids exist only in regulated prescription pharmaceutical preparations and must never be self-administered from raw plant material.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('La belladone (Atropa belladonna) est une plante hautement toxique de la famille des Solanacées contenant de puissants alcaloïdes tropaniques (atropine, scopolamine, hyoscyamine). Toutes les parties — en particulier les baies sucrées et les racines — peuvent provoquer un syndrome anticholinergique mortel avec délire, tachycardie et arrêt respiratoire. Seuls des alcaloïdes purifiés relèvent d''un usage pharmaceutique sur ordonnance ; la plante brute ne doit jamais être consommée en automédication.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'atropa-belladonna-herb';

UPDATE public.herbs
SET description = 'Purple foxglove (Digitalis purpurea) is a dangerously toxic plant containing concentrated cardiac glycosides (digitoxin and digoxin) with an extremely narrow therapeutic-to-lethal margin. Self-administration of foxglove leaves, teas, or homemade extracts can trigger fatal ventricular arrhythmias, hyperkalemia, and cardiac arrest. While standardized digoxin is a regulated prescription heart medication, the raw plant must never be used as a home remedy.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('La digitale pourpre (Digitalis purpurea) est une plante dangereusement toxique contenant des hétérosides cardiotoniques (digitoxine, digoxine) à marge thérapeutique extrêmement étroite. L''automédication par infusions ou extraits bruts peut déclencher des arythmies ventriculaires mortelles et un arrêt cardiaque. Bien que la digoxine purifiée soit un médicament prescrit sous surveillance médicale stricte, la plante ne doit jamais être utilisée comme remède maison.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'digitalis-purpurea-herb';

UPDATE public.herbs
SET description = 'Oleander (Nerium oleander) is an extremely poisonous ornamental shrub whose leaves, sap, flowers, seeds, and wood contain oleandrin and other lethal cardiac glycosides. Even small ingestions — or inhaling smoke from burning branches — can cause life-threatening heart block, hyperkalemia, and fatal ventricular arrhythmias. Do not ingest any part of the plant or use homemade preparations.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Le laurier-rose (Nerium oleander) est un arbuste extrêmement toxique dont les feuilles, la sève, les fleurs, les graines et le bois contiennent de l''oléandrine et d''autres hétérosides cardiotoniques mortels. Même une faible ingestion — ou l''inhalation de fumée lors du brûlage des branches — peut provoquer un bloc cardiaque et des arythmies ventriculaires fatales. Ne consommer aucune partie de cette plante.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'nerium-oleander';

UPDATE public.herbs
SET description = 'European mandrake (Mandragora officinarum) is a highly toxic Solanaceae plant containing anticholinergic tropane alkaloids (atropine, scopolamine, hyoscyamine, and mandragorine). Ingestion of root or fruit preparations causes severe delirium, hallucinations, blurred vision, hyperthermia, tachycardia, and potentially fatal respiratory depression. Historically used in ancient anesthesia and folklore, it is unsafe for self-medication.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('La mandragore officinale (Mandragora officinarum) est une plante hautement toxique de la famille des Solanacées riche en alcaloïdes tropaniques anticholinergiques (atropine, scopolamine, hyoscyamine). L''ingestion de racines ou de fruits provoque délire aigu, hallucinations, hyperthermie, tachycardie et dépression respiratoire potentiellement mortelle. Son usage relève uniquement de l''histoire médicale et est dangereux en automédication.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'mandragora-officinarum-herb';

UPDATE public.herbs
SET description = 'Water hemlock (Cicuta virosa) is one of the most lethally toxic plants known, containing cicutoxin — a violent convulsant neurotoxin concentrated in the chambered tuberous root. Ingestion of even tiny root fragments causes rapid-onset refractory seizures, metabolic acidosis, and fatal respiratory failure. There is no medicinal dose; never ingest or harvest.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('La ciguë vireuse (Cicuta virosa) compte parmi les plantes les plus mortelles connues ; elle contient de la cicutoxine, une neurotoxine convulsivante violente concentrée dans les racines. L''ingestion même minime déclenche rapidement des convulsions réfractaires et une défaillance respiratoire mortelle. Aucune dose médicinale n''existe.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'cicuta-virosa';

UPDATE public.herbs
SET description = 'Strychnos nux-vomica is a highly toxic tree whose seeds contain lethal concentrations of strychnine and brucine, potent glycine-receptor neurotoxins that induce violent muscular spasms, asphyxia, and cardiac arrest. Unprocessed seeds are potentially fatal; only regulated pharmaceutical or rigorously detoxified practitioner preparations exist in historical and specialized pharmacopoeias, never for self-use.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Strychnos nux-vomica (noix vomique) est un arbre hautement toxique dont les graines renferment de la strychnine et de la brucine, des neurotoxines convulsivantes mortelles provoquant spasmes tétaniques, asphyxie et arrêt cardiaque. Les graines non traitées peuvent être fatales ; ne jamais consommer en automédication.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'strychnos-nux-vomica';

UPDATE public.herbs
SET description = 'English yew (Taxus baccata) is a lethally cardiotoxic conifer whose needles, bark, and dark seeds contain taxine alkaloids capable of causing abrupt, refractory ventricular arrhythmias and sudden death. Only the bright red fleshy aril lacks taxines, while the seed inside remains fatal if chewed. Modern anticancer taxanes are synthetic/semi-synthetic prescription drugs, never crude yew extracts.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('L''if commun (Taxus baccata) est un conifère mortellement cardiotoxique dont les aiguilles, l''écorce et les graines contiennent des alcaloïdes taxines pouvant provoquer des arythmies ventriculaires fatales et une mort subite. Seuls des dérivés chimiothérapeutiques pharmaceutiques sur ordonnance sont utilisés en oncologie ; la plante brute ne doit jamais être ingérée.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'taxus-baccata';

UPDATE public.herbs
SET description = 'Autumn crocus (Colchicum autumnale) is a highly toxic plant containing colchicine throughout its corm, seeds, and flowers. Colchicine poisoning carries a narrow margin before causing severe bloody gastroenteritis, bone-marrow aplasia, ascending neuropathy, and fatal multiorgan failure. Only standardized prescription colchicine tablets are medically prescribed; crude plant extracts are unsafe.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Le colchique d''automne (Colchicum autumnale) est une plante hautement toxique contenant de la colchicine dans le bulbe, les graines et les fleurs. L''intoxication provoque gastro-entérite sévère, aplasie médullaire et défaillance multiviscérale potentiellement mortelle. Seule la colchicine pharmaceutique sur ordonnance est utilisée en clinique ; les préparations de plante brute sont proscrites.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'colchicum-autumnale-herb';

UPDATE public.herbs
SET description = 'Castor bean (Ricinus communis) contains ricin, a lethally potent ribosome-inactivating toxalbumin concentrated in the seeds; chewing even small quantities of whole seeds can cause fatal gastrointestinal hemorrhage, shock, and organ failure. Refined USP castor oil removes water-soluble ricin during processing and is the only form ever used externally or short-term under product label directions; raw seeds and home seed extracts must never be ingested.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('Le ricin (Ricinus communis) renferme dans ses graines de la ricine, une toxalbumine extrêmement mortelle ; mâcher ne serait-ce que quelques graines crues peut causer une défaillance multiviscérale fatale. Seule l''huile de ricin raffinée (exempte de ricine hydrosoluble lors de l''extraction industrielle) fait l''objet d''usages encadrés ; les graines crues et extraits bruts ne doivent jamais être ingérés.'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'ricinus-communis';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Collinsonia dose & FAQ honesty (no Health Canada/PubMed clinical attribution)
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.herbs
SET dosage_adult = 'No modern standardized clinical dose is established; Health Canada LNHPD lists homeopathic or topical preparations only (historical 19th-century Eclectic texts cited 2–4 g dried root).',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,dosage_adult}',
      to_jsonb('Aucune posologie clinique moderne standardisée n''est établie ; les licences LNHPD de Santé Canada portent uniquement sur des préparations homéopathiques ou topiques (d''anciens traités éclectiques du XIXe siècle citaient 2–4 g de racine séchée).'::text)
    ),
    updated_at = now(),
    provenance = jsonb_set(COALESCE(provenance, '{}'::jsonb), '{last_verified_at}', to_jsonb(now()))
WHERE slug = 'collinsonia-canadensis-herb';

UPDATE public.herb_faqs
SET answer = 'No modern standardized therapeutic dose is established. Health Canada LNHPD records for this plant cover ultra-diluted homeopathic remedies and a topical cream rather than oral herbal root extracts, and modern clinical trials are lacking. Historical 19th-century Eclectic texts cited 2–4 g of dried root or 2–4 mL tincture, which is not verified for modern self-dosing. Avoid in pregnancy and severe liver disease.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,answer}',
      to_jsonb('Aucune posologie thérapeutique moderne standardisée n''est établie. Les dossiers de Santé Canada (LNHPD) ne recensent que des dilutions homéopathiques et une crème topique, sans essai clinique moderne validé ; le chiffre historique de 2–4 g provient d''ouvrages du XIXe siècle et ne constitue pas une dose moderne recommandée. Éviter pendant la grossesse et en cas de maladie hépatique grave.'::text)
    )
WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'collinsonia-canadensis-herb')
  AND sort_order = 1;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Ginger & Ginkgo Warfarin Severity Alignment + Aloe & Senna Deduplication
-- ───────────────────────────────────────────────────────────────────────────

-- Upgrade ginger + Warfarin (Coumadin) from mild -> severe (consistent with turmeric & above aspirin moderate)
UPDATE public.drug_interactions
SET severity = 'severe',
    evidence_level = 'moderate-evidence',
    description = 'Concentrated ginger supplements inhibit platelet aggregation and thromboxane synthesis and have been linked in clinical case reports to elevated INR and bleeding events in patients stabilized on warfarin. Although a small short-term healthy-volunteer trial at standard doses showed minimal PK/PD shift, warfarin has a narrow therapeutic window: avoid high-dose ginger supplements or monitor INR closely with your prescriber.',
    mechanism = 'Gingerols and shogaols inhibit platelet thromboxane A2 synthesis and aggregation, creating additive hemorrhagic risk alongside warfarin vitamin-K antagonism.',
    source = 'PubMed — Br J Clin Pharmacol 2005 / Systematic Review 2021',
    source_url = 'https://pubmed.ncbi.nlm.nih.gov/32478963/',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Warfarine (Coumadin)',
        'description', 'Les compléments concentrés de gingembre inhibent l''agrégation plaquettaire et ont été associés dans des rapports cliniques à une élévation de l''INR et à des saignements sous warfarine. Bien qu''un essai bref chez le sujet sain à dose modérée n''ait pas montré de variation majeure, la marge thérapeutique étroite de la warfarine impose d''éviter les fortes doses ou de surveiller étroitement l''INR.',
        'mechanism', 'Les gingérols et shogaols inhibent la synthèse du thromboxane A2 et l''agrégation plaquettaire, ajoutant un risque hémorragique à l''action anticoagulante de la warfarine.'
      )
    )
WHERE id = 'cedd5549-437f-4a7e-b0b0-06ed063176da';

-- Upgrade ginkgo-biloba + Warfarin (Coumadin) from mild -> severe for uniform warfarin grading
UPDATE public.drug_interactions
SET severity = 'severe',
    description = 'Ginkgo biloba leaf extract inhibits platelet-activating factor (PAF) and may potentiate bleeding risk when taken alongside warfarin, including rare reports of serious hemorrhage. Monitor INR closely and confirm with your prescribing clinician before combining.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb('L''extrait de ginkgo biloba inhibe le facteur d''activation plaquettaire (PAF) et peut accroître le risque hémorragique sous warfarine, avec des cas rapportés de saignements graves. Une surveillance étroite de l''INR et un avis médical sont indispensables.'::text)
    )
WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'ginkgo-biloba')
  AND drug_name = 'Warfarin (Coumadin)';

-- Remove duplicate Aloe Vera Diuretics (Thiazide) moderate row and clarify Hydrochlorothiazide (HCTZ) severe row
DELETE FROM public.drug_interactions
WHERE id = '9638fc47-c16d-4096-8eb5-cbe8b5233ffa';

UPDATE public.drug_interactions
SET severity = 'severe',
    description = 'Concomitant oral ingestion of anthraquinone-containing aloe latex with hydrochlorothiazide or other thiazide diuretics causes synergistic renal and intestinal potassium wasting, risking acute hypokalemia and cardiac arrhythmias. (This applies to stimulant aloe latex laxatives rather than clear topical inner-leaf gel.)',
    mechanism = 'Thiazide-induced renal K+ excretion compounds anthraquinone-driven colonic potassium loss and secondary hyperaldosteronism.',
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr}',
      jsonb_build_object(
        'drug_name', 'Hydrochlorothiazide et diurétiques thiazidiques (HCTZ)',
        'description', 'L''ingestion orale de latex d''aloès (laxatif stimulant à anthraquinones) avec l''hydrochlorothiazide ou un autre diurétique thiazidique entraîne une perte synergique de potassium, exposant à une hypokaliémie aiguë et à des troubles du rythme cardiaque.',
        'mechanism', 'La fuite rénale de potassium induite par les thiazidiques s''ajoute à la perte intestinale de potassium causée par les anthraquinones du latex d''aloès.'
      )
    )
WHERE id = 'eece19d8-7f05-46fb-8bbb-26cf732c8dcd';

-- Remove duplicate senna-leaf Corticosteroids (Prednisone) row in favor of existing curated Prednisone (Oral corticosteroids)
DELETE FROM public.drug_interactions
WHERE id = '98643fdc-5461-483d-9647-96c4a2a80abd';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Clean ALL remaining Health Canada pasted boilerplate descriptions (33 rows)
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.drug_interactions
SET description = CASE drug_name
      WHEN 'Corticosteroids (Prednisone)' THEN
        'Combining anthraquinone stimulant laxatives (such as oral aloe latex or cascara) with systemic corticosteroids compounds potassium loss and increases the risk of hypokalemia and electrolyte imbalance. Consult a clinician before concurrent oral use.'
      WHEN 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)' THEN
        'Concurrent use may alter platelet aggregation or anticoagulant response and elevate bleeding risk. Clinical monitoring (including INR checks when taking warfarin) and medical supervision are recommended before combining.'
      WHEN 'Digoxin' THEN
        'Co-administration with herbal products that affect cardiac rhythm, P-glycoprotein transport, or electrolyte balance may alter digoxin serum levels or sensitivity to digoxin toxicity. Confirm with your prescribing cardiologist or pharmacist before combining.'
      WHEN 'Levothyroxine (Synthroid)' THEN
        CASE
          WHEN herb_id = (SELECT id FROM public.herbs WHERE slug = 'ephedra-sinica') THEN
            'Ephedra alkaloids exert strong sympathomimetic stimulation that can compound thyroid hormone cardiac effects, increasing the risk of tachycardia, hypertension, arrhythmias, and nervousness alongside levothyroxine. Avoid combining.'
          ELSE
            'Compounds in horseradish (glucosinolate/isothiocyanate constituents) may influence thyroid function or iodine handling in susceptible individuals. Separate timing from levothyroxine and monitor thyroid function tests if advised by your clinician.'
        END
      WHEN 'Immunosuppressants' THEN
        'Immune-modulating botanical or colostrum supplements may theoretically counteract immunosuppressive medications or unpredictably alter immune activity in transplant or autoimmune therapy. Consult your specialist before use.'
      WHEN 'Antihypertensives' THEN
        'Coenzyme Q10 may modestly lower blood pressure and add to the hypotensive effect of antihypertensive medications, increasing the risk of dizziness or low blood pressure. Monitor blood pressure when starting or adjusting.'
      WHEN 'Hormone replacement therapy' THEN
        'Constituents with phytoestrogenic, selective estrogen-receptor, or CYP-modulating activity may alter hormone balance or compete with exogenous estrogen/progestin hormone replacement therapy. Review with your prescriber before combining.'
      WHEN 'Oral Contraceptives' THEN
        'Constituents with endocrine, phytoestrogenic, or CYP hepatic enzyme effects could theoretically alter estrogen/progestin activity or breakthrough bleeding risk alongside combined oral contraceptives. Consult a pharmacist or prescriber.'
      WHEN 'Antidepressants (SSRIs)' THEN
        CASE
          WHEN herb_id = (SELECT id FROM public.herbs WHERE slug = 'griffonia-simplicifolia') THEN
            '5-HTP from Griffonia simplicifolia directly increases central serotonin synthesis and, when combined with SSRIs or SNRIs, creates a serious risk of serotonin syndrome (agitation, tremor, hyperthermia, tachycardia). Do not combine.'
          ELSE
            'Ginseng constituents may modulate monoamine neurotransmission or cause additive CNS stimulation alongside serotonergic antidepressants, risking agitation, insomnia, or mood shifts. Consult your prescribing clinician first.'
        END
      ELSE description
    END,
    translations = jsonb_set(
      COALESCE(translations, '{}'::jsonb),
      '{fr,description}',
      to_jsonb(CASE drug_name
        WHEN 'Corticosteroids (Prednisone)' THEN
          'L''association de laxatifs stimulants à anthraquinones (latex d''aloès oral ou cascara) avec des corticostéroïdes systémiques cumule la fuite potassique et accroît le risque d''hypokaliémie et de déséquilibre électrolytique. Demandez un avis médical avant toute prise orale concomitante.'
        WHEN 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)' THEN
          'L''utilisation concomitante peut modifier l''agrégation plaquettaire ou l''effet anticoagulant et augmenter le risque hémorragique. Un suivi médical (y compris la surveillance de l''INR sous warfarine) est recommandé avant l''association.'
        WHEN 'Digoxin' THEN
          'L''association avec des produits susceptibles d''influencer le rythme cardiaque, le transport par la glycoprotéine P ou l''équilibre électrolytique peut modifier la digoxinémie ou la toxicité cardiaque. Confirmez auprès d''un médecin ou d''un pharmacien avant utilisation.'
        WHEN 'Levothyroxine (Synthroid)' THEN
          CASE
            WHEN herb_id = (SELECT id FROM public.herbs WHERE slug = 'ephedra-sinica') THEN
              'Les alcaloïdes de l''éphédra exercent une forte stimulation sympathomimétique susceptible d''aggraver les effets cardiaques des hormones thyroïdiennes (tachycardie, hypertension, arythmies) avec la lévothyroxine. Association à éviter.'
            ELSE
              'Les composés du raifort (glucosinolates) peuvent interférer avec la fonction thyroïdienne chez certaines personnes. Espacez la prise de la lévothyroxine et faites suivre le bilan thyroïdien si nécessaire.'
          END
        WHEN 'Immunosuppressants' THEN
          'Les préparations immunomodulatrices (échinacée, colostrum) peuvent théoriquement contrer l''effet des médicaments immunosuppresseurs chez les patients greffés ou suivis pour une maladie auto-immune. Demandez l''avis de votre spécialiste avant toute prise.'
        WHEN 'Antihypertensives' THEN
          'La coenzyme Q10 peut abaisser légèrement la tension artérielle et s''ajouter à l''effet des antihypertenseurs, augmentant le risque d''hypotension ou d''étourdissements. Surveillez votre tension lors de l''association.'
        WHEN 'Hormone replacement therapy' THEN
          'Des composés à activité phytoœstrogénique ou modulant les enzymes hépatiques peuvent modifier l''équilibre hormonal ou interagir avec une hormonothérapie substitutive. Consultez votre médecin avant toute association.'
        WHEN 'Oral Contraceptives' THEN
          'Des composés à activité endocrinienne, phytoœstrogénique ou enzymatique hépatique pourraient théoriquement modifier l''activité des contraceptifs oraux œstroprogestatifs. Vérifiez auprès d''un pharmacien ou d''un médecin.'
        WHEN 'Antidepressants (SSRIs)' THEN
          CASE
            WHEN herb_id = (SELECT id FROM public.herbs WHERE slug = 'griffonia-simplicifolia') THEN
              'Le 5-HTP issu de Griffonia simplicifolia augmente directement la synthèse centrale de sérotonine et expose à un risque grave de syndrome sérotoninergique avec les ISRS/IRSN (agitation, tremblements, hyperthermie). Ne pas associer.'
            ELSE
              'Les constituants du ginseng peuvent moduler la neurotransmission monoaminergique ou provoquer une stimulation nerveuse additive avec les antidépresseurs sérotoninergiques (insomnie, agitation). Consultez votre prescripteur au préalable.'
          END
        ELSE COALESCE(translations->'fr'->>'description', description)
      END::text)
    )
WHERE description ILIKE '%health care practitioner/health care provider%'
   OR description ILIKE '%doctor/physician%';

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Add curated bilingual cited drug_interactions for lethal & audited herbs
--    plus nerium-oleander, aconite-processed, mandragora-officinarum-herb
-- ───────────────────────────────────────────────────────────────────────────

WITH pairs(slug, drug_name, drug_name_fr, severity, description_en, description_fr, mechanism_en, mechanism_fr, evidence_level, source, source_url) AS (
  VALUES
    -- Atropa belladonna
    ('atropa-belladonna-herb', 'Anticholinergics (Oxybutynin, Benztropine)', 'Anticholinergiques (Oxybutynine, Benztropine)', 'contraindicated',
     'Belladonna contains potent tropane alkaloids (atropine, scopolamine) that produce severe additive anticholinergic toxicity alongside prescription anticholinergic medications — risking acute delirium, urinary retention, hyperthermia, and cardiac arrhythmia.',
     'La belladone contient de puissants alcaloïdes tropaniques (atropine, scopolamine) provoquant une toxicité anticholinergique additive grave avec les anticholinergiques sur ordonnance (délire aigu, rétention urinaire, hyperthermie, arythmies).',
     'Additive competitive muscarinic acetylcholine receptor antagonism across central and peripheral nervous systems.',
     'Antagonisme muscarinique compétitif additif sur le système nerveux central et périphérique.',
     'well-documented', 'PubMed — Tropane Alkaloids Review', 'https://pubmed.ncbi.nlm.nih.gov/36109439/'),
    ('atropa-belladonna-herb', 'Tricyclic Antidepressants (Amitriptyline)', 'Antidépresseurs tricycliques (Amitriptyline)', 'severe',
     'Combining belladonna alkaloids with tricyclic antidepressants causes dangerous additive muscarinic blockade, markedly increasing risks of tachycardia, paralytic ileus, blurred vision, and anticholinergic CNS toxicity.',
     'L''association avec des antidépresseurs tricycliques additionne le blocage muscarinique, augmentant nettement les risques de tachycardie, d''iléus paralytique et de toxicité anticholinergique centrale.',
     'Combined antimuscarinic receptor blockade by belladonna alkaloids and tricyclic antidepressants.',
     'Blocage antimuscarinique combiné des alcaloïdes de belladone et des antidépresseurs tricycliques.',
     'well-documented', 'PubMed — Anticholinergic & TCA Pharmacology', 'https://pubmed.ncbi.nlm.nih.gov/2657292/'),
    ('atropa-belladonna-herb', 'Antihistamines (Diphenhydramine)', 'Antihistaminiques sédatifs (Diphénhydramine)', 'severe',
     'First-generation antihistamines share strong anticholinergic properties; taking them with belladonna risks synergistic drying, confusion, urinary retention, and dangerous CNS or cardiac toxicity.',
     'Les antihistaminiques de première génération possèdent de forts effets anticholinergiques ; leur association à la belladone expose à une confusion aiguë, une rétention urinaire et une toxicité cardiaque.',
     'Additive peripheral and central H1/muscarinic M1–M3 receptor blockade.',
     'Blocage additif des récepteurs muscariniques centraux et périphériques.',
     'moderate-evidence', 'NIH / PubMed — Belladonna Monograph', 'https://pubmed.ncbi.nlm.nih.gov/30000920/'),
    ('atropa-belladonna-herb', 'Cholinesterase Inhibitors (Donepezil)', 'Inhibiteurs de la cholinestérase (Donépézil)', 'severe',
     'Belladonna directly antagonizes cholinesterase inhibitors such as donepezil, rivastigmine, and galantamine, eliminating cognitive benefit and precipitating acute confusion in patients treated for dementia.',
     'La belladone antagonise directement l''action des inhibiteurs de l''acétylcholinestérase (donépézil, rivastigmine), annulant leur efficacité et pouvant déclencher une confusion aiguë.',
     'Muscarinic antagonism opposes elevated synaptic acetylcholine produced by cholinesterase inhibition.',
     'L''antagonisme muscarinique s''oppose à l''augmentation d''acétylcholine synaptique recherchée.',
     'well-documented', 'PubMed — Antimuscarinic Pharmacology', 'https://pubmed.ncbi.nlm.nih.gov/2657292/'),

    -- Digitalis purpurea
    ('digitalis-purpurea-herb', 'Digoxin', 'Digoxine', 'contraindicated',
     'Purple foxglove contains digitoxin and digoxin-like cardiac glycosides; combining any foxglove preparation with prescription digoxin causes direct additive cardiac glycoside overdose, hyperkalemia, and fatal ventricular arrhythmias.',
     'La digitale pourpre contient de la digitoxine et des hétérosides cardiotoniques ; l''associer à la digoxine prescrite expose à un surdosage additif mortel (hyperkaliémie, blocs auriculo-ventriculaires, arythmies ventriculaires).',
     'Additive inhibition of myocardial Na+/K+-ATPase raising intracellular calcium and automaticity.',
     'Inhibition additive de la pompe Na+/K+-ATPase myocardique augmentant l''automaticité ectopique.',
     'well-documented', 'PubMed / StatPearls — Cardiac Glycosides', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('digitalis-purpurea-herb', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques (Furosémide, Hydrochlorothiazide)', 'severe',
     'Potassium-wasting loop and thiazide diuretics deplete serum potassium and magnesium, dramatically sensitizing the myocardium to digitalis toxicity and fatal cardiac arrhythmias even at low glycoside exposure.',
     'Les diurétiques de l''anse et thiazidiques abaissent le potassium et le magnésium sanguins, sensibilisant fortement le cœur à la toxicité mortelle des glycosides de digitale.',
     'Hypokalemia and hypomagnesemia enhance glycoside binding to myocardial Na+/K+-ATPase.',
     'L''hypokaliémie et l''hypomagnésémie facilitent la liaison toxique des digitaliques à la Na+/K+-ATPase.',
     'well-documented', 'PubMed / StatPearls — Cardiac Glycosides', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('digitalis-purpurea-herb', 'Beta-Blockers (Metoprolol)', 'Bêta-bloquants (Métoprolol)', 'severe',
     'Concurrent exposure to foxglove cardiac glycosides and beta-blockers produces additive slowing of AV node conduction, risking profound bradycardia, high-grade heart block, and syncope.',
     'L''exposition conjointe aux glycosides cardiotoniques et aux bêta-bloquants ralentit fortement la conduction auriculo-ventriculaire, avec risque de bradycardie sévère et de bloc cardiaque.',
     'Additive vagomimetic / AV-nodal conduction delay alongside beta-adrenergic blockade.',
     'Ralentissement additif de la conduction auriculo-ventriculaire.',
     'well-documented', 'PubMed / StatPearls — Antiarrhythmic & Glycoside Interactions', 'https://pubmed.ncbi.nlm.nih.gov/31643939/'),
    ('digitalis-purpurea-herb', 'Calcium Channel Blockers (Verapamil)', 'Inhibiteurs calciques (Vérapamil)', 'severe',
     'Verapamil and diltiazem reduce renal/P-glycoprotein clearance of digitalis glycosides and add AV-nodal depression, raising plasma glycoside toxicity and heart-block risk.',
     'Le vérapamil et le diltiazem réduisent l''élimination des glycosides digitaliques et freinent la conduction AV, majorant le risque d''intoxication cardiaque grave.',
     'P-glycoprotein inhibition increases circulating glycosides alongside synergistic AV nodal depression.',
     'Inhibition de la glycoprotéine P et dépression additive du nœud auriculo-ventriculaire.',
     'well-documented', 'PubMed / StatPearls — Cardiac Glycosides', 'https://pubmed.ncbi.nlm.nih.gov/31643737/'),
    ('digitalis-purpurea-herb', 'Corticosteroids (Prednisone)', 'Corticostéroïdes (Prednisone)', 'severe',
     'Systemic corticosteroids promote renal potassium loss; combined with foxglove cardiac glycosides, hypokalemia sharply raises the risk of digitalis arrhythmia and toxicity.',
     'Les corticostéroïdes systémiques favorisent la perte rénale de potassium ; associés aux hétérosides de digitale, ils augmentent fortement le risque d''arythmie digitalique.',
     'Mineralocorticoid-mediated potassium depletion potentiates Na+/K+-ATPase inhibition by cardiac glycosides.',
     'La déplétion potassique potentialise la toxicité myocardique des hétérosides cardiotoniques.',
     'well-documented', 'PubMed — Digitalis Toxicity Interactions', 'https://pubmed.ncbi.nlm.nih.gov/10069797/'),

    -- Conium maculatum (Poison Hemlock)
    ('conium-maculatum-herb', 'Neuromuscular Blocking Agents (Succinylcholine, Rocuronium)', 'Curares / Bloquants neuromusculaires (Succinylcholine, Rocuronium)', 'contraindicated',
     'Coniine in poison hemlock acts as a curare-like nicotinic acetylcholine antagonist at the neuromuscular junction; co-exposure with surgical neuromuscular blockers causes catastrophic prolonged respiratory paralysis.',
     'La coniine de la grande ciguë bloque les récepteurs nicotiniques de la jonction neuromusculaire comme un curare ; toute exposition conjointe provoque une paralysie respiratoire prolongée et mortelle.',
     'Synergistic presynaptic and postsynaptic blockade of nicotinic acetylcholine receptors at the motor end plate.',
     'Blocage nicotinique synaptique additif à la jonction neuromusculaire.',
     'well-documented', 'PubMed — Conium Intoxication & Coniine Review', 'https://pubmed.ncbi.nlm.nih.gov/30594904/'),
    ('conium-maculatum-herb', 'CNS Depressants (Benzodiazepines, Opioids)', 'Dépresseurs du SNC (Benzodiazépines, Opioïdes)', 'contraindicated',
     'Poison hemlock induces ascending skeletal-muscle and diaphragmatic paralysis; adding opioids, benzodiazepines, or sedatives accelerates hypoventilation and fatal respiratory arrest.',
     'La grande ciguë entraîne une paralysie musculaire et diaphragmatique ascendante ; l''ajout d''opioïdes, de benzodiazépines ou de sédatifs précipite l''arrêt respiratoire fatal.',
     'Additive suppression of central respiratory drive during peripheral neuromuscular ventilatory failure.',
     'Dépression centrale respiratoire s''ajoutant à la paralysie diaphragmatique.',
     'moderate-evidence', 'PubMed — Nicotinic Plant Poisoning', 'https://pubmed.ncbi.nlm.nih.gov/19778187/'),

    -- Collinsonia canadensis
    ('collinsonia-canadensis-herb', 'Lithium', 'Lithium', 'moderate',
     'Traditional diuretic use of stone root (Collinsonia) could theoretically reduce renal lithium clearance and elevate serum lithium into a toxic range, similar to other botanical diuretics. Confirm with a prescriber before combining.',
     'L''effet diurétique attribué à la collinsonie du Canada pourrait théoriquement diminuer l''élimination rénale du lithium et augmenter la lithiémie. Vérifiez auprès de votre prescripteur.',
     'Mild diuretic-induced sodium/water loss can increase proximal tubular lithium reabsorption.',
     'Une déplétion sodée d''origine diurétique peut accroître la réabsorption tubulaire du lithium.',
     'theoretical', 'MedlinePlus — Lithium Interactions', 'https://medlineplus.gov/druginfo/meds/a681039.html'),
    ('collinsonia-canadensis-herb', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques (Furosémide, Hydrochlorothiazide)', 'mild',
     'Combining herbs with traditional diuretic activity alongside prescription diuretics could theoretically amplify fluid loss or electrolyte shifts.',
     'L''association de plantes réputées diurétiques avec des diurétiques sur ordonnance peut théoriquement amplifier la perte hydrique ou électrolytique.',
     'Potential additive natriuretic/diuretic effect.',
     'Effet diurétique additif théorique.',
     'theoretical', 'MedlinePlus — Furosemide Information', 'https://medlineplus.gov/druginfo/meds/a682858.html'),

    -- Barosma betulina (Buchu)
    ('barosma-betulina', 'Lithium', 'Lithium', 'moderate',
     'Buchu exhibits traditional aquaretic/diuretic properties that can alter sodium and fluid balance, potentially reducing renal lithium excretion and increasing serum lithium toxicity risk.',
     'Le buchu possède des propriétés aquarétiques/diurétiques pouvant perturber l''équilibre hydrosodé et réduire l''élimination rénale du lithium, augmentant le risque de toxicité.',
     'Diuretic-mediated volume contraction promotes renal lithium retention.',
     'La déplétion hydrosodée favorise la rétention rénale du lithium.',
     'theoretical', 'PubMed — Buchu (Agathosma betulina) Review', 'https://pubmed.ncbi.nlm.nih.gov/35197854/'),
    ('barosma-betulina', 'Anticoagulants and Antiplatelets (Warfarin, Aspirin)', 'Anticoagulants et antiplaquettaires (Warfarine, Aspirine)', 'mild',
     'Buchu extracts contain coumarin-related and polyphenolic constituents with limited preclinical data suggesting potential modulation of coagulation or antiplatelet drugs; monitor INR if taken near warfarin.',
     'Le buchu contient des constituants polyphénoliques et apparentés aux coumarines ; par prudence, surveillez l''INR ou les signes de saignement en cas d''association à des anticoagulants.',
     'Theoretical additive antiplatelet or hepatic CYP/vitamin-K modulation.',
     'Modulation théorique de l''hémostase ou des enzymes hépatiques.',
     'theoretical', 'PubMed — Agathosma betulina Pharmacognosy Review', 'https://pubmed.ncbi.nlm.nih.gov/18725278/'),

    -- Nerium oleander (restores to sitemap + clinical safety)
    ('nerium-oleander', 'Digoxin', 'Digoxine', 'contraindicated',
     'Oleander contains oleandrin and other cardiac glycosides that cross-react on digoxin immunoassays and add directly to myocardial Na+/K+-ATPase blockade, risking lethal digitalis toxicity and heart block.',
     'Le laurier-rose contient de l''oléandrine et d''autres hétérosides cardiotoniques qui s''ajoutent directement à l''effet de la digoxine, causant une intoxication cardiotonique mortelle et des arythmies graves.',
     'Direct additive myocardial Na+/K+-ATPase inhibition by cardioactive steroids.',
     'Inhibition additive de la Na+/K+-ATPase myocardique par stéroïdes cardiotoniques.',
     'well-documented', 'PubMed — Cardioactive Steroid Toxicity', 'https://pubmed.ncbi.nlm.nih.gov/30725648/'),
    ('nerium-oleander', 'Diuretics (Furosemide, Hydrochlorothiazide)', 'Diurétiques (Furosémide, Hydrochlorothiazide)', 'severe',
     'Potassium-depleting diuretics worsen myocardial vulnerability to oleander cardiac glycosides, sharply increasing risk of fatal ventricular tachycardia and refractory arrhythmias.',
     'Les diurétiques hypokaliémiants aggravent gravement la toxicité cardiaque de l''oléandrine du laurier-rose, majorant le risque d''arythmie ventriculaire fatale.',
     'Diuretic-induced hypokalemia sensitizes cardiomyocytes to oleandrin toxicity.',
     'L''hypokaliémie sensibilise le myocarde à la toxicité de l''oléandrine.',
     'well-documented', 'PubMed — Cardioactive Steroid Toxicity', 'https://pubmed.ncbi.nlm.nih.gov/30725648/'),
    ('nerium-oleander', 'Beta-Blockers (Metoprolol)', 'Bêta-bloquants (Métoprolol)', 'severe',
     'Beta-blockers combined with oleander cardioactive steroids compound AV nodal blockade and risk severe bradyarrhythmia or complete heart block.',
     'Les bêta-bloquants associés aux hétérosides du laurier-rose additionnent le ralentissement nodal et exposent à une bradycardie grave ou à un bloc auriculo-ventriculaire complet.',
     'Synergistic AV-nodal conduction depression.',
     'Dépression synergique de la conduction auriculo-ventriculaire.',
     'well-documented', 'PubMed — Cardioactive Steroid Toxicity', 'https://pubmed.ncbi.nlm.nih.gov/30725648/'),

    -- Aconite processed (restores to sitemap + clinical safety)
    ('aconite-processed', 'Antiarrhythmics (Amiodarone, Flecainide)', 'Antiarythmiques (Amiodarone, Flécaïnide)', 'contraindicated',
     'Aconite alkaloids prolong cardiac sodium-channel activation and trigger polymorphic ventricular arrhythmias; combining with prescription antiarrhythmics (sodium/potassium channel blockers) risks fatal proarrhythmic collapse.',
     'Les alcaloïdes d''aconit maintiennent ouverts les canaux sodiques cardiaques et provoquent des arythmies ventriculaires ; l''association aux antiarythmiques expose à une proarythmie mortelle.',
     'Aconitine delays myocardial voltage-gated Na+ channel inactivation, triggering severe arrhythmias alongside antiarrhythmics.',
     'L''aconitine retarde l''inactivation des canaux sodiques cardiaques, créant des arythmies graves.',
     'well-documented', 'PubMed — Aconite Poisoning Review', 'https://pubmed.ncbi.nlm.nih.gov/19514874/'),
    ('aconite-processed', 'Beta-Blockers (Metoprolol)', 'Bêta-bloquants (Métoprolol)', 'severe',
     'Aconitum alkaloids produce vagal stimulation, bradycardia, and refractory arrhythmias that can be dangerously compounded by beta-adrenergic blockade.',
     'Les alcaloïdes d''Aconitum induisent stimulation vagale, bradycardie et arythmies sévères pouvant être dangereusement aggravées par les bêta-bloquants.',
     'Vagal and cardiac conduction depression alongside beta-blockade.',
     'Dépression vagale et troubles de conduction majorés par le blocage bêta-adrénergique.',
     'moderate-evidence', 'PubMed — Aconitine Toxicology Review', 'https://pubmed.ncbi.nlm.nih.gov/35060168/'),
    ('aconite-processed', 'Antihypertensives', 'Antihypertenseurs', 'severe',
     'Aconitine intoxication induces severe neurogenic and cardiogenic hypotension alongside malignant arrhythmias; concurrent blood pressure medications can accelerate circulatory collapse.',
     'L''aconitine peut provoquer une hypotension neurogène et cardiogénique grave ; l''association aux antihypertenseurs accélère le risque de collapsus circulatoire.',
     'Additive hypotension and autonomic instability.',
     'Hypotension additive et instabilité autonome.',
     'moderate-evidence', 'PubMed — Aconite Poisoning Review', 'https://pubmed.ncbi.nlm.nih.gov/19514874/'),

    -- Mandragora officinarum (restores to sitemap + clinical safety)
    ('mandragora-officinarum-herb', 'Anticholinergics (Oxybutynin, Benztropine)', 'Anticholinergiques (Oxybutynine, Benztropine)', 'contraindicated',
     'Mandrake roots contain toxic tropane alkaloids (atropine, scopolamine) that trigger life-threatening additive anticholinergic crisis when combined with prescription anticholinergics.',
     'La mandragore contient des alcaloïdes tropaniques (atropine, scopolamine) déclenchant une crise anticholinergique potentiellement mortelle avec les anticholinergiques prescrits.',
     'Additive competitive muscarinic blockade across CNS and autonomic tissues.',
     'Blocage muscarinique compétitif additif central et autonome.',
     'well-documented', 'PubMed — Mandragora Toxicology Review', 'https://pubmed.ncbi.nlm.nih.gov/33535944/'),
    ('mandragora-officinarum-herb', 'CNS Depressants (Benzodiazepines, Opioids)', 'Dépresseurs du SNC (Benzodiazépines, Opioïdes)', 'severe',
     'Scopolamine and atropine in mandrake cause CNS delirium followed by stupor or coma; adding opioids or benzodiazepines increases respiratory depression risk.',
     'La scopolamine et l''atropine de la mandragore provoquent délire puis stupeur ; l''association à des opioïdes ou benzodiazépines augmente le risque de dépression respiratoire.',
     'Combined scopolamine sedation/CNS depression with opioid or GABAergic depressants.',
     'Dépression centrale combinée de la scopolamine et des sédatifs.',
     'moderate-evidence', 'PubMed — Tropane Alkaloids Review', 'https://pubmed.ncbi.nlm.nih.gov/36109439/'),
    ('mandragora-officinarum-herb', 'Tricyclic Antidepressants (Amitriptyline)', 'Antidépresseurs tricycliques (Amitriptyline)', 'severe',
     'Mandrake tropane alkaloids plus tricyclic antidepressants dangerously amplify antimuscarinic effects (tachycardia, urinary retention, ileus, delirium, coma).',
     'Les alcaloïdes tropaniques de la mandragore associés aux antidépresseurs tricycliques amplifient dangereusement la toxicité antimuscarinique (tachycardie, délire, rétention urinaire).',
     'Additive muscarinic acetylcholine receptor antagonism.',
     'Antagonisme muscarinique additif.',
     'well-documented', 'PubMed — Mandragora Toxicology Review', 'https://pubmed.ncbi.nlm.nih.gov/33535944/')
)
INSERT INTO public.drug_interactions (
  herb_id, drug_name, severity, description, mechanism, evidence_level, source, source_url, translations
)
SELECT
  h.id,
  p.drug_name,
  p.severity::interaction_severity,
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
);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Clean historical OCR/misplacement errors in herb_monograph_sources
-- ───────────────────────────────────────────────────────────────────────────

-- Remove misplaced Bryonia alba paragraph (element index 5 zero-based / ordinality 6) from Barosma betulina
UPDATE public.herb_monograph_sources
SET claims = COALESCE((
  SELECT jsonb_agg(elem ORDER BY ord)
  FROM jsonb_array_elements(claims) WITH ORDINALITY AS t(elem, ord)
  WHERE elem::text NOT ILIKE '%Bryonia alba%'
), '[]'::jsonb)
WHERE herb_slug = 'barosma-betulina'
  AND source = 'US Dispensatory 1894'
  AND claims::text ILIKE '%Bryonia alba%';

-- Clean Ginger King's American Dispensatory 1898 OCR errors (string array)
UPDATE public.herb_monograph_sources
SET claims = COALESCE((
  SELECT jsonb_agg(
    to_jsonb(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        elem #>> '{}',
        'tlie stems', 'the stems'),
        'Tlie flowers ami stalks', 'The flowers and stalks'),
        'Howers are small', 'flowers are small'),
        'filameiit short', 'filament short'),
        'S-toothed', '3-toothed'),
        'S-celled', '3-celled'),
        'zingiUT ..miinuie. horn of the anther '' 1.. ''.', 'horn of the anther.'),
        'thouuli supposed', 'though supposed'),
        'Sierra Leone^,', 'Sierra Leone,'),
        '.Vfrican coast', 'African coast'),
        'esi)ecially develoi)ed', 'especially developed')
    )
    ORDER BY ord
  )
  FROM jsonb_array_elements(claims) WITH ORDINALITY AS t(elem, ord)
), claims)
WHERE herb_slug = 'ginger'
  AND source = 'King''s American Dispensatory 1898';

-- Clean Ginger US Dispensatory 1918 solvent storage instruction + OCR punctuation (object array)
UPDATE public.herb_monograph_sources
SET claims = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'object' AND elem ? 'text' THEN
        jsonb_set(
          elem,
          '{text}',
          to_jsonb(
            replace(replace(replace(replace(replace(replace(
              elem ->> 'text',
              'Preserve it in tightly closed containers, adding a few drops of chloroform or carbon tetrachloride, from time to time, to prevent attack by insects.', '[Historical 1918 solvent storage note omitted for safety.]'),
              '(Fam, Zingiberaceae)', '(Fam. Zingiberaceae)'),
              'officinale, Roscoe." Br,', 'officinale, Roscoe." Br.'),
              'Zingiber Zerumbet Rose.', 'Zingiber Zerumbet Rosc.'),
              'circular ruge,', 'circular rugae,'),
              'obtusely and _ irregularly', 'obtusely and irregularly')
          )
        )
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(claims) WITH ORDINALITY AS t(elem, ord)
), claims)
WHERE herb_slug = 'ginger'
  AND source = 'US Dispensatory 1918';

-- Clean Ginger US Dispensatory 1894 & Ellingwood 1919 OCR typos (string arrays)
UPDATE public.herb_monograph_sources
SET claims = COALESCE((
  SELECT jsonb_agg(
    to_jsonb(
      replace(replace(replace(replace(
        elem #>> '{}',
        'recurved horu at the end', 'recurved horn at the end'),
        'circular ruge', 'circular rugae'),
        'Zingiber officinale, lloscoe,', 'Zingiber officinale, Roscoe,'),
        '(nat. ord. S. “ The scraped', '(nat. ord. Scitamineae). “ The scraped')
    )
    ORDER BY ord
  )
  FROM jsonb_array_elements(claims) WITH ORDINALITY AS t(elem, ord)
), claims)
WHERE herb_slug = 'ginger'
  AND source = 'US Dispensatory 1894';

UPDATE public.herb_monograph_sources
SET claims = COALESCE((
  SELECT jsonb_agg(
    to_jsonb(
      replace(replace(replace(
        elem #>> '{}',
        'abort the attack, arid produce', 'abort the attack, and produce'),
        'dysmenorrhcea', 'dysmenorrhoea'),
        'rubifacient', 'rubefacient')
    )
    ORDER BY ord
  )
  FROM jsonb_array_elements(claims) WITH ORDINALITY AS t(elem, ord)
), claims)
WHERE herb_slug = 'ginger'
  AND source = 'Ellingwood''s American Materia Medica 1919';

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Clean polluted multi-ingredient LNHPD records on aloe-vera & ginger
-- ───────────────────────────────────────────────────────────────────────────

-- Aloe vera: remove unrelated L-glutamine / Amla claims, remove unquantified
-- product serving chips ("2 capsule", "1 Serving") that conflict with the
-- standardized 10–30 mg aloin monograph dose, and remove redundant/boilerplate risks.
UPDATE public.herb_regulatory_evidence
SET purposes = '[
      "(Used in Herbal Medicine for the) short-term relief of occasional constipation.",
      "(Used in Herbal Medicine to) promote(s) bowel movement (by direct action on the large intestine).",
      "Stimulant laxative.",
      "Used in Herbal Medicine as a demulcent to help soothe irritation/inflammation of the gastrointestinal tract."
    ]'::jsonb,
    doses = '[]'::jsonb,
    risks = '[
      "Consult a health care practitioner if symptoms persist or worsen. Consult a health care practitioner prior to use if you are taking thiazide diuretics, blood thinners, protease inhibitors, corticosteroids, licorice root or other medications or health products which may aggravate electrolyte imbalance.",
      "Consult a health care practitioner prior to use if you have a kidney disorder or are taking cardiac medications such as cardiac glycosides or antiarrhythmic medications.",
      "Do not use if you have abnormal constrictions of the gastrointestinal tract, potential or existing intestinal blockage, atonic bowel, appendicitis, inflammatory colon disease such as Crohn''s disease or ulcerative colitis, abdominal pain of unknown origin, undiagnosed rectal bleeding, severe dehydration with depleted water or electrolytes or diarrhoea.",
      "Do not use if you are pregnant or breastfeeding."
    ]'::jsonb,
    updated_at = now()
WHERE herb_slug = 'aloe-vera';

-- Ginger: replace multi-ingredient TCM formula noise ("5 Granules", hypokalemia /
-- diuretic / yin-deficient fire boilerplate) with clean single-ingredient Health
-- Canada Ginger monograph claims and cautions.
UPDATE public.herb_regulatory_evidence
SET purposes = '[
      "Helps prevent nausea and vomiting associated with motion sickness and/or seasickness.",
      "Traditionally used in Herbal Medicine (as a carminative) to help relieve digestive upset including lack of appetite, nausea, digestive spasms, indigestion, dyspepsia, and flatulent colic.",
      "Traditionally used in Herbal Medicine (as an expectorant and antitussive) to help relieve bronchitis, coughs, and colds."
    ]'::jsonb,
    doses = '[]'::jsonb,
    risks = '[
      "Consult a health care practitioner if symptoms persist or worsen.",
      "Consult a health care practitioner prior to use if you are taking blood thinners (anticoagulants or antiplatelet drugs) or before surgery.",
      "Consult a health care practitioner prior to use if you have gallstones or bleeding disorders."
    ]'::jsonb,
    updated_at = now()
WHERE herb_slug = 'ginger';

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Refresh timestamps & provenance verification dates on updated herbs
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.herbs
SET updated_at = now(),
    provenance = jsonb_set(
      COALESCE(provenance, '{}'::jsonb),
      '{last_verified_at}',
      to_jsonb(now())
    )
WHERE slug IN (
  'ginger', 'ginkgo-biloba', 'aloe-vera', 'senna-leaf', 'barosma-betulina',
  'collinsonia-canadensis-herb', 'atropa-belladonna-herb', 'digitalis-purpurea-herb',
  'conium-maculatum-herb', 'nerium-oleander', 'aconite-processed',
  'mandragora-officinarum-herb', 'cicuta-virosa', 'strychnos-nux-vomica',
  'taxus-baccata', 'colchicum-autumnale-herb', 'ricinus-communis',
  'american-ginseng', 'armoracia-rusticana-herb', 'black-garlic', 'blueberry-leaf',
  'chlorella', 'citrus-bioflavonoids', 'colostrum-bovine', 'coq10-antioxidant',
  'dong-quai', 'echinacea-angustifolia', 'echinacea-pallida', 'ephedra-sinica',
  'feverfew', 'frangula-purshiana', 'ginseng', 'griffonia-simplicifolia',
  'maca', 'medicago-sativa', 'red-clover-iso', 'rhodiola', 'saw-palmetto',
  'serrapeptase', 'white-willow'
);

COMMIT;
