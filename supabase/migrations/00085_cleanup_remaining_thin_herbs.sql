-- 00085_cleanup_remaining_thin_herbs.sql
-- Merge 19 remaining thin taxonomic synonyms into canonical herb pages and
-- cleanly unpublish 26 distinct unsourced thin stubs (bringing raw_sub < 400 to 0).

BEGIN;

-- Merge anatherum-muricatum -> vetiver
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Anatherum muricatum']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'anatherum-muricatum' AND dst.slug = 'vetiver' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'vetiver', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'anatherum-muricatum' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'anatherum-muricatum';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'vetiver'
  WHERE herb_slug = 'anatherum-muricatum' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'vetiver');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'anatherum-muricatum';
UPDATE public.herb_pubmed_monographs SET slug = 'vetiver'
  WHERE slug = 'anatherum-muricatum' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'vetiver');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'anatherum-muricatum';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'vetiver'), herb_slug = 'vetiver'
  WHERE herb_slug = 'anatherum-muricatum' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'vetiver');
DELETE FROM public.herb_monographs WHERE herb_slug = 'anatherum-muricatum';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'anatherum-muricatum')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'vetiver')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'vetiver')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'anatherum-muricatum');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'vetiver') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'anatherum-muricatum')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'anatherum-muricatum');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'anatherum-muricatum' AND is_published;

-- Merge aralia-quinquefolia -> american-ginseng
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Aralia quinquefolia']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'aralia-quinquefolia' AND dst.slug = 'american-ginseng' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'american-ginseng', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'aralia-quinquefolia' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'aralia-quinquefolia';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'american-ginseng'
  WHERE herb_slug = 'aralia-quinquefolia' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'american-ginseng');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'aralia-quinquefolia';
UPDATE public.herb_pubmed_monographs SET slug = 'american-ginseng'
  WHERE slug = 'aralia-quinquefolia' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'american-ginseng');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'aralia-quinquefolia';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'american-ginseng'), herb_slug = 'american-ginseng'
  WHERE herb_slug = 'aralia-quinquefolia' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'american-ginseng');
DELETE FROM public.herb_monographs WHERE herb_slug = 'aralia-quinquefolia';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'aralia-quinquefolia')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'american-ginseng')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'american-ginseng')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'aralia-quinquefolia');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'american-ginseng') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'aralia-quinquefolia')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'aralia-quinquefolia');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'aralia-quinquefolia' AND is_published;

-- Merge bambusa-breviflora -> bambusa-tuldoides
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Bambusa breviflora']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'bambusa-breviflora' AND dst.slug = 'bambusa-tuldoides' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'bambusa-tuldoides', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'bambusa-breviflora' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'bambusa-breviflora';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'bambusa-tuldoides'
  WHERE herb_slug = 'bambusa-breviflora' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'bambusa-tuldoides');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'bambusa-breviflora';
UPDATE public.herb_pubmed_monographs SET slug = 'bambusa-tuldoides'
  WHERE slug = 'bambusa-breviflora' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'bambusa-tuldoides');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'bambusa-breviflora';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-tuldoides'), herb_slug = 'bambusa-tuldoides'
  WHERE herb_slug = 'bambusa-breviflora' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'bambusa-tuldoides');
DELETE FROM public.herb_monographs WHERE herb_slug = 'bambusa-breviflora';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-breviflora')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-tuldoides')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-tuldoides')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-breviflora');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'bambusa-tuldoides') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-breviflora')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'bambusa-breviflora');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'bambusa-breviflora' AND is_published;

-- Merge centaurium-umbellatum -> centaury-european
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Centaurium umbellatum']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'centaurium-umbellatum' AND dst.slug = 'centaury-european' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'centaury-european', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'centaurium-umbellatum' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'centaurium-umbellatum';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'centaury-european'
  WHERE herb_slug = 'centaurium-umbellatum' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'centaury-european');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'centaurium-umbellatum';
