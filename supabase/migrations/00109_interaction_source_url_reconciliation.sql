-- 00109_interaction_source_url_reconciliation.sql
-- Reconcile 7 dead HTTP 404 citation URLs across public.drug_interactions
-- discovered by automated A8 source monitoring (verified HTTP 200 / NCBI
-- PubMed PMIDs replace broken legacy MSKCC and MedlinePlus links).
-- Idempotent and PG16-safe; triggers audit revision logging normally.

BEGIN;

-- 1) Aloe vera / Aloe vera leaf: retired MedlinePlus 607.html -> live NIH NCCIH Aloe Vera monograph
UPDATE public.drug_interactions
SET
  source_url = 'https://www.nccih.nih.gov/health/aloe-vera',
  updated_at = now()
WHERE source_url = 'https://medlineplus.gov/druginfo/natural/607.html';

-- 2) Cat's claw: legacy MSKCC /herbs/cats-claw -> live NIH NCCIH Cat's Claw monograph
UPDATE public.drug_interactions
SET
  source_url = 'https://www.nccih.nih.gov/health/cats-claw',
  updated_at = now()
WHERE source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/cats-claw';

-- 3) Devil's claw: legacy MSKCC /herbs/devils-claw -> live EMA HMPC Harpagophyti radix monograph
UPDATE public.drug_interactions
SET
  source_url = 'https://www.ema.europa.eu/en/medicines/herbal/harpagophyti-radix',
  updated_at = now()
WHERE source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/devils-claw';

-- 4) Holy basil: legacy MSKCC /herbs/holy-basil & MedlinePlus 1101.html -> live MSKCC holy-basil-01 monograph
UPDATE public.drug_interactions
SET
  source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil-01',
  updated_at = now()
WHERE source_url IN (
  'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil',
  'https://medlineplus.gov/druginfo/natural/1101.html'
);

-- 5) Barley grass: legacy MSKCC /herbs/barley-grass -> PubMed peer-reviewed functional review PMID 29849880
UPDATE public.drug_interactions
SET
  source_url = 'https://pubmed.ncbi.nlm.nih.gov/29849880/',
  updated_at = now()
WHERE source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/barley-grass';

-- 6) Bacopa monnieri: legacy MSKCC /herbs/bacopa -> PubMed primary citations per pharmacological mechanism
UPDATE public.drug_interactions
SET
  source_url = CASE
    WHEN drug_name ILIKE '%thyroid%'
      THEN 'https://pubmed.ncbi.nlm.nih.gov/12065164/'
    WHEN drug_name ILIKE '%donepezil%' OR drug_name ILIKE '%cholinesterase%'
      THEN 'https://pubmed.ncbi.nlm.nih.gov/42616216/'
    ELSE 'https://pubmed.ncbi.nlm.nih.gov/24566323/'
  END,
  updated_at = now()
WHERE source_url = 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/bacopa';

COMMIT;
