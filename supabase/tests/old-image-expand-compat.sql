-- Old-image compatibility verification during expand phase (after 00097-00103, BEFORE 00104),
-- AND after a real 00104 contract rollback.
-- Ensures previous container queries (SELECT * across all 6 base tables) AND old-image
-- calculator writes (anon + authenticated scaling/adult_reference inserts into
-- dosage_calculations) continue to succeed without permission or constraint errors
-- while new sanitized `*_public` views already strip pediatric doses.

DO $$
DECLARE
  v_herb public.herbs%ROWTYPE;
  v_faq public.herb_faqs%ROWTYPE;
  v_mono public.herb_monographs%ROWTYPE;
  v_reg public.herb_regulatory_evidence%ROWTYPE;
  v_src public.herb_monograph_sources%ROWTYPE;
  v_pm public.herb_pubmed_monographs%ROWTYPE;
  v_pub_dose TEXT;
  v_anon_calc_id UUID;
  v_auth_calc_id UUID;
BEGIN
  -- 1) Old-image anonymous reads (SELECT *) across all 6 base tables + sanitized view
  EXECUTE 'SET LOCAL ROLE anon';

  SELECT * INTO v_herb
  FROM public.herbs
  WHERE slug = 'chamomile' AND is_published = true;
  IF v_herb.name IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herbs returned no rows during expand/rollback';
  END IF;

  SELECT * INTO v_faq
  FROM public.herb_faqs
  WHERE herb_id = '33333333-3333-3333-3333-333333333333'
  LIMIT 1;
  IF v_faq.answer IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herb_faqs failed during expand/rollback';
  END IF;

  SELECT * INTO v_mono FROM public.herb_monographs WHERE herb_slug = 'chamomile' LIMIT 1;
  IF v_mono.summary IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herb_monographs failed during expand/rollback';
  END IF;

  SELECT * INTO v_reg FROM public.herb_regulatory_evidence WHERE herb_slug = 'chamomile' LIMIT 1;
  IF v_reg.doses IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herb_regulatory_evidence failed during expand/rollback';
  END IF;

  SELECT * INTO v_src FROM public.herb_monograph_sources WHERE herb_slug = 'fennel' LIMIT 1;
  IF v_src.claims IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herb_monograph_sources failed during expand/rollback';
  END IF;

  SELECT * INTO v_pm FROM public.herb_pubmed_monographs WHERE slug = 'chamomile' LIMIT 1;
  IF v_pm.content IS NULL THEN
    RAISE EXCEPTION 'Old-image SELECT * from public.herb_pubmed_monographs failed during expand/rollback';
  END IF;

  -- Old-image anonymous calculator write during expand / post-rollback.
  -- The pre-00104 insert policy permits anonymous rows (user_id IS NULL), but
  -- RETURNING would additionally require the new row to pass the SELECT policy,
  -- which production intentionally scopes to user_id = auth.uid(). PostgREST
  -- inserts do not use RETURNING, so exercise that same shape and verify
  -- persistence below as the privileged fixture owner.
  INSERT INTO public.dosage_calculations (patient_age, patient_weight_kg, adult_dose, calculated_dose, formula_used, notes)
  VALUES (10, 32, '500 mg', '235 mg', 'clarks_rule', 'old-image-anon-compat');

  -- New image queries sanitized herbs_public view simultaneously
  SELECT dosage_adult INTO v_pub_dose
  FROM public.herbs_public
  WHERE slug = 'chamomile';
  IF v_pub_dose ~* '100 mg daily' THEN
    RAISE EXCEPTION 'herbs_public leaked pediatric dosage during expand/rollback: %', v_pub_dose;
  END IF;

  RESET ROLE;

  -- Confirm the anonymous write persisted; anon cannot read its own NULL-user row.
  SELECT id INTO v_anon_calc_id
  FROM public.dosage_calculations
  WHERE notes = 'old-image-anon-compat'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 2) Old-image authenticated calculator write + new-image adult_reference write during expand / post-rollback
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.dosage_calculations (user_id, patient_age, patient_weight_kg, adult_dose, calculated_dose, formula_used)
  VALUES ('11111111-1111-1111-1111-111111111111', 11, 35, '500 mg', '240 mg', 'youngs_rule')
  RETURNING id INTO v_auth_calc_id;

  INSERT INTO public.dosage_calculations (user_id, patient_age, patient_weight_kg, adult_dose, calculated_dose, formula_used)
  VALUES ('11111111-1111-1111-1111-111111111111', 35, 70, '500 mg', '500 mg', 'adult_reference');

  RESET ROLE;

  IF v_anon_calc_id IS NULL OR v_auth_calc_id IS NULL THEN
    RAISE EXCEPTION 'Old-image calculator writes did not persist during expand/rollback';
  END IF;
END
$$;