UPDATE public.herb_pubmed_monographs SET slug = 'centaury-european'
  WHERE slug = 'centaurium-umbellatum' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'centaury-european');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'centaurium-umbellatum';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaury-european'), herb_slug = 'centaury-european'
  WHERE herb_slug = 'centaurium-umbellatum' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'centaury-european');
DELETE FROM public.herb_monographs WHERE herb_slug = 'centaurium-umbellatum';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaurium-umbellatum')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaury-european')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaury-european')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaurium-umbellatum');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'centaury-european') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaurium-umbellatum')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'centaurium-umbellatum');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'centaurium-umbellatum' AND is_published;

-- Merge cocculus-indicus -> anamirta-cocculus
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Cocculus indicus']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'cocculus-indicus' AND dst.slug = 'anamirta-cocculus' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'anamirta-cocculus', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'cocculus-indicus' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'cocculus-indicus';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'anamirta-cocculus'
  WHERE herb_slug = 'cocculus-indicus' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'anamirta-cocculus');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'cocculus-indicus';
UPDATE public.herb_pubmed_monographs SET slug = 'anamirta-cocculus'
  WHERE slug = 'cocculus-indicus' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'anamirta-cocculus');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'cocculus-indicus';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'anamirta-cocculus'), herb_slug = 'anamirta-cocculus'
  WHERE herb_slug = 'cocculus-indicus' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'anamirta-cocculus');
DELETE FROM public.herb_monographs WHERE herb_slug = 'cocculus-indicus';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'cocculus-indicus')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'anamirta-cocculus')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'anamirta-cocculus')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'cocculus-indicus');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'anamirta-cocculus') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'cocculus-indicus')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'cocculus-indicus');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'cocculus-indicus' AND is_published;

-- Merge copaiva-officinalis -> bolivian-copaiba
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Copaiva officinalis']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'copaiva-officinalis' AND dst.slug = 'bolivian-copaiba' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'bolivian-copaiba', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'copaiva-officinalis' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'copaiva-officinalis';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'bolivian-copaiba'
  WHERE herb_slug = 'copaiva-officinalis' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'bolivian-copaiba');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'copaiva-officinalis';
UPDATE public.herb_pubmed_monographs SET slug = 'bolivian-copaiba'
  WHERE slug = 'copaiva-officinalis' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'bolivian-copaiba');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'copaiva-officinalis';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'bolivian-copaiba'), herb_slug = 'bolivian-copaiba'
  WHERE herb_slug = 'copaiva-officinalis' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'bolivian-copaiba');
DELETE FROM public.herb_monographs WHERE herb_slug = 'copaiva-officinalis';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'copaiva-officinalis')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'bolivian-copaiba')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'bolivian-copaiba')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'copaiva-officinalis');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'bolivian-copaiba') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'copaiva-officinalis')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'copaiva-officinalis');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'copaiva-officinalis' AND is_published;

-- Merge elymus-repens-subsp-repens -> couch-grass
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Elymus repens subsp. repens']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'elymus-repens-subsp-repens' AND dst.slug = 'couch-grass' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'couch-grass', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'elymus-repens-subsp-repens' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'elymus-repens-subsp-repens';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'couch-grass'
  WHERE herb_slug = 'elymus-repens-subsp-repens' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'couch-grass');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'elymus-repens-subsp-repens';
UPDATE public.herb_pubmed_monographs SET slug = 'couch-grass'
  WHERE slug = 'elymus-repens-subsp-repens' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'couch-grass');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'elymus-repens-subsp-repens';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'couch-grass'), herb_slug = 'couch-grass'
  WHERE herb_slug = 'elymus-repens-subsp-repens' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'couch-grass');
DELETE FROM public.herb_monographs WHERE herb_slug = 'elymus-repens-subsp-repens';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'elymus-repens-subsp-repens')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'couch-grass')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'couch-grass')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'elymus-repens-subsp-repens');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'couch-grass') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'elymus-repens-subsp-repens')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'elymus-repens-subsp-repens');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'elymus-repens-subsp-repens' AND is_published;

