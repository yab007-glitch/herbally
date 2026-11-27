-- 00110_ema_sennae_fructus_url_fix.sql
-- Replaces legacy HTTP 404 EMA URL sennae-fructus-acutifoliae surfaced by
-- host-paced A8 source monitoring with canonical live HTTP 200 EMA HMPC URL
-- https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus.

BEGIN;

UPDATE public.drug_interactions
SET
  source_url = 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus',
  updated_at = now()
WHERE source_url = 'https://www.ema.europa.eu/en/medicines/herbal/sennae-fructus-acutifoliae';

COMMIT;
