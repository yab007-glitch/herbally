-- Disposable-Postgres integration tests for migrations 00097–00104.
-- Exercises real roles (anon, authenticated, AAL1 admin, AAL2 admin, service_role),
-- triggers, RLS policies, constraints, views, PostgREST-equivalent CRUD, and RPCs.

-- 1) 00100 + 00104: Legacy & expand-window non-adult_reference rows preserved & quarantined;
-- public herb/monograph/source/regulatory pediatric boundary closed
DO $$
DECLARE
  v_quarantined_count INT;
  v_bundle JSONB;
  v_fennel_bundle JSONB;
  v_search_child TEXT;
  v_search_adult TEXT;
  v_fr_child TEXT;
  v_archived_fr TEXT;
  v_fennel_claims JSONB;
  v_fennel_safety JSONB;
  v_senna_safety JSONB;
  v_reg_purposes JSONB;
  v_reg_risks JSONB;
  v_followon TEXT;
BEGIN
  -- 4 seeded pre-migration legacy rows + 2 old-image expand rows inserted by old-image-expand-compat.sql
  SELECT count(*) INTO v_quarantined_count
  FROM public.dosage_calculations
  WHERE is_legacy_pediatric_quarantined = true;
  IF v_quarantined_count < 6 THEN
    RAISE EXCEPTION 'Expected >= 6 quarantined legacy/expand calculation rows, got %', v_quarantined_count;
  END IF;

  -- Verify existing herb_page_bundle was scrubbed and RPC redacts dosage_child
  SELECT public.herb_page_bundle('chamomile') INTO v_bundle;
  IF v_bundle->'herb'->>'dosage_child' IS NOT NULL THEN
    RAISE EXCEPTION 'herb_page_bundle leaked dosage_child';
  END IF;
  IF (v_bundle->'herb'->'translations'->'fr') ? 'dosage_child' THEN
    RAISE EXCEPTION 'herb_page_bundle leaked translations.fr.dosage_child';
  END IF;
  IF (v_bundle->'herb'->>'dosage_adult') ~* 'Children 6-12 years' THEN
    RAISE EXCEPTION 'herb_page_bundle leaked pediatric sentence in dosage_adult: %', v_bundle->'herb'->>'dosage_adult';
  END IF;
  IF (v_bundle->'herb'->>'dosage_adult') NOT LIKE '%Children who ingest 5 g%' THEN
    RAISE EXCEPTION 'herb_page_bundle stripped genuine poisoning warning: %', v_bundle->'herb'->>'dosage_adult';
  END IF;
  IF jsonb_array_length(v_bundle->'regulatory'->'doses') <> 1 THEN
    RAISE EXCEPTION 'Expected adult-inclusive regulatory dose retained and pediatric-only dropped, got %', v_bundle->'regulatory'->'doses';
  END IF;

  -- Verify translations.fr.dosage_child was archived and stripped
  SELECT translations->'fr'->>'dosage_child' INTO v_fr_child
  FROM public.herbs WHERE slug = 'chamomile';
  IF v_fr_child IS NOT NULL THEN
    RAISE EXCEPTION 'translations.fr.dosage_child should have been stripped from herbs';
  END IF;
  SELECT fr_dosage_child INTO v_archived_fr
  FROM public.herbs_pediatric_quarantine WHERE herb_id = '33333333-3333-3333-3333-333333333333';
  IF v_archived_fr IS DISTINCT FROM '100 mg enfant' THEN
    RAISE EXCEPTION 'Expected archived fr_dosage_child, got %', v_archived_fr;
  END IF;

  -- Verify search_herbs_by_symptom returns NULL dosage_child and stripped dosage_adult
  SELECT dosage_child, dosage_adult INTO v_search_child, v_search_adult
  FROM public.search_herbs_by_symptom('chamomile') LIMIT 1;
  IF v_search_child IS NOT NULL THEN
    RAISE EXCEPTION 'search_herbs_by_symptom leaked dosage_child';
  END IF;
  IF v_search_adult ~* 'Children 6-12 years' THEN
    RAISE EXCEPTION 'search_herbs_by_symptom leaked pediatric dosage_adult: %', v_search_adult;
  END IF;

  -- Verify 00102 tagged bulk 00079 editorial import BEFORE any clinical edit resets it
  IF COALESCE((SELECT provenance->>'review_role' FROM public.herbs WHERE slug = 'chamomile'), '') <> 'editorial'
     OR COALESCE((SELECT (provenance->>'bulk_editorial_import')::boolean FROM public.herbs WHERE slug = 'chamomile'), false) <> true THEN
    RAISE EXCEPTION 'Expected 00102 bulk 00079 row to be tagged review_role=editorial, bulk_editorial_import=true';
  END IF;

  -- Verify faqs & monograph bundle redaction + real PG16 strip_pediatric_dosage_text() calls
  IF (v_bundle->'faqs'->0->>'answer') ~* 'Children 6-12 years'
     OR (v_bundle->'faqs'->0->>'answer') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'herb_page_bundle faqs leaked pediatric or dropped adult prose: %', v_bundle->'faqs';
  END IF;
  IF (v_bundle->'monograph'->>'summary') ~* 'Give children 100 mg'
     OR (v_bundle->'monograph'->>'summary') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'herb_page_bundle monograph leaked pediatric or dropped adult prose: %', v_bundle->'monograph';
  END IF;
  IF (v_bundle->'monograph'->'safetyNotes'->>0) ~* 'Give a 5-year-old 50 mg' THEN
    RAISE EXCEPTION 'herb_page_bundle monograph.safetyNotes leaked pediatric prose: %', v_bundle->'monograph'->'safetyNotes';
  END IF;

  -- Real senna / fennel / mixed warning+dose calls (verifies PG16 regex compilation & semantics)
  IF public.strip_pediatric_dosage_text('Adults and adolescents over 12 years: 15-30 mg hydroxyanthracene daily. Children under 12 years: contraindicated.') NOT LIKE '%15-30 mg hydroxyanthracene daily%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text stripped adult-inclusive senna dose';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: 1-2 g daily. Fennel oil not for infants or children under 4 years.') NOT LIKE '%Adults: 1-2 g daily%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text stripped adult fennel dose';
  END IF;
  IF public.strip_pediatric_dosage_text('Give a 5-year-old 250 mg; toxic in overdose.') ~* '250 mg' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed to strip mixed warning+prescriptive pediatric dose';
  END IF;

  v_followon := public.strip_pediatric_dosage_text('Never give children 5 ml; give 10 ml.');
  IF v_followon ~* '10 ml' OR v_followon NOT LIKE '%Never give children 5 ml%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed follow-on semicolon pediatric dose check: %', v_followon;
  END IF;

  -- Real senna/fennel herb_monograph_sources_public & herb_regulatory_evidence_public array sanitization
  SELECT claims, safety INTO v_fennel_claims, v_fennel_safety
  FROM public.herb_monograph_sources_public
  WHERE herb_slug = 'fennel'
  LIMIT 1;
  IF v_fennel_claims::text ~* '1\.0 g|1 g' OR v_fennel_claims::text NOT LIKE '%digestive%' THEN
    RAISE EXCEPTION 'herb_monograph_sources_public leaked pediatric claim or dropped adult claim: %', v_fennel_claims;
  END IF;
  IF v_fennel_safety::text ~* 'give 10 ml' OR v_fennel_safety::text NOT LIKE '%Fennel oil not for infants or children under 4 years%' THEN
    RAISE EXCEPTION 'herb_monograph_sources_public leaked follow-on dose or dropped warning: %', v_fennel_safety;
  END IF;

  SELECT safety INTO v_senna_safety
  FROM public.herb_monograph_sources_public
  WHERE herb_slug = 'senna-leaf'
  LIMIT 1;
  IF v_senna_safety::text ~* '7\.5 mg' OR v_senna_safety::text NOT LIKE '%Contraindicated in children under 12%' THEN
    RAISE EXCEPTION 'herb_monograph_sources_public senna safety check failed: %', v_senna_safety;
  END IF;

  SELECT purposes, risks INTO v_reg_purposes, v_reg_risks
  FROM public.herb_regulatory_evidence_public
  WHERE herb_slug = 'fennel'
  LIMIT 1;
  IF v_reg_purposes::text ~* '1\.0 g' OR v_reg_risks::text ~* '250 mg' THEN
    RAISE EXCEPTION 'herb_regulatory_evidence_public leaked pediatric prose in purposes/risks: % / %', v_reg_purposes, v_reg_risks;
  END IF;

  SELECT public.herb_page_bundle('fennel') INTO v_fennel_bundle;
  IF (v_fennel_bundle->'sources')::text ~* 'give 10 ml|1\.0 g' THEN
    RAISE EXCEPTION 'herb_page_bundle leaked pediatric dose inside sources claims/safety: %', v_fennel_bundle->'sources';
  END IF;

  -- B3: 18-boundary & combined adult+under-18 tests in real PG16 SQL & JSONB functions
  IF public.strip_pediatric_dosage_text('Adults and adolescents 12 years and older: 15-30 mg daily.') <> 'Adults: 15-30 mg daily.' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text left dangling Adults years and older: %', public.strip_pediatric_dosage_text('Adults and adolescents 12 years and older: 15-30 mg daily.');
  END IF;
  IF COALESCE(public.strip_pediatric_dosage_text('Adults 12-18 years: 200 mg daily.'), '') <> '' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text leaked Adults 12-18 years dose: %', public.strip_pediatric_dosage_text('Adults 12-18 years: 200 mg daily.');
  END IF;
  IF COALESCE(public.strip_pediatric_dosage_text('Adults (12-18): 200 mg daily.'), '') <> '' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text leaked Adults (12-18) dose';
  END IF;
  IF COALESCE(public.strip_pediatric_dosage_text('Adults up to 18: 100 mg daily.'), '') <> ''
     OR COALESCE(public.strip_pediatric_dosage_text('Adults 18 and under: 100 mg daily.'), '') <> ''
     OR COALESCE(public.strip_pediatric_dosage_text('Adults 18 or younger: 100 mg daily.'), '') <> ''
     OR COALESCE(public.strip_pediatric_dosage_text('Adults ≤18: 100 mg daily.'), '') <> '' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text leaked adult-labelled under-18 boundary dose';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: 500 mg daily. Children 6-18 years: 100 mg daily.') ~* '100 mg' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed 6-18 boundary';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: 500 mg daily. Under 18: 100 mg daily.') ~* '100 mg' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed Under 18 boundary';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: 500 mg daily. Under-18: 100 mg daily.') ~* '100 mg' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed Under-18 boundary';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: 500 mg daily. 0-18 years: 50 mg daily.') ~* '50 mg' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text failed 0-18 boundary';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults: take up to 18 mg daily.') NOT LIKE '%18 mg%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text wrongly stripped up to 18 mg dose';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults 18 years and older: 500 mg daily.') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text wrongly stripped Adults 18 years and older';
  END IF;
  IF public.strip_pediatric_dosage_text('Adults (18+): 500 mg daily.') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text wrongly stripped Adults (18+)';
  END IF;
  IF public.strip_pediatric_dosage_text('18+: 500 mg daily.') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text wrongly stripped 18+';
  END IF;
  IF NOT public.is_pediatric_only_dose_jsonb('{"population":"0-18","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"Children 6-18 years","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"Adults 12-18 years","text":"200 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"Up to 18","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"18 and under","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"18 or younger","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"≤18","text":"100 mg daily"}'::jsonb)
     OR NOT public.is_pediatric_only_dose_jsonb('{"population":"Under 18","text":"100 mg daily"}'::jsonb)
     OR public.is_pediatric_only_dose_jsonb('{"population":"Adults 18 years and older","age_minimum":18,"text":"500 mg daily"}'::jsonb) THEN
    RAISE EXCEPTION 'is_pediatric_only_dose_jsonb failed 18-boundary classification';
  END IF;

  IF public.strip_pediatric_dosage_text('Children should not take this product.') IS DISTINCT FROM 'Children should not take this product.'
     OR public.strip_pediatric_dosage_text('Children must not take this product.') IS DISTINCT FROM 'Children must not take this product.'
     OR public.strip_pediatric_dosage_text('Not for use in children under 12 years.') IS DISTINCT FROM 'Not for use in children under 12 years.'
     OR public.strip_pediatric_dosage_text('Not suitable for children or adolescents.') IS DISTINCT FROM 'Not suitable for children or adolescents.'
     OR public.strip_pediatric_dosage_text('Minor side effects: mild nausea if you take on an empty stomach.') IS DISTINCT FROM 'Minor side effects: mild nausea if you take on an empty stomach.'
     OR public.strip_pediatric_dosage_text('Adults: 500 mg twice daily. Children should not take this product. Children 6-12 years: 100 mg daily.') IS DISTINCT FROM 'Adults: 500 mg twice daily. Children should not take this product.' THEN
    RAISE EXCEPTION 'strip_pediatric_dosage_text wrongly stripped non-dose warning or adult dose';
  END IF;

  -- B4: monograph drug_interactions, FAQ question EN/FR (preserving safe child questions), and recursive PubMed sanitization
  IF (SELECT drug_interactions::text FROM public.herb_monographs_public WHERE herb_slug = 'chamomile') ~* '100 mg'
     OR (SELECT drug_interactions::text FROM public.herb_monographs_public WHERE herb_slug = 'chamomile') NOT LIKE '%INR monitoring%' THEN
    RAISE EXCEPTION 'herb_monographs_public.drug_interactions sanitization failed';
  END IF;
  IF (SELECT question FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888881') ~* '100 mg'
     OR (SELECT translations->'fr'->>'question' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888881') ~* '100 mg' THEN
    RAISE EXCEPTION 'herb_faqs_public EN/FR question sanitization failed';
  END IF;
  IF (SELECT question FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888882') IS DISTINCT FROM 'Can children take chamomile?'
     OR (SELECT answer FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888882') NOT LIKE '%Contraindicated in children under 12%'
     OR (SELECT translations->'fr'->>'question' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888882') IS DISTINCT FROM 'Les enfants peuvent-ils prendre de la camomille ?' THEN
    RAISE EXCEPTION 'herb_faqs_public dropped or altered safe child question with warning answer';
  END IF;
  IF (SELECT question FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888883') IS DISTINCT FROM 'Safety information'
     OR (SELECT answer FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888883') NOT LIKE '%Stop use and consult a healthcare professional%'
     OR (SELECT translations->'fr'->>'question' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888883') IS DISTINCT FROM 'Information de sécurité'
     OR (SELECT translations->'fr'->>'answer' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888883') NOT LIKE '%Cesser l''utilisation%' THEN
    RAISE EXCEPTION 'herb_faqs_public failed fallback question parity for numeric pediatric question + warning answer';
  END IF;
  IF (SELECT question FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888884') IS DISTINCT FROM 'Safety information'
     OR (SELECT answer FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888884') IS DISTINCT FROM ''
     OR (SELECT translations->'fr'->>'question' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888884') IS DISTINCT FROM 'Information de sécurité'
     OR (SELECT translations->'fr'->>'answer' FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888884') NOT LIKE '%Cesser l''utilisation%'
     OR EXISTS (SELECT 1 FROM public.herb_faqs_public WHERE id = '88888888-8888-8888-8888-888888888885') THEN
    RAISE EXCEPTION 'herb_faqs_public failed EN-empty/FR-warning parity or retained both-empty FAQ';
  END IF;
  IF (SELECT content::text FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') ~* '100 mg|150 mg|200 mg|50 mg|75 mg|80 mg|40 mg|25 mg|10 mg|pediatricDosage|pediatricDose|pediatricUse|childDose|paediatricDosage|useInChildren|use_in_children|doseInChildren|dose_in_children|administrationInChildren|use_in_infants|minor_dosage'
     OR (SELECT content->>'dosage' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%'
     OR (SELECT content->>'dose' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%'
     OR (SELECT content->>'adultDosage' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%'
     OR (SELECT content->>'childSafety' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%Children should not take this product.%'
     OR (SELECT content->>'minorSideEffects' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%Minor side effects: mild nausea%'
     OR (SELECT content->>'additionalNotes' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%'
     OR (SELECT content->'nestedSection'->>'note' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%'
     OR (SELECT content->'fr'->>'dosage' FROM public.herb_pubmed_monographs_public WHERE slug = 'chamomile') NOT LIKE '%500 mg%' THEN
    RAISE EXCEPTION 'herb_pubmed_monographs_public recursive/key sanitization failed';
  END IF;
  IF jsonb_array_length(v_bundle->'faqs') <> 4
     OR (v_bundle->'monograph'->'drug_interactions')::text ~* '100 mg'
     OR (v_bundle->'faqs'->0->>'question') ~* '100 mg'
     OR (v_bundle->'faqs'->0->'translations'->'fr'->>'question') ~* '100 mg'
     OR (v_bundle->'faqs'->1->>'question') IS DISTINCT FROM 'Can children take chamomile?'
     OR (v_bundle->'faqs'->2->>'question') IS DISTINCT FROM 'Safety information'
     OR (v_bundle->'faqs'->2->>'answer') NOT LIKE '%Stop use and consult a healthcare professional%'
     OR (v_bundle->'faqs'->2->'translations'->'fr'->>'question') IS DISTINCT FROM 'Information de sécurité'
     OR (v_bundle->'faqs'->3->>'question') IS DISTINCT FROM 'Safety information'
     OR (v_bundle->'faqs'->3->>'answer') IS DISTINCT FROM ''
     OR (v_bundle->'faqs'->3->'translations'->'fr'->>'question') IS DISTINCT FROM 'Information de sécurité'
     OR (v_bundle->'faqs'->3->'translations'->'fr'->>'answer') NOT LIKE '%Cesser l''utilisation%'
     OR (v_bundle->'faqs'->3)::text ~* 'child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric'
     OR (v_bundle->'pubmed'->'content')::text ~* '100 mg|50 mg|75 mg|80 mg|pediatricDosage|pediatricDose|pediatricUse|childDose|paediatricDosage|useInChildren|use_in_children|doseInChildren|dose_in_children|administrationInChildren|use_in_infants|minor_dosage'
     OR (v_bundle->'pubmed'->'content'->>'adultDosage') NOT LIKE '%500 mg%'
     OR (v_bundle->'pubmed'->'content'->>'childSafety') NOT LIKE '%Children should not take this product.%'
     OR (v_bundle->'pubmed'->'content'->>'minorSideEffects') NOT LIKE '%Minor side effects: mild nausea%' THEN
    RAISE EXCEPTION 'herb_page_bundle leaked pediatric text in monograph.drug_interactions, faqs.question, or pubmed keys';
  END IF;

  -- M4: draft / unpublished herbs & draft PubMed sheets hidden from public views and bundle
  IF EXISTS (SELECT 1 FROM public.herbs_public WHERE slug = 'draft-unpublished-herb')
     OR EXISTS (SELECT 1 FROM public.herb_faqs_public WHERE herb_id = '33333333-3333-3333-3333-333333333339')
     OR EXISTS (SELECT 1 FROM public.herb_monographs_public WHERE herb_slug = 'draft-unpublished-herb')
     OR EXISTS (SELECT 1 FROM public.herb_regulatory_evidence_public WHERE herb_slug = 'draft-unpublished-herb')
     OR EXISTS (SELECT 1 FROM public.herb_monograph_sources_public WHERE herb_slug = 'draft-unpublished-herb')
     OR EXISTS (SELECT 1 FROM public.herb_pubmed_monographs_public WHERE slug IN ('draft-unpublished-herb', 'fennel'))
     OR (v_fennel_bundle->'pubmed') IS NOT NULL AND (v_fennel_bundle->>'pubmed') IS NOT NULL THEN
    RAISE EXCEPTION 'Public evidence views or bundle exposed unpublished herb or draft PubMed sheet';
  END IF;
END
$$;

-- 2) 00100: Verify anon cannot read herbs.dosage_child or insert dosage_calculations,
-- and authenticated users cannot insert <18 or clarks_rule/youngs_rule/bsa/fried_rule
DO $$
DECLARE
  v_err TEXT;
  v_view_child TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM dosage_child FROM public.herbs LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected herbs.dosage_child';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM answer FROM public.herb_faqs LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_faqs.answer post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM summary FROM public.herb_monographs LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_monographs.summary post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM doses FROM public.herb_regulatory_evidence LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_regulatory_evidence.doses post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM doses FROM public.herb_monograph_sources LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_monograph_sources.doses post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM claims FROM public.herb_monograph_sources LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_monograph_sources.claims post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM safety FROM public.herb_monograph_sources LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_monograph_sources.safety post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM purposes FROM public.herb_regulatory_evidence LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_regulatory_evidence.purposes post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM risks FROM public.herb_regulatory_evidence LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_regulatory_evidence.risks post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM content FROM public.herb_pubmed_monographs LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly selected raw herb_pubmed_monographs.content post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT dosage_child INTO v_view_child FROM public.herbs_public WHERE slug = 'chamomile';
  IF v_view_child IS NOT NULL THEN
    RAISE EXCEPTION 'herbs_public returned non-null dosage_child';
  END IF;
  IF (SELECT answer FROM public.herb_faqs_public LIMIT 1) ~* 'Children 6-12 years' THEN
    RAISE EXCEPTION 'herb_faqs_public leaked pediatric prose';
  END IF;
  IF (SELECT summary FROM public.herb_monographs_public LIMIT 1) ~* 'Give children 100 mg' THEN
    RAISE EXCEPTION 'herb_monographs_public leaked pediatric prose';
  END IF;

  BEGIN
    INSERT INTO public.dosage_calculations (patient_age, adult_dose, calculated_dose, formula_used)
    VALUES (30, '500 mg', '500 mg', 'adult_reference');
    RAISE EXCEPTION 'anon unexpectedly inserted into dosage_calculations';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  -- Authenticated regular user tests
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    PERFORM dosage_child FROM public.herbs LIMIT 1;
    RAISE EXCEPTION 'authenticated unexpectedly selected herbs.dosage_child';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.dosage_calculations (user_id, patient_age, adult_dose, calculated_dose, formula_used)
    VALUES ('11111111-1111-1111-1111-111111111111', 12, '500 mg', '500 mg', 'adult_reference');
    RAISE EXCEPTION 'authenticated minor calculation insert succeeded unexpectedly';
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.dosage_calculations (user_id, patient_age, adult_dose, calculated_dose, formula_used)
    VALUES ('11111111-1111-1111-1111-111111111111', 30, '500 mg', '500 mg', 'clarks_rule');
    RAISE EXCEPTION 'authenticated clarks_rule insert succeeded unexpectedly';
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN
    NULL;
  END;

  -- Valid adult_reference insert MUST succeed
  INSERT INTO public.dosage_calculations (user_id, patient_age, patient_weight_kg, adult_dose, calculated_dose, formula_used)
  VALUES ('11111111-1111-1111-1111-111111111111', 30, 70, '500 mg', '500 mg', 'adult_reference');

  RESET ROLE;
END
$$;

-- 3) 00102 Critical #1 & Important #11: AAL2 authenticated admin updates herbs clinical fields
-- -> must NOT fail with reviewed_at or RLS error, MUST reset last_reviewed/reviewed_by/provenance,
-- and MUST record clinical_content_revisions; view_count-only update must NOT reset or bloat revisions.
DO $$
DECLARE
  v_rev_by TEXT;
  v_last_rev TIMESTAMPTZ;
  v_rev_status TEXT;
  v_rev_count INT;
  v_rev_count_after_view INT;
BEGIN
  -- AAL1 admin must be blocked by 00097 policy
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.herbs SET description = 'Should not match RLS at AAL1' WHERE slug = 'chamomile';
  RESET ROLE;

  -- Confirm description was NOT changed at AAL1
  IF EXISTS (SELECT 1 FROM public.herbs WHERE slug = 'chamomile' AND description = 'Should not match RLS at AAL1') THEN
    RAISE EXCEPTION 'AAL1 admin unexpectedly updated herbs';
  END IF;

  -- Now AAL2 admin updates clinical field
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal2"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.herbs
  SET description = 'Updated clinical description requiring re-review.'
  WHERE slug = 'chamomile';
  RESET ROLE;

  SELECT reviewed_by, last_reviewed, provenance->>'review_status'
  INTO v_rev_by, v_last_rev, v_rev_status
  FROM public.herbs WHERE slug = 'chamomile';

  IF v_rev_by IS NOT NULL OR v_last_rev IS NOT NULL OR v_rev_status <> 'needs_re_review' THEN
    RAISE EXCEPTION 'Expected review reset on clinical edit, got reviewed_by=%, last_reviewed=%, status=%', v_rev_by, v_last_rev, v_rev_status;
  END IF;

  SELECT count(*) INTO v_rev_count
  FROM public.clinical_content_revisions WHERE record_slug = 'chamomile';
  IF v_rev_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 clinical_content_revisions row, got %', v_rev_count;
  END IF;

  -- view_count-only update must NOT add a revision row
  UPDATE public.herbs SET view_count = view_count + 1 WHERE slug = 'chamomile';
  SELECT count(*) INTO v_rev_count_after_view
  FROM public.clinical_content_revisions WHERE record_slug = 'chamomile';
  IF v_rev_count_after_view <> v_rev_count THEN
    RAISE EXCEPTION 'view_count-only update should not log clinical_content_revisions';
  END IF;
END
$$;

-- 4) 00101: Publication gate (including registered consented clinical reviewer FK/licence/expiry),
--    clinical edit reset, and citation retraction hold
DO $$
DECLARE
  v_status TEXT;
  v_rev_count INT;
BEGIN
  INSERT INTO public.reviewer_registry (
    reviewer_id, display_name, credentials, reviewer_role, consent_recorded, public_attribution_allowed, licence_number_verified, licence_jurisdiction, licence_expires_at, verified_at
  ) VALUES
    ('clinician-1', 'Dr. Clinical Verified', 'MD, CCFP', 'clinical', true, true, true, 'CPSO', CURRENT_DATE + 365, now()),
    ('unconsented-doc', 'Dr. Unconsented', 'MD', 'clinical', false, false, true, 'CPSO', CURRENT_DATE + 365, now()),
    ('unlicensed-doc', 'Dr. Unlicensed', 'MD', 'clinical', true, true, false, 'CPSO', CURRENT_DATE + 365, now()),
    ('expired-doc', 'Dr. Expired', 'MD', 'clinical', true, true, true, 'CPSO', CURRENT_DATE - 5, now()),
    ('editor-1', 'Editor One', 'MLT', 'editorial', true, true, false, NULL, NULL, now());

  -- Publishing without citation/reviewer/applicability must fail
  BEGIN
    UPDATE public.drug_interactions
    SET publication_status = 'published'
    WHERE id = '44444444-4444-4444-4444-444444444444';
    RAISE EXCEPTION 'Publishing interaction without gate prerequisites succeeded unexpectedly';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- Add active claim-supporting citation and satisfy publication contract
  INSERT INTO public.drug_interaction_citations (
    id, interaction_id, source_type, source_name, source_licence, url, claim_support_anchor, retraction_status
  ) VALUES (
    '77777777-7777-7777-7777-777777777771',
    '44444444-4444-4444-4444-444444444444',
    'regulatory_monograph',
    'NIH ODS',
    'us-federal-public-domain',
    'https://ods.od.nih.gov/factsheets/Chamomile-HealthProfessional/',
    'Coumarin constituents may potentiate warfarin anticoagulation.',
    'active'
  );

  -- Negative reviewer checks (arbitrary ID, editorial reviewer, unconsented, unlicensed, expired)
  BEGIN
    UPDATE public.drug_interactions
    SET botanical_applicability = 'oral_whole_herb_or_tea',
        clinical_reviewer_id = 'arbitrary-nonexistent-id',
        verified_at = now(),
        next_review_due_at = now() + interval '180 days',
        clinical_action_status = 'clinician_approved',
        publication_status = 'published'
    WHERE id = '44444444-4444-4444-4444-444444444444';
    RAISE EXCEPTION 'Arbitrary nonexistent clinical_reviewer_id succeeded unexpectedly';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN
    NULL;
  END;

  FOR v_status IN SELECT unnest(ARRAY['editor-1', 'unconsented-doc', 'unlicensed-doc', 'expired-doc']) LOOP
    BEGIN
      UPDATE public.drug_interactions
      SET botanical_applicability = 'oral_whole_herb_or_tea',
          clinical_reviewer_id = v_status,
          verified_at = now(),
          next_review_due_at = now() + interval '180 days',
          clinical_action_status = 'clinician_approved',
          publication_status = 'published'
      WHERE id = '44444444-4444-4444-4444-444444444444';
      RAISE EXCEPTION 'Ineligible reviewer % was allowed to publish drug_interaction', v_status;
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
  END LOOP;

  UPDATE public.drug_interactions
  SET
    botanical_applicability = 'oral_whole_herb_or_tea',
    clinical_reviewer_id = 'clinician-1',
    verified_at = now(),
    next_review_due_at = now() + interval '180 days',
    clinical_action_status = 'clinician_approved',
    pair_specific_clinical_action = 'Avoid unsupervised concurrent use; monitor INR if co-administered.',
    publication_status = 'published'
  WHERE id = '44444444-4444-4444-4444-444444444444';

  -- Editing description without updating verified_at must reset publication_status to draft
  UPDATE public.drug_interactions
  SET description = 'Modified clinical description without new sign-off.'
  WHERE id = '44444444-4444-4444-4444-444444444444';

  SELECT publication_status INTO v_status
  FROM public.drug_interactions WHERE id = '44444444-4444-4444-4444-444444444444';
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Expected publication_status reset to draft after clinical edit, got %', v_status;
  END IF;

  -- Re-publish, then retract citation -> must force retracted_hold
  UPDATE public.drug_interactions
  SET
    verified_at = now() + interval '1 second',
    clinical_reviewer_id = 'clinician-1',
    next_review_due_at = now() + interval '180 days',
    clinical_action_status = 'clinician_approved',
    publication_status = 'published'
  WHERE id = '44444444-4444-4444-4444-444444444444';

  UPDATE public.drug_interaction_citations
  SET retraction_status = 'retracted'
  WHERE id = '77777777-7777-7777-7777-777777777771';

  SELECT publication_status INTO v_status
  FROM public.drug_interactions WHERE id = '44444444-4444-4444-4444-444444444444';
  IF v_status <> 'retracted_hold' THEN
    RAISE EXCEPTION 'Expected retracted_hold when citation retracted, got %', v_status;
  END IF;

  SELECT count(*) INTO v_rev_count
  FROM public.drug_interaction_revisions WHERE interaction_record_id = '44444444-4444-4444-4444-444444444444';
  IF v_rev_count < 3 THEN
    RAISE EXCEPTION 'Expected multiple drug_interaction_revisions rows, got %', v_rev_count;
  END IF;
END
$$;

-- 5) 00102 & 00103: Reviewer policy gates, claim_citations role trigger, atomic incident RPC, and privacy consents RLS
DO $$
DECLARE
  v_visible INT;
  v_incident_id UUID;
  v_audit_count INT;
  v_consent_count INT;
BEGIN
  -- Mismatched reviewer_role on claim_citations must fail
  BEGIN
    INSERT INTO public.claim_citations (
      herb_slug, claim_key, source_type, source_name, source_licence, source_url, evidence_quality, reviewer_id, reviewer_role
    ) VALUES (
      'chamomile', 'sleep', 'clinical_study', 'PubMed', 'us-federal-public-domain', 'https://pubmed.ncbi.nlm.nih.gov/12345/', 'moderate', 'editor-1', 'clinical'
    );
    RAISE EXCEPTION 'Mismatched reviewer_role in claim_citations succeeded unexpectedly';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO v_visible FROM public.reviewer_registry;
  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'Expected only consented active clinician-1 and editor-1 (2 rows) visible to anon, got %', v_visible;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reviewer_registry WHERE reviewer_id IN ('unconsented-doc', 'unlicensed-doc', 'expired-doc')
  ) THEN
    RAISE EXCEPTION 'Unconsented, unlicensed, or expired reviewer exposed to anon';
  END IF;
  RESET ROLE;

  -- Atomic safety incident RPC (8 exact parameters, no p_note):
  -- denied to anon/authenticated, allowed to service_role
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM public.create_safety_incident_with_audit(
      'pediatric_safety', 'high', 'https://herbally.app/en/calculator',
      'Unauthorized test', 'Details', 'open_triage', now() + interval '72 hours', 'public_intake'
    );
    RAISE EXCEPTION 'anon unexpectedly executed create_safety_incident_with_audit';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT public.create_safety_incident_with_audit(
    'pediatric_safety',
    'high',
    'https://herbally.app/en/calculator',
    'Test safety report',
    'Details without PHI',
    'open_triage',
    now() + interval '72 hours',
    'public_intake'
  ) INTO v_incident_id;
  RESET ROLE;

  SELECT count(*) INTO v_audit_count
  FROM public.safety_incident_audit_log WHERE incident_id = v_incident_id;
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected atomic audit log row for incident %, got %', v_incident_id, v_audit_count;
  END IF;
  DELETE FROM public.safety_incidents WHERE id = v_incident_id;

  -- 00103 user_privacy_consents RLS isolation & disallowed research_analytics scope check
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.user_privacy_consents (user_id, consent_scope, granted, granted_at)
  VALUES ('11111111-1111-1111-1111-111111111111', 'dosage_history', true, now());
  BEGIN
    INSERT INTO public.user_privacy_consents (user_id, consent_scope, granted, granted_at)
    VALUES ('11111111-1111-1111-1111-111111111111', 'research_analytics', true, now());
    RAISE EXCEPTION 'Disallowed research_analytics consent_scope succeeded unexpectedly';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.user_privacy_consents (user_id, consent_scope, granted, granted_at)
    VALUES ('22222222-2222-2222-2222-222222222222', 'health_profile', true, now());
    RAISE EXCEPTION 'Cross-user user_privacy_consents insert succeeded unexpectedly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  SELECT count(*) INTO v_consent_count FROM public.user_privacy_consents;
  IF v_consent_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 own consent row visible, got %', v_consent_count;
  END IF;
  RESET ROLE;
END
$$;

-- 6) Post-00104 admin CRUD verification:
--    - service_role must be non-superuser with real table/sequence privileges (not superuser bypass)
--    - authenticated AAL2 admin RETURNING revoked prose column raises insufficient_privilege
--    - service_role (used by admin-herbs.ts after getAdminAccess() check) succeeds on
--      raw SELECT across all 6 contracted tables, INSERT ... RETURNING, UPDATE ... RETURNING
--      (firing review reset & audit triggers), DELETE, and safety_incidents CRUD.
DO $$
DECLARE
  v_admin_herb_id UUID;
  v_returned_desc TEXT;
  v_returned_slug TEXT;
  v_is_super BOOLEAN;
  v_bypass_rls BOOLEAN;
  v_inc_id UUID;
  v_review_status TEXT;
BEGIN
  SELECT rolsuper, rolbypassrls INTO v_is_super, v_bypass_rls
  FROM pg_roles WHERE rolname = 'service_role';
  IF v_is_super THEN
    RAISE EXCEPTION 'service_role must be non-superuser so table/sequence grants are meaningfully tested';
  END IF;
  IF NOT v_bypass_rls THEN
    RAISE EXCEPTION 'service_role must have BYPASSRLS';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.herbs (name, slug, scientific_name, description, dosage_adult, is_published)
    VALUES ('Temp Auth Herb', 'temp-auth-herb', 'Temp botanical', 'Should fail returning.', '100 mg', false)
    RETURNING description INTO v_returned_desc;
    RAISE EXCEPTION 'authenticated admin unexpectedly returned revoked herbs.description post-00104';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  EXECUTE 'SET LOCAL ROLE service_role';
  -- Verify service_role retains raw SELECT on all 6 contracted tables
  PERFORM dosage_child FROM public.herbs LIMIT 1;
  PERFORM question FROM public.herb_faqs LIMIT 1;
  PERFORM drug_interactions FROM public.herb_monographs LIMIT 1;
  PERFORM doses FROM public.herb_regulatory_evidence LIMIT 1;
  PERFORM claims FROM public.herb_monograph_sources LIMIT 1;
  PERFORM content FROM public.herb_pubmed_monographs LIMIT 1;

  INSERT INTO public.herbs (
    name, slug, scientific_name, description, dosage_adult, is_published, reviewed_by, last_reviewed
  ) VALUES (
    'Post-Contract Admin Herb',
    'post-contract-admin-herb',
    'Ocimum tenuiflorum',
    'Created post-00104 via service_role after getAdminAccess().',
    '300 mg daily',
    true,
    'yasser-bheekun',
    now()
  )
  RETURNING id, slug, description INTO v_admin_herb_id, v_returned_slug, v_returned_desc;

  IF v_admin_herb_id IS NULL OR v_returned_slug <> 'post-contract-admin-herb' THEN
    RAISE EXCEPTION 'service_role post-00104 INSERT RETURNING failed';
  END IF;

  UPDATE public.herbs
  SET description = 'Updated post-00104 clinical description.'
  WHERE id = v_admin_herb_id
  RETURNING description, provenance->>'review_status' INTO v_returned_desc, v_review_status;

  IF v_returned_desc <> 'Updated post-00104 clinical description.' THEN
    RAISE EXCEPTION 'service_role post-00104 UPDATE RETURNING failed';
  END IF;
  IF v_review_status <> 'needs_re_review' THEN
    RAISE EXCEPTION 'Expected needs_re_review after clinical edit, got %', v_review_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_content_revisions
    WHERE record_slug = 'post-contract-admin-herb'
  ) THEN
    RAISE EXCEPTION 'Expected clinical_content_revisions row for service_role admin edit';
  END IF;

  DELETE FROM public.herbs WHERE id = v_admin_herb_id;

  -- Verify service_role CRUD on safety_incidents + safety_incident_audit_log
  INSERT INTO public.safety_incidents (
    category, severity, surface_url, summary, details, triage_status, sla_due_at
  ) VALUES (
    'pediatric_safety', 'high', 'https://herbally.app/en/calculator',
    'Service role CRUD check', 'Details', 'open_triage', now() + interval '72 hours'
  )
  RETURNING id INTO v_inc_id;
  INSERT INTO public.safety_incident_audit_log (incident_id, actor, action, note)
  VALUES (v_inc_id, 'service_role_test', 'created', 'smoke');
  PERFORM * FROM public.safety_incident_audit_log WHERE incident_id = v_inc_id;
  DELETE FROM public.safety_incidents WHERE id = v_inc_id;
  RESET ROLE;
END
$$;