-- Merge eugenia-jambosa -> syzygium-jambos
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Eugenia jambosa']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'eugenia-jambosa' AND dst.slug = 'syzygium-jambos' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'syzygium-jambos', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'eugenia-jambosa' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'eugenia-jambosa';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'syzygium-jambos'
  WHERE herb_slug = 'eugenia-jambosa' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'syzygium-jambos');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'eugenia-jambosa';
UPDATE public.herb_pubmed_monographs SET slug = 'syzygium-jambos'
  WHERE slug = 'eugenia-jambosa' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'syzygium-jambos');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'eugenia-jambosa';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'syzygium-jambos'), herb_slug = 'syzygium-jambos'
  WHERE herb_slug = 'eugenia-jambosa' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'syzygium-jambos');
DELETE FROM public.herb_monographs WHERE herb_slug = 'eugenia-jambosa';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'eugenia-jambosa')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'syzygium-jambos')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'syzygium-jambos')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'eugenia-jambosa');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'syzygium-jambos') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'eugenia-jambosa')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'eugenia-jambosa');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'eugenia-jambosa' AND is_published;

-- Merge guarea-trichilioides -> guarea-guidonia
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Guarea trichilioides']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'guarea-trichilioides' AND dst.slug = 'guarea-guidonia' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'guarea-guidonia', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'guarea-trichilioides' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'guarea-trichilioides';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'guarea-guidonia'
  WHERE herb_slug = 'guarea-trichilioides' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'guarea-guidonia');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'guarea-trichilioides';
UPDATE public.herb_pubmed_monographs SET slug = 'guarea-guidonia'
  WHERE slug = 'guarea-trichilioides' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'guarea-guidonia');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'guarea-trichilioides';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-guidonia'), herb_slug = 'guarea-guidonia'
  WHERE herb_slug = 'guarea-trichilioides' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'guarea-guidonia');
DELETE FROM public.herb_monographs WHERE herb_slug = 'guarea-trichilioides';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-trichilioides')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-guidonia')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-guidonia')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-trichilioides');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'guarea-guidonia') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-trichilioides')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'guarea-trichilioides');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'guarea-trichilioides' AND is_published;

-- Merge jonesia-asoca -> ashoka-tree
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Jonesia asoca']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'jonesia-asoca' AND dst.slug = 'ashoka-tree' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'ashoka-tree', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'jonesia-asoca' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'jonesia-asoca';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'ashoka-tree'
  WHERE herb_slug = 'jonesia-asoca' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'ashoka-tree');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'jonesia-asoca';
UPDATE public.herb_pubmed_monographs SET slug = 'ashoka-tree'
  WHERE slug = 'jonesia-asoca' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'ashoka-tree');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'jonesia-asoca';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'ashoka-tree'), herb_slug = 'ashoka-tree'
  WHERE herb_slug = 'jonesia-asoca' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'ashoka-tree');
DELETE FROM public.herb_monographs WHERE herb_slug = 'jonesia-asoca';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'jonesia-asoca')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'ashoka-tree')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'ashoka-tree')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'jonesia-asoca');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'ashoka-tree') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'jonesia-asoca')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'jonesia-asoca');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'jonesia-asoca' AND is_published;

-- Merge lappa-major -> burdock-seed
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Lappa major']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'lappa-major' AND dst.slug = 'burdock-seed' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'burdock-seed', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'lappa-major' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'lappa-major';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'burdock-seed'
  WHERE herb_slug = 'lappa-major' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'burdock-seed');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'lappa-major';
UPDATE public.herb_pubmed_monographs SET slug = 'burdock-seed'
  WHERE slug = 'lappa-major' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'burdock-seed');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'lappa-major';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'burdock-seed'), herb_slug = 'burdock-seed'
  WHERE herb_slug = 'lappa-major' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'burdock-seed');
