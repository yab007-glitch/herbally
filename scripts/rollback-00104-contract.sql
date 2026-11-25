-- Emergency contract rollback for 00104_pediatric_boundary_contract.sql.
-- Restores pre-contract table-level SELECT on base herb/monograph/FAQ tables AND
-- reverses the post-switch dosage_calculations lockdown (while preserving all
-- quarantined rows, herbs_pediatric_quarantine, and *_public views intact) so
-- a pre-contract application image can read and write cleanly if rolled back.

BEGIN;

-- 1) Restore base-table SELECT grants for pre-contract image compatibility.
GRANT SELECT ON TABLE public.herbs TO anon, authenticated;
GRANT SELECT ON TABLE public.herb_faqs TO anon, authenticated;
GRANT SELECT ON TABLE public.herb_monographs TO anon, authenticated;
GRANT SELECT ON TABLE public.herb_regulatory_evidence TO anon, authenticated;
GRANT SELECT ON TABLE public.herb_monograph_sources TO anon, authenticated;
GRANT SELECT ON TABLE public.herb_pubmed_monographs TO anon, authenticated;

-- 2) Restore pre-contract dosage_calculations write compatibility for old image.
DROP TRIGGER IF EXISTS trg_dosage_calculations_adult_only ON public.dosage_calculations;
ALTER TABLE public.dosage_calculations
  DROP CONSTRAINT IF EXISTS dosage_calculations_adult_only_check;

GRANT INSERT ON TABLE public.dosage_calculations TO anon;

DROP POLICY IF EXISTS "Users can insert own calculations" ON public.dosage_calculations;
CREATE POLICY "Users can insert own calculations"
  ON public.dosage_calculations FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Anonymous can insert calculations" ON public.dosage_calculations;
CREATE POLICY "Anonymous can insert calculations"
  ON public.dosage_calculations FOR INSERT
  WITH CHECK (user_id IS NULL);

COMMIT;
