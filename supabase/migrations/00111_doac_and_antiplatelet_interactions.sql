-- 00111_doac_and_antiplatelet_interactions.sql
-- Adds 6 verified bilingual (EN + FR) PubMed-cited direct oral anticoagulant
-- (DOAC: Rivaroxaban, Dabigatran, Apixaban, Edoxaban) and antiplatelet
-- (Clopidogrel) interaction records for St. John's Wort and Ginkgo Biloba.
-- Intentionally retains default unreviewed legacy governance flags pending
-- independent licensed clinician sign-off.

BEGIN;

WITH seed (
  herb_slug,
  drug_name,
  severity,
  description,
  mechanism,
  evidence_level,
  source,
  source_url,
  evidence_note,
  fr_drug_name,
  fr_description,
  fr_mechanism,
  fr_evidence_note
) AS (
  VALUES
  (
    'st-johns-wort',
    'Rivaroxaban (Xarelto)',
    'severe',
    'St. John''s Wort strongly lowers rivaroxaban blood levels and anticoagulant effect in human pharmacokinetic/pharmacodynamic studies, increasing risk of stroke or recurrent venous thromboembolism.',
    'Potent hyperforin-mediated induction of intestinal/hepatic CYP3A4 and P-glycoprotein (P-gp) accelerates rivaroxaban clearance.',
    'well-documented',
    'PubMed — Br J Clin Pharmacol 2021',
    'https://pubmed.ncbi.nlm.nih.gov/32959922/',
    'Controlled human study (PMID 32959922) demonstrated significant reductions in rivaroxaban exposure and factor Xa inhibition with concomitant Hypericum perforatum.',
    'Rivaroxaban (Xarelto)',
    'Le millepertuis diminue fortement les concentrations sanguines et l''effet anticoagulant du rivaroxaban chez l''humain, augmentant le risque d''AVC ou de thromboembolie.',
    'L''induction puissante du CYP3A4 et de la P-glycoprotéine (P-gp) par l''hyperforine accélère l''élimination du rivaroxaban.',
    'Une étude clinique humaine (PMID 32959922) a montré une baisse significative de l''exposition au rivaroxaban et de l''inhibition du facteur Xa avec Hypericum perforatum.'
  ),
  (
    'ginkgo-biloba',
    'Rivaroxaban (Xarelto)',
    'mild',
    'In a controlled healthy-volunteer trial, standardized EGb 761 ginkgo extract did not significantly alter rivaroxaban pharmacokinetics or pharmacodynamics, though clinical monitoring for additive bruising or bleeding remains prudent.',
    'Potential minor antiplatelet overlap without clinically significant CYP3A4/P-gp rivaroxaban clearance shift observed with EGb 761 in healthy adults.',
    'moderate-evidence',
    'PubMed — Front Pharmacol 2022',
    'https://pubmed.ncbi.nlm.nih.gov/35517810/',
    'Single and repeated doses of standardized EGb 761 showed no statistically significant rivaroxaban PK/PD change in healthy subjects (PMID 35517810); unstandardized extracts or high bleeding-risk patients still warrant pharmacist review.',
    'Rivaroxaban (Xarelto)',
    'Dans un essai chez des volontaires sains, l''extrait standardisé EGb 761 n''a pas modifié significativement la pharmacocinétique ni la pharmacodynamie du rivaroxaban, mais une surveillance des saignements reste prudente.',
    'Recouvrement antiplaquettaire potentiel mineur sans modification majeure du métabolisme CYP3A4/P-gp observée avec EGb 761 chez l''adulte sain.',
    'Des doses uniques et répétées d''extrait standardisé EGb 761 n''ont pas altéré significativement les paramètres du rivaroxaban chez des sujets sains (PMID 35517810) ; faites valider l''association avec un pharmacien.'
  ),
  (
    'st-johns-wort',
    'Dabigatran (Pradaxa)',
    'contraindicated',
    'Concurrent St. John''s Wort markedly reduces dabigatran etexilate absorption and systemic anticoagulant protection, risking thromboembolic failure.',
    'Potent induction of intestinal P-glycoprotein (P-gp) efflux limits bioavailability of the P-gp substrate dabigatran etexilate.',
    'well-documented',
    'PubMed — Int J Mol Sci 2021',
    'https://pubmed.ncbi.nlm.nih.gov/34445237/',
    'Clinical DOAC interaction reviews (PMID 34445237) classify strong P-gp inducers including Hypericum perforatum as contraindicated or best avoided with dabigatran.',
    'Dabigatran (Pradaxa)',
    'La prise simultanée de millepertuis réduit nettement l''absorption du dabigatran etexilate et sa protection anticoagulante, exposant à un risque thromboembolique.',
    'L''induction marquée de la P-glycoprotéine (P-gp) intestinale réduit la biodisponibilité du dabigatran etexilate.',
    'Les revues cliniques sur les anticoagulants oraux directs (PMID 34445237) déconseillent formellement les inducteurs puissants de la P-gp comme le millepertuis avec le dabigatran.'
  ),
  (
    'st-johns-wort',
    'Apixaban (Eliquis)',
    'contraindicated',
    'St. John''s Wort induces both metabolic elimination pathways of apixaban, threatening sub-therapeutic anticoagulation and stroke or clot recurrence.',
    'Dual strong induction of CYP3A4 and P-glycoprotein (P-gp) accelerates apixaban clearance and lowers plasma levels.',
    'well-documented',
    'PubMed — Int J Mol Sci 2021',
    'https://pubmed.ncbi.nlm.nih.gov/34445237/',
    'Regulatory labels and DOAC reviews (PMID 34445237) caution against combined strong CYP3A4 + P-gp inducers such as St. John''s Wort with apixaban.',
    'Apixaban (Eliquis)',
    'Le millepertuis induit conjointement les deux voies d''élimination de l''apixaban, risquant une perte d''efficacité anticoagulante et un événement thromboembolique.',
    'L''induction combinée du CYP3A4 et de la P-glycoprotéine (P-gp) accélère l''élimination de l''apixaban.',
    'Les monographies réglementaires et revues sur les AOD (PMID 34445237) mettent en garde contre l''association d''inducteurs puissants CYP3A4 + P-gp tels que le millepertuis avec l''apixaban.'
  ),
  (
    'st-johns-wort',
    'Edoxaban (Savaysa)',
    'contraindicated',
    'St. John''s Wort can substantially lower edoxaban exposure via P-glycoprotein induction, compromising protection against thromboembolism.',
    'Strong induction of P-glycoprotein (P-gp) efflux decreases absorption and increases clearance of edoxaban.',
    'well-documented',
    'PubMed — Int J Mol Sci 2021',
    'https://pubmed.ncbi.nlm.nih.gov/34445237/',
    'DOAC pharmacology reviews (PMID 34445237) warn against strong P-gp inducers such as Hypericum perforatum during edoxaban therapy.',
    'Édoxaban (Savaysa / Lixiana)',
    'Le millepertuis peut abaisser sensiblement l''exposition à l''édoxaban par induction de la P-glycoprotéine, compromettant la protection anticoagulante.',
    'L''induction puissante du transporteur P-gp réduit l''absorption et accélère l''élimination de l''édoxaban.',
    'Les revues pharmacologiques sur les AOD (PMID 34445237) déconseillent les inducteurs puissants de la P-gp comme le millepertuis sous édoxaban.'
  ),
  (
    'st-johns-wort',
    'Clopidogrel (Plavix)',
    'moderate',
    'St. John''s Wort may alter clopidogrel bioactivation, potentially increasing platelet inhibition and bleeding risk in CYP2C19/CYP3A4-modulated patients.',
    'Hyperforin induction of CYP3A4 and CYP2C19 increases conversion of the clopidogrel prodrug to its active antiplatelet thiol metabolite.',
    'moderate-evidence',
    'PubMed — Ther Clin Risk Manag 2015',
    'https://pubmed.ncbi.nlm.nih.gov/25848291/',
    'Clinical pharmacokinetic reviews (PMID 25848291) document enhanced clopidogrel metabolic activation and variable bleeding signal with St. John''s Wort co-administration.',
    'Clopidogrel (Plavix)',
    'Le millepertuis peut modifier la bioactivation du clopidogrel et accroître l''inhibition plaquettaire ainsi que le risque hémorragique.',
    'L''induction du CYP3A4 et du CYP2C19 augmente la transformation du promédicament clopidogrel en métabolite actif.',
    'Les revues pharmacocinétiques cliniques (PMID 25848291) décrivent une activation métabolique accrue du clopidogrel et un signal hémorragique variable avec le millepertuis.'
  )
)
INSERT INTO public.drug_interactions (
  herb_id,
  drug_name,
  severity,
  description,
  mechanism,
  evidence_level,
  source,
  source_url,
  evidence_note,
  translations
)
SELECT
  h.id,
  s.drug_name,
  s.severity::public.interaction_severity,
  s.description,
  s.mechanism,
  s.evidence_level,
  s.source,
  s.source_url,
  s.evidence_note,
  jsonb_build_object(
    'fr',
    jsonb_build_object(
      'drug_name', s.fr_drug_name,
      'description', s.fr_description,
      'mechanism', s.fr_mechanism,
      'evidence_note', s.fr_evidence_note
    )
  )
FROM seed s
JOIN public.herbs h ON h.slug = s.herb_slug
WHERE h.is_published = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.drug_interactions di
    WHERE di.herb_id = h.id
      AND lower(di.drug_name) = lower(s.drug_name)
  );

COMMIT;