DELETE FROM public.herb_monographs WHERE herb_slug = 'lappa-major';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'lappa-major')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'burdock-seed')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'burdock-seed')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'lappa-major');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'burdock-seed') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'lappa-major')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'lappa-major');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'lappa-major' AND is_published;

-- Merge malpighia-punicifolia -> malpighia-emarginata
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Malpighia punicifolia']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'malpighia-punicifolia' AND dst.slug = 'malpighia-emarginata' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'malpighia-emarginata', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'malpighia-punicifolia' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'malpighia-punicifolia';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'malpighia-emarginata'
  WHERE herb_slug = 'malpighia-punicifolia' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'malpighia-emarginata');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'malpighia-punicifolia';
UPDATE public.herb_pubmed_monographs SET slug = 'malpighia-emarginata'
  WHERE slug = 'malpighia-punicifolia' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'malpighia-emarginata');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'malpighia-punicifolia';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-emarginata'), herb_slug = 'malpighia-emarginata'
  WHERE herb_slug = 'malpighia-punicifolia' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'malpighia-emarginata');
DELETE FROM public.herb_monographs WHERE herb_slug = 'malpighia-punicifolia';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-punicifolia')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-emarginata')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-emarginata')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-punicifolia');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'malpighia-emarginata') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-punicifolia')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'malpighia-punicifolia');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'malpighia-punicifolia' AND is_published;

-- Merge mesostemma-dichotomum-var-lanceolatum -> stellaria-dichotoma-var-lanceolata
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Mesostemma dichotomum var. lanceolatum']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'mesostemma-dichotomum-var-lanceolatum' AND dst.slug = 'stellaria-dichotoma-var-lanceolata' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'stellaria-dichotoma-var-lanceolata', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'stellaria-dichotoma-var-lanceolata'
  WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'stellaria-dichotoma-var-lanceolata');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum';
UPDATE public.herb_pubmed_monographs SET slug = 'stellaria-dichotoma-var-lanceolata'
  WHERE slug = 'mesostemma-dichotomum-var-lanceolatum' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'stellaria-dichotoma-var-lanceolata');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'mesostemma-dichotomum-var-lanceolatum';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'stellaria-dichotoma-var-lanceolata'), herb_slug = 'stellaria-dichotoma-var-lanceolata'
  WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'stellaria-dichotoma-var-lanceolata');
DELETE FROM public.herb_monographs WHERE herb_slug = 'mesostemma-dichotomum-var-lanceolatum';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'mesostemma-dichotomum-var-lanceolatum')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'stellaria-dichotoma-var-lanceolata')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'stellaria-dichotoma-var-lanceolata')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'mesostemma-dichotomum-var-lanceolatum');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'stellaria-dichotoma-var-lanceolata') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'mesostemma-dichotomum-var-lanceolatum')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'mesostemma-dichotomum-var-lanceolatum');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'mesostemma-dichotomum-var-lanceolatum' AND is_published;

-- Merge plantago-afra -> plantago-psyllium
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Plantago afra']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'plantago-afra' AND dst.slug = 'plantago-psyllium' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'plantago-psyllium', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'plantago-afra' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'plantago-afra';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'plantago-psyllium'
  WHERE herb_slug = 'plantago-afra' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'plantago-psyllium');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'plantago-afra';
UPDATE public.herb_pubmed_monographs SET slug = 'plantago-psyllium'
  WHERE slug = 'plantago-afra' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'plantago-psyllium');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'plantago-afra';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-psyllium'), herb_slug = 'plantago-psyllium'
  WHERE herb_slug = 'plantago-afra' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'plantago-psyllium');
DELETE FROM public.herb_monographs WHERE herb_slug = 'plantago-afra';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-afra')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-psyllium')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-psyllium')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-afra');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'plantago-psyllium') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-afra')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'plantago-afra');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'plantago-afra' AND is_published;

-- Merge selinum-striatum -> szechuan-lovage
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Selinum striatum']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'selinum-striatum' AND dst.slug = 'szechuan-lovage' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'szechuan-lovage', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'selinum-striatum' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'selinum-striatum';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'szechuan-lovage'
  WHERE herb_slug = 'selinum-striatum' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'szechuan-lovage');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'selinum-striatum';
UPDATE public.herb_pubmed_monographs SET slug = 'szechuan-lovage'
  WHERE slug = 'selinum-striatum' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'szechuan-lovage');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'selinum-striatum';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'szechuan-lovage'), herb_slug = 'szechuan-lovage'
  WHERE herb_slug = 'selinum-striatum' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'szechuan-lovage');
DELETE FROM public.herb_monographs WHERE herb_slug = 'selinum-striatum';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'selinum-striatum')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'szechuan-lovage')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'szechuan-lovage')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'selinum-striatum');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'szechuan-lovage') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'selinum-striatum')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'selinum-striatum');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'selinum-striatum' AND is_published;

-- Merge sorbus-aucuparia-subsp-aucuparia -> sorbus-aucuparia-herb
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Sorbus aucuparia subsp. aucuparia']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'sorbus-aucuparia-subsp-aucuparia' AND dst.slug = 'sorbus-aucuparia-herb' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'sorbus-aucuparia-herb', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'sorbus-aucuparia-herb'
  WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'sorbus-aucuparia-herb');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia';
UPDATE public.herb_pubmed_monographs SET slug = 'sorbus-aucuparia-herb'
  WHERE slug = 'sorbus-aucuparia-subsp-aucuparia' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'sorbus-aucuparia-herb');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'sorbus-aucuparia-subsp-aucuparia';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-herb'), herb_slug = 'sorbus-aucuparia-herb'
  WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'sorbus-aucuparia-herb');
DELETE FROM public.herb_monographs WHERE herb_slug = 'sorbus-aucuparia-subsp-aucuparia';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-subsp-aucuparia')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-herb')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-herb')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-subsp-aucuparia');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-herb') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-subsp-aucuparia')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'sorbus-aucuparia-subsp-aucuparia');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'sorbus-aucuparia-subsp-aucuparia' AND is_published;

-- Merge sterculia-acuminata -> jamaican-bissy
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Sterculia acuminata']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'sterculia-acuminata' AND dst.slug = 'jamaican-bissy' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'jamaican-bissy', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'sterculia-acuminata' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'sterculia-acuminata';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'jamaican-bissy'
  WHERE herb_slug = 'sterculia-acuminata' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'jamaican-bissy');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'sterculia-acuminata';
UPDATE public.herb_pubmed_monographs SET slug = 'jamaican-bissy'
  WHERE slug = 'sterculia-acuminata' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'jamaican-bissy');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'sterculia-acuminata';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'jamaican-bissy'), herb_slug = 'jamaican-bissy'
  WHERE herb_slug = 'sterculia-acuminata' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'jamaican-bissy');
DELETE FROM public.herb_monographs WHERE herb_slug = 'sterculia-acuminata';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'sterculia-acuminata')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'jamaican-bissy')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'jamaican-bissy')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'sterculia-acuminata');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'jamaican-bissy') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'sterculia-acuminata')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'sterculia-acuminata');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'sterculia-acuminata' AND is_published;

-- Merge symphoricarpus-racemosus -> symphoricarpos-albus-herb
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Symphoricarpos racemosus']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'symphoricarpus-racemosus' AND dst.slug = 'symphoricarpos-albus-herb' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'symphoricarpos-albus-herb', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'symphoricarpus-racemosus' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'symphoricarpus-racemosus';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'symphoricarpos-albus-herb'
  WHERE herb_slug = 'symphoricarpus-racemosus' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'symphoricarpos-albus-herb');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'symphoricarpus-racemosus';
UPDATE public.herb_pubmed_monographs SET slug = 'symphoricarpos-albus-herb'
  WHERE slug = 'symphoricarpus-racemosus' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'symphoricarpos-albus-herb');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'symphoricarpus-racemosus';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpos-albus-herb'), herb_slug = 'symphoricarpos-albus-herb'
  WHERE herb_slug = 'symphoricarpus-racemosus' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'symphoricarpos-albus-herb');
DELETE FROM public.herb_monographs WHERE herb_slug = 'symphoricarpus-racemosus';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpus-racemosus')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpos-albus-herb')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpos-albus-herb')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpus-racemosus');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'symphoricarpos-albus-herb') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpus-racemosus')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'symphoricarpus-racemosus');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'symphoricarpus-racemosus' AND is_published;

-- Merge thlaspi-bursa-pastoris -> capsella-bursa-pastoris-herb
UPDATE public.herbs dst SET
  view_count = COALESCE(dst.view_count, 0) + COALESCE(src.view_count, 0),
  common_names = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(dst.common_names, ARRAY[]::text[]) || ARRAY['Thlaspi bursa-pastoris']::text[]) AS x WHERE x IS NOT NULL AND x <> ''),
  updated_at = now()
FROM public.herbs src
WHERE src.slug = 'thlaspi-bursa-pastoris' AND dst.slug = 'capsella-bursa-pastoris-herb' AND src.is_published = true;
INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at)
  SELECT 'capsella-bursa-pastoris-herb', source, licence, attribution, url, claims, safety, doses, generation_method, monograph_date, retrieved_at
  FROM public.herb_monograph_sources WHERE herb_slug = 'thlaspi-bursa-pastoris' ON CONFLICT (herb_slug, source) DO NOTHING;
DELETE FROM public.herb_monograph_sources WHERE herb_slug = 'thlaspi-bursa-pastoris';
UPDATE public.herb_regulatory_evidence SET herb_slug = 'capsella-bursa-pastoris-herb'
  WHERE herb_slug = 'thlaspi-bursa-pastoris' AND NOT EXISTS (SELECT 1 FROM public.herb_regulatory_evidence k WHERE k.herb_slug = 'capsella-bursa-pastoris-herb');
DELETE FROM public.herb_regulatory_evidence WHERE herb_slug = 'thlaspi-bursa-pastoris';
UPDATE public.herb_pubmed_monographs SET slug = 'capsella-bursa-pastoris-herb'
  WHERE slug = 'thlaspi-bursa-pastoris' AND NOT EXISTS (SELECT 1 FROM public.herb_pubmed_monographs k WHERE k.slug = 'capsella-bursa-pastoris-herb');
DELETE FROM public.herb_pubmed_monographs WHERE slug = 'thlaspi-bursa-pastoris';
UPDATE public.herb_monographs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'capsella-bursa-pastoris-herb'), herb_slug = 'capsella-bursa-pastoris-herb'
  WHERE herb_slug = 'thlaspi-bursa-pastoris' AND NOT EXISTS (SELECT 1 FROM public.herb_monographs k WHERE k.herb_slug = 'capsella-bursa-pastoris-herb');
DELETE FROM public.herb_monographs WHERE herb_slug = 'thlaspi-bursa-pastoris';
DELETE FROM public.herb_faqs d USING public.herb_faqs k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'thlaspi-bursa-pastoris')
    AND k.herb_id = (SELECT id FROM public.herbs WHERE slug = 'capsella-bursa-pastoris-herb')
    AND d.question = k.question;
UPDATE public.herb_faqs SET herb_id = (SELECT id FROM public.herbs WHERE slug = 'capsella-bursa-pastoris-herb')
  WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'thlaspi-bursa-pastoris');
INSERT INTO public.drug_interactions (herb_id, drug_name, rxcui, severity, description, mechanism, evidence_level, source, source_url, translations, evidence_note)
  SELECT k.id, d.drug_name, d.rxcui, d.severity, d.description, d.mechanism, d.evidence_level, d.source, d.source_url, d.translations, d.evidence_note
  FROM public.drug_interactions d CROSS JOIN (SELECT id FROM public.herbs WHERE slug = 'capsella-bursa-pastoris-herb') k
  WHERE d.herb_id = (SELECT id FROM public.herbs WHERE slug = 'thlaspi-bursa-pastoris')
    AND NOT EXISTS (SELECT 1 FROM public.drug_interactions e WHERE e.herb_id = k.id AND lower(e.drug_name) = lower(d.drug_name));
DELETE FROM public.drug_interactions WHERE herb_id = (SELECT id FROM public.herbs WHERE slug = 'thlaspi-bursa-pastoris');
UPDATE public.herbs SET is_published = false, updated_at = now() WHERE slug = 'thlaspi-bursa-pastoris' AND is_published;

-- Unpublish 26 distinct unsourced thin stubs (noindex, no canonical duplicate)
UPDATE public.herbs
SET is_published = false, updated_at = now()
WHERE slug IN (
  'achyranthes-longifolia',
  'anacardium-orientale',
  'caladium-seguinum',
  'cephalostachyum-chinense',
  'cereus-bonplandii',
  'cicuta-maculata',
  'cistus-canadensis',
  'comocladia-dentata',
  'cornus-circinata',
  'cota-triumfettii',
  'delairea-odorata',
  'erythroxylum-catuaba',
  'gasteria-acinacifolia',
  'hemionitis-ludens',
  'hura-brasiliensis',
  'leucopogon-fasciculatus',
  'lophophytum-leandri',
  'mesophyllum-superpositum',
  'myristica-sebifera',
  'phellandrium-aquaticum',
  'pothos-foetidus',
  'primula-obconica',
  'schoepfia-chinensis',
  'scleranthus-annuus',
  'sequoia-gigantea',
  'vincetoxicum-bungei'
) AND is_published;

-- Remove stale precomputed bundles for all 45 retired slugs
DELETE FROM public.herb_page_bundles WHERE slug IN (
  'anatherum-muricatum',
  'aralia-quinquefolia',
  'bambusa-breviflora',
  'centaurium-umbellatum',
  'cocculus-indicus',
  'copaiva-officinalis',
  'elymus-repens-subsp-repens',
  'eugenia-jambosa',
  'guarea-trichilioides',
  'jonesia-asoca',
  'lappa-major',
  'malpighia-punicifolia',
  'mesostemma-dichotomum-var-lanceolatum',
  'plantago-afra',
  'selinum-striatum',
  'sorbus-aucuparia-subsp-aucuparia',
  'sterculia-acuminata',
  'symphoricarpus-racemosus',
  'thlaspi-bursa-pastoris',
  'achyranthes-longifolia',
  'anacardium-orientale',
  'caladium-seguinum',
  'cephalostachyum-chinense',
  'cereus-bonplandii',
  'cicuta-maculata',
  'cistus-canadensis',
  'comocladia-dentata',
  'cornus-circinata',
  'cota-triumfettii',
  'delairea-odorata',
  'erythroxylum-catuaba',
  'gasteria-acinacifolia',
  'hemionitis-ludens',
  'hura-brasiliensis',
  'leucopogon-fasciculatus',
  'lophophytum-leandri',
  'mesophyllum-superpositum',
  'myristica-sebifera',
  'phellandrium-aquaticum',
  'pothos-foetidus',
  'primula-obconica',
  'schoepfia-chinensis',
  'scleranthus-annuus',
  'sequoia-gigantea',
  'vincetoxicum-bungei'
);

DELETE FROM public.herb_bundle_dirty d USING public.herbs h
  WHERE d.slug = h.slug AND h.is_published = false;

COMMIT;
