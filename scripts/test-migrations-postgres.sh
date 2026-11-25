#!/usr/bin/env bash
# Targeted PG16 Migration Fixture (00097–00104 over pre-00097 schema subset).
# NOTE: This fixture creates a targeted baseline subset of pre-00097 tables,
# NOT a full replay from migration 00001 (see test-full-migration-replay.sh for
# full-chain fresh-install verification).
#
# Execution sequence:
#   1. Seed baseline rows (including categories, pediatric leakage, bulk 00079 provenance,
#      FAQs, monographs, real senna/fennel source fixtures, and lethal herb fixture)
#   2. Apply expand phase (00097–00103) and run old-image-expand-compat.sql (reads + writes)
#   3. Apply contract phase (00104)
#   4. Re-apply expand + contract (pass 2: idempotency check)
#   5. Copy DB to disposable ${PGDATABASE}_rollback, execute real rollback-00104-contract.sql
#      + old-image compat verification, re-apply 00104 contract, and run integration tests
#   6. Verify main ${PGDATABASE} post-00104 contract + run clinical-safety-integration.sql

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-herbally_test}"
DATABASE_URL="${DATABASE_URL:-postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}}"

echo "==> Bootstrapping disposable Postgres test database"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT
);
GRANT SELECT ON TABLE auth.users TO service_role;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- Pre-00097 baseline schema subset required by 00097–00104
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.interaction_severity AS ENUM ('mild', 'moderate', 'severe', 'contraindicated');
CREATE TYPE public.dosage_form AS ENUM (
  'capsule', 'tablet', 'tincture', 'tea', 'powder',
  'essential_oil', 'extract', 'topical', 'other'
);
CREATE TYPE public.formula_type AS ENUM ('clarks_rule', 'youngs_rule', 'bsa', 'fried_rule');

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'user',
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

CREATE TABLE public.herb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  name_fr TEXT,
  description_fr TEXT,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.herb_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_categories TO anon, authenticated;
CREATE POLICY "Anyone can view categories" ON public.herb_categories FOR SELECT USING (true);

CREATE TABLE public.herbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  scientific_name TEXT NOT NULL,
  common_names TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  active_compounds TEXT[] DEFAULT '{}',
  traditional_uses TEXT[] DEFAULT '{}',
  modern_uses TEXT[] DEFAULT '{}',
  dosage_adult TEXT,
  dosage_child TEXT,
  dosage_forms public.dosage_form[] DEFAULT '{}',
  preparation_notes TEXT,
  contraindications TEXT[] DEFAULT '{}',
  side_effects TEXT[] DEFAULT '{}',
  pregnancy_safe BOOLEAN DEFAULT false,
  nursing_safe BOOLEAN DEFAULT false,
  pregnancy_safe_oral BOOLEAN,
  pregnancy_safe_topical BOOLEAN,
  nursing_safe_oral BOOLEAN,
  nursing_safe_topical BOOLEAN,
  category_id UUID REFERENCES public.herb_categories(id),
  image_url TEXT,
  pubchem_cid TEXT,
  is_published BOOLEAN DEFAULT true,
  evidence_level TEXT DEFAULT 'C',
  citations JSONB DEFAULT '[]'::jsonb,
  reviewed_by TEXT,
  reviewer_credentials TEXT,
  last_reviewed TIMESTAMPTZ,
  symptom_keywords TEXT[] DEFAULT '{}',
  related_slugs TEXT[] DEFAULT '{}',
  translations JSONB DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.herbs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herbs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.herbs TO authenticated;
CREATE POLICY "Anyone can view published herbs" ON public.herbs FOR SELECT USING (is_published = true);

-- Hosted projects still carry the legacy SETOF herbs signature. 00100 must drop
-- and recreate it; without the DROP this fixture reproduces the same
-- "cannot change return type of existing function" error production hit.
CREATE OR REPLACE FUNCTION public.search_herbs_by_symptom(search_term text)
RETURNS SETOF public.herbs
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.herbs h
  WHERE h.is_published
    AND h.name ILIKE '%' || search_term || '%';
$$;

CREATE TABLE public.drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_id UUID NOT NULL REFERENCES public.herbs(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  rxcui TEXT,
  severity public.interaction_severity NOT NULL DEFAULT 'mild',
  description TEXT NOT NULL,
  mechanism TEXT,
  evidence_level TEXT,
  source TEXT,
  source_url TEXT,
  translations JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (herb_id, drug_name)
);
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.drug_interactions TO anon, authenticated;
CREATE POLICY "Anyone can view interactions" ON public.drug_interactions FOR SELECT USING (true);

CREATE TABLE public.interaction_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  herb_id UUID REFERENCES public.herbs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interaction_checks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dosage_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  herb_id UUID REFERENCES public.herbs(id) ON DELETE SET NULL,
  patient_age DECIMAL(5,2),
  patient_weight_kg DECIMAL(5,2),
  patient_height_cm DECIMAL(5,2),
  patient_bsa DECIMAL(5,4),
  adult_dose TEXT NOT NULL,
  calculated_dose TEXT NOT NULL,
  formula_used public.formula_type NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dosage_calculations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.dosage_calculations TO anon, authenticated;
CREATE POLICY "Users can view own calculations" ON public.dosage_calculations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own calculations" ON public.dosage_calculations FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Anonymous can insert calculations" ON public.dosage_calculations FOR INSERT WITH CHECK (user_id IS NULL);

CREATE TABLE public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'self',
  age_years INTEGER,
  age_months INTEGER,
  weight_kg NUMERIC(6,2),
  height_cm NUMERIC(6,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_profiles TO authenticated;
CREATE POLICY "Users manage own patient profiles" ON public.patient_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.herb_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_id UUID NOT NULL REFERENCES public.herbs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  translations JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.herb_faqs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_faqs TO anon, authenticated;

CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.herb_monographs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_id UUID NOT NULL REFERENCES public.herbs(id) ON DELETE CASCADE,
  herb_slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  mechanism TEXT NOT NULL,
  claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  drug_interactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pregnancy_category TEXT NOT NULL,
  key_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  generation_method TEXT NOT NULL DEFAULT 'manual',
  reviewed_by TEXT,
  reviewer_credentials TEXT,
  last_reviewed_at TIMESTAMPTZ,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.herb_monographs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_monographs TO anon, authenticated;

CREATE TABLE public.herb_monograph_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_slug TEXT NOT NULL,
  source TEXT NOT NULL,
  licence TEXT,
  attribution TEXT,
  url TEXT,
  claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety JSONB NOT NULL DEFAULT '[]'::jsonb,
  doses JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_method TEXT NOT NULL DEFAULT 'import',
  monograph_date DATE,
  retrieved_at DATE
);
ALTER TABLE public.herb_monograph_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_monograph_sources TO anon, authenticated;

CREATE TABLE public.herb_regulatory_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_slug TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_licence TEXT,
  purposes JSONB NOT NULL DEFAULT '[]'::jsonb,
  doses JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  products_sampled INT DEFAULT 1,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.herb_regulatory_evidence ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_regulatory_evidence TO anon, authenticated;

CREATE TABLE public.herb_pubmed_monographs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE REFERENCES public.herbs(slug) ON DELETE CASCADE,
  content JSONB NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  pmids TEXT[] DEFAULT '{}',
  article_count INT DEFAULT 0,
  model TEXT,
  status TEXT DEFAULT 'compiled',
  last_reviewed TIMESTAMPTZ,
  reviewed_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.herb_pubmed_monographs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.herb_pubmed_monographs TO anon, authenticated;

CREATE TABLE public.herb_page_bundles (
  slug TEXT PRIMARY KEY REFERENCES public.herbs(slug) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  built_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.herb_page_bundles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.herb_bundle_dirty (
  slug TEXT PRIMARY KEY,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.herb_bundle_dirty ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locale TEXT DEFAULT 'en',
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT NOT NULL UNIQUE,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Public read policies present on production catalog tables. Without these,
-- anon SELECT * compatibility tests see zero rows even though column privileges
-- are correct.
CREATE POLICY "Anyone can view herb faqs" ON public.herb_faqs
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view herb monographs" ON public.herb_monographs
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view monograph sources" ON public.herb_monograph_sources
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view regulatory evidence" ON public.herb_regulatory_evidence
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view pubmed monographs" ON public.herb_pubmed_monographs
  FOR SELECT USING (true);

-- Seed pre-migration fixtures
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'admin@example.test');

INSERT INTO public.profiles (id, role, full_name, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user', 'Regular User', 'user@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'admin', 'Admin User', 'admin@example.test');

INSERT INTO public.herb_categories (id, name, slug, description, name_fr, sort_order) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Calming & Sleep', 'calming-sleep', 'Nervine botanicals.', 'Calme et sommeil', 1);

INSERT INTO public.herbs (
  id, name, slug, scientific_name, description,
  dosage_adult, dosage_child, category_id,
  reviewed_by, reviewer_credentials, last_reviewed,
  translations, provenance
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Chamomile',
  'chamomile',
  'Matricaria chamomilla',
  'Traditional calming herb.',
  'Adults: 500 mg twice daily. Children 6-12 years: 100 mg daily. Children who ingest 5 g may develop allergic reactions.',
  '100 mg daily for children',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'yasser-bheekun',
  'MLT, OPTMQ',
  now(),
  '{"fr":{"name":"Camomille","dosage_adult":"Adultes : 500 mg par jour. Enfant 6-12 ans : 100 mg.","dosage_child":"100 mg enfant"}}'::jsonb,
  '{"verification_method":"manual","review_status":"human_reviewed","reviewed_by_name":"Yasser Bheekun","reviewed_on":"2026-11-18"}'::jsonb
),
(
  '33333333-3333-3333-3333-333333333334',
  'Fennel',
  'fennel',
  'Foeniculum vulgare',
  'Traditional carminative herb.',
  'Adults and adolescents: 1.5 g crushed fennel fruit in 250 ml boiling water 3 times daily; children 4-12 years: 1.0 g in 100 ml boiling water.',
  '1.0 g for children',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'yasser-bheekun',
  'MLT, OPTMQ',
  now(),
  '{"fr":{"name":"Fenouil","dosage_adult":"Adultes : 1,5 g par jour."}}'::jsonb,
  '{"verification_method":"manual","review_status":"human_reviewed","reviewed_by_name":"Yasser Bheekun","reviewed_on":"2026-11-18"}'::jsonb
),
(
  '33333333-3333-3333-3333-333333333335',
  'Senna Leaf',
  'senna-leaf',
  'Senna alexandrina',
  'Stimulant laxative herb.',
  'Adults and adolescents over 12 years: 15-30 mg hydroxyanthracene daily. Contraindicated under 12 years.',
  '7.5 mg for children',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'yasser-bheekun',
  'MLT, OPTMQ',
  now(),
  '{"fr":{"name":"Feuille de séné","dosage_adult":"Adultes : 15-30 mg par jour."}}'::jsonb,
  '{"verification_method":"manual","review_status":"human_reviewed","reviewed_by_name":"Yasser Bheekun","reviewed_on":"2026-11-18"}'::jsonb
),
(
  '33333333-3333-3333-3333-333333333336',
  'Deadly Nightshade',
  'atropa-belladonna-herb',
  'Atropa belladonna',
  'Highly toxic tropane alkaloid plant. Keep out of reach of children.',
  NULL,
  NULL,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'yasser-bheekun',
  'MLT, OPTMQ',
  now(),
  '{"fr":{"name":"Belladone"}}'::jsonb,
  '{"verification_method":"manual","review_status":"human_reviewed","reviewed_by_name":"Yasser Bheekun","reviewed_on":"2026-11-18"}'::jsonb
);

INSERT INTO public.herb_regulatory_evidence (herb_slug, source, purposes, doses, risks) VALUES
(
  'chamomile',
  'Health Canada LNHPD',
  '["Used in Herbal Medicine to help relieve mild digestive upset."]'::jsonb,
  '[{"text":"500 mg twice daily","population":"Adults and adolescents 12 years and older","age_minimum":12},{"text":"100 mg daily","population":"Children 6-11 years","age_minimum":6}]'::jsonb,
  '["Stop use if allergy occurs."]'::jsonb
),
(
  'fennel',
  'Health Canada LNHPD',
  '["Relieve digestive upset in adults.", "Children 4-11 years: 1.0 g daily."]'::jsonb,
  '[{"text":"Adults and adolescents: 1.5 g crushed fruit; children 4-12 years: 1.0 g daily.","population":"Adults and adolescents 12+","age_minimum":12}]'::jsonb,
  '["Fennel oil not for infants or children under 4 years.", "Give a 5-year-old 250 mg; toxic in overdose."]'::jsonb
);

INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, claims, safety, doses) VALUES
(
  'fennel',
  'European Medicines Agency (HMPC)',
  'EMA public document',
  '[{"section":"4.1 Therapeutic indications","text":"Symptomatic treatment of mild digestive spasms. For children 4-11 years: give 1.0 g daily."}]'::jsonb,
  '["Fennel oil not for infants or children under 4 years.", "Never give children 5 ml; give 10 ml."]'::jsonb,
  '["Adults and adolescents: 1.5 g three times daily; children 4-12 years: 1.0 g three times daily."]'::jsonb
),
(
  'senna-leaf',
  'European Medicines Agency (HMPC)',
  'EMA public document',
  '["Short-term use in occasional constipation. Children 6-12 years: 7.5 mg daily."]'::jsonb,
  '["Contraindicated in children under 12 years.", "Children 6-12 years: 7.5 mg at bedtime."]'::jsonb,
  '["Adults and adolescents over 12 years: 15-30 mg hydroxyanthracene daily.", "Children 6-12 years: 7.5 mg daily."]'::jsonb
);

INSERT INTO public.herb_pubmed_monographs (slug, content, status) VALUES (
  'chamomile',
  '{
    "summary":"Summary text. Children 6-18 years: 100 mg daily.",
    "dosageAndAdministration":"Adults take 500 mg daily. Children age 6: 200 mg twice daily.",
    "dosage_and_administration":"Adults: 500 mg. Under-18: 100 mg daily.",
    "dosage":"Adults (18+): 500 mg daily. 0-18 years: 50 mg.",
    "dose":"Adults over 18: 500 mg daily. Up to 18: 100 mg.",
    "dosing":"Adults 18 years and older: 500 mg. Children 6-18: 150 mg.",
    "recommendedDosage":"Adults: 500 mg. Children under 18: 100 mg.",
    "pediatricDosage":"Children 6-12 years: 100 mg.",
    "pediatricDose":"Children: 100 mg.",
    "pediatricUse":"Give children 75 mg daily.",
    "childDose":"50 mg twice daily.",
    "paediatricDosage":"80 mg daily.",
    "useInChildren":"100 mg daily in children.",
    "use_in_children":"100 mg daily in children.",
    "doseInChildren":"50 mg daily.",
    "dose_in_children":"50 mg daily.",
    "administrationInChildren":"25 mg daily.",
    "use_in_infants":"10 mg daily.",
    "minor_dosage":"40 mg daily.",
    "adultDosage":"Adults 18+: 500 mg daily. Children 6-12 years: 100 mg.",
    "childSafety":"Children should not take this product. Must not be given to infants. Not for use in children under 12 years. Not suitable for minors.",
    "minorSideEffects":"Minor side effects: mild nausea if you take on an empty stomach; children should not take this product.",
    "additionalNotes":"Adults 18+: 500 mg. Children 18 and under: 100 mg.",
    "nestedSection":{"note":"Adults take 500 mg. Children 18 or younger: 100 mg.","use_in_children":"50 mg."},
    "fr":{"dosageAndAdministration":"Adultes : 500 mg par jour. Moins de 18 ans : 100 mg.","dosage":"Adultes de 18 ans et plus : 500 mg. Enfants 6-18 ans : 100 mg.","pediatricDosage":"Enfants : 100 mg.","childDose":"50 mg.","useInChildren":"100 mg.","dose_in_children":"50 mg.","administrationInChildren":"25 mg."}
  }'::jsonb,
  'compiled'
);

INSERT INTO public.herb_faqs (id, herb_id, question, answer, translations, sort_order) VALUES
(
  '88888888-8888-8888-8888-888888888881',
  '33333333-3333-3333-3333-333333333333',
  'What is the standard adult dose? Should children 6-18 years take 100 mg?',
  'Adults: 500 mg twice daily. Children 6-12 years: 100 mg daily.',
  '{"fr":{"question":"Quelle est la dose adulte standard ? Les enfants de 6 à 18 ans peuvent-ils prendre 100 mg ?","answer":"Adultes : 500 mg par jour. Enfants 6-12 ans : 100 mg."}}'::jsonb,
  1
),
(
  '88888888-8888-8888-8888-888888888882',
  '33333333-3333-3333-3333-333333333333',
  'Can children take chamomile?',
  'Contraindicated in children under 12 years without medical advice. Keep out of reach of children.',
  '{"fr":{"question":"Les enfants peuvent-ils prendre de la camomille ?","answer":"Déconseillé chez l''enfant de moins de 12 ans sans avis médical."}}'::jsonb,
  2
),
(
  '88888888-8888-8888-8888-888888888883',
  '33333333-3333-3333-3333-333333333333',
  'Should children 6-12 years take 100 mg daily?',
  'Stop use and consult a healthcare professional if adverse reactions occur.',
  '{"fr":{"question":"Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?","answer":"Cesser l''utilisation et consulter un professionnel de la santé en cas de réaction indésirable."}}'::jsonb,
  3
),
(
  '88888888-8888-8888-8888-888888888884',
  '33333333-3333-3333-3333-333333333333',
  'Should children 6-12 years take 100 mg daily?',
  'Children 6-12 years: 100 mg daily.',
  '{"fr":{"question":"Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?","answer":"Cesser l''utilisation et consulter un professionnel de la santé en cas de réaction indésirable."}}'::jsonb,
  4
),
(
  '88888888-8888-8888-8888-888888888885',
  '33333333-3333-3333-3333-333333333333',
  'Give children 0-18 years 100 mg daily?',
  'Children 0-18 years: 100 mg daily.',
  '{"fr":{"question":"Donner 100 mg par jour aux enfants de 0 à 18 ans ?","answer":"Enfants 0-18 ans : 100 mg par jour."}}'::jsonb,
  5
);

INSERT INTO public.herb_monographs (
  id, herb_id, herb_slug, summary, mechanism, safety_notes, drug_interactions, pregnancy_category, status
) VALUES (
  '99999999-9999-9999-9999-999999999991',
  '33333333-3333-3333-3333-333333333333',
  'chamomile',
  'Adults take 500 mg twice daily. Give children 100 mg daily.',
  'Modulates GABA receptors.',
  '["Avoid if allergic to ragweed. Children under 12: 100 mg daily."]'::jsonb,
  '[{"drug":"Warfarin","severity":"moderate","detail":"Adults take 500 mg with INR monitoring. Children 6-18 years: 100 mg daily."}]'::jsonb,
  'insufficient',
  'published'
);

-- Build the cached bundle from the real herb row, as the production cache does,
-- then override only the legacy pediatric fields this fixture exercises. A
-- hand-written five-field herb object makes the page call .trim() on a missing
-- scientific_name and return 500.
INSERT INTO public.herb_page_bundles (slug, payload)
SELECT
  'chamomile',
  jsonb_build_object(
    'herb', to_jsonb(h) || jsonb_build_object(
      'dosage_adult', 'Adults: 500 mg twice daily. Children 6-12 years: 100 mg daily. Children who ingest 5 g may develop allergic reactions.',
      'dosage_child', '100 mg daily for children',
      'translations', '{"fr":{"name":"Camomille","dosage_child":"100 mg enfant","dosage_adult":"Adultes : 500 mg par jour. Enfant 6-12 ans : 100 mg."}}'::jsonb
    ),
    'faqs', jsonb_build_array(
      jsonb_build_object(
        'question', 'How much for adults? Children 6-18 years: 100 mg?',
        'answer', 'Adults: 500 mg daily. Children 6-12 years: 100 mg daily.',
        'translations', '{"fr":{"question":"Quelle dose adulte ? Enfants 6-18 ans : 100 mg ?","answer":"Adultes : 500 mg par jour. Enfants 6-12 ans : 100 mg."}}'::jsonb
      ),
      jsonb_build_object(
        'question', 'Can children take chamomile?',
        'answer', 'Contraindicated in children under 12 years without medical advice. Keep out of reach of children.',
        'translations', '{"fr":{"question":"Les enfants peuvent-ils prendre de la camomille ?","answer":"Déconseillé chez l''enfant de moins de 12 ans sans avis médical."}}'::jsonb
      ),
      jsonb_build_object(
        'question', 'Should children 6-12 years take 100 mg daily?',
        'answer', 'Stop use and consult a healthcare professional if adverse reactions occur.',
        'translations', '{"fr":{"question":"Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?","answer":"Cesser l''utilisation et consulter un professionnel de la santé en cas de réaction indésirable."}}'::jsonb
      ),
      jsonb_build_object(
        'question', 'Should children 6-12 years take 100 mg daily?',
        'answer', 'Children 6-12 years: 100 mg daily.',
        'translations', '{"fr":{"question":"Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?","answer":"Cesser l''utilisation et consulter un professionnel de la santé en cas de réaction indésirable."}}'::jsonb
      ),
      jsonb_build_object(
        'question', 'Give children 0-18 years 100 mg daily?',
        'answer', 'Children 0-18 years: 100 mg daily.',
        'translations', '{"fr":{"question":"Donner 100 mg par jour aux enfants de 0 à 18 ans ?","answer":"Enfants 0-18 ans : 100 mg par jour."}}'::jsonb
      )
    ),
    'monograph', jsonb_build_object(
      'summary', 'Adults take 500 mg daily. Children under 12: 100 mg daily.',
      'safetyNotes', jsonb_build_array('Use caution in ragweed allergy. Give a 5-year-old 50 mg.'),
      'drug_interactions', jsonb_build_array(jsonb_build_object('drug', 'Warfarin', 'detail', 'Adults take 500 mg with INR monitoring. Children 6-18 years: 100 mg daily.'))
    ),
    'regulatory', jsonb_build_object(
      'doses', '[{"text":"500 mg twice daily","population":"Adults and adolescents 12+","age_minimum":12},{"text":"100 mg daily","population":"Children 6-11","age_minimum":6}]'::jsonb
    ),
    'sources', '[{"source":"Health Canada","doses":[{"text":"100 mg","population":"Children","age_minimum":6}]}]'::jsonb,
    'pubmed', '{"content":{"dosageAndAdministration":"Adults take 500 mg. Children age 6: 200 mg.","dosage":"Adults 18+: 500 mg. 0-18 years: 50 mg.","recommendedDosage":"Adults: 500 mg. Under-18: 100 mg.","adultDosage":"Adults 18+: 500 mg daily. Children 6-12 years: 100 mg.","childSafety":"Children should not take this product. Must not be given to infants. Not for use in children under 12 years. Not suitable for minors.","minorSideEffects":"Minor side effects: mild nausea if you take on an empty stomach; children should not take this product.","pediatricDosage":"Children: 100 mg.","useInChildren":"100 mg.","use_in_children":"100 mg.","doseInChildren":"50 mg.","dose_in_children":"50 mg.","administrationInChildren":"25 mg.","fr":{"dosageAndAdministration":"Adultes : 500 mg. Moins de 18 ans : 100 mg.","useInChildren":"100 mg."}}}'::jsonb
  )
FROM public.herbs h
WHERE h.slug = 'chamomile';

-- Cached bundle with an empty French preparation note, reproducing the
-- production payload shape that made redaction assign SQL NULL and violate the
-- herb_page_bundles.payload NOT NULL constraint during 00100.
INSERT INTO public.herbs (
  id, name, slug, scientific_name, description, dosage_adult, is_published, category_id
) VALUES (
  '33333333-3333-3333-3333-333333333337',
  'Bundle Redaction Regression',
  'bundle-redaction-regression',
  'Testus regressionis',
  'Fixture only.',
  '500 mg',
  false,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
);

INSERT INTO public.herb_page_bundles (slug, payload) VALUES (
  'bundle-redaction-regression',
  jsonb_build_object(
    'herb', jsonb_build_object(
      'slug', 'bundle-redaction-regression',
      'name', 'Bundle Redaction Regression',
      'translations', '{"fr":{"preparation_notes":"","dosage_adult":"2–3 gouttes 2–3× par jour","dosage_child":""}}'::jsonb
    ),
    'regulatory', 'null'::jsonb,
    'monograph', 'null'::jsonb
  )
);

-- Unpublished draft herb & draft PubMed sheet fixtures to verify public view filtering (M4)
INSERT INTO public.herbs (
  id, name, slug, scientific_name, description, dosage_adult, is_published, category_id
) VALUES (
  '33333333-3333-3333-3333-333333333339',
  'Draft Unpublished Herb',
  'draft-unpublished-herb',
  'Herba draftia',
  'Unpublished draft herb prose.',
  'Adults: 200 mg daily.',
  false,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
);

INSERT INTO public.herb_faqs (id, herb_id, question, answer) VALUES (
  '88888888-8888-8888-8888-888888888889',
  '33333333-3333-3333-3333-333333333339',
  'Draft question?',
  'Draft answer.'
);

INSERT INTO public.herb_monographs (
  id, herb_id, herb_slug, summary, mechanism, pregnancy_category, status
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  '33333333-3333-3333-3333-333333333339',
  'draft-unpublished-herb',
  'Unpublished herb summary.',
  'Mechanism.',
  'insufficient',
  'published'
);

INSERT INTO public.herb_regulatory_evidence (herb_slug, source, purposes, doses, risks) VALUES (
  'draft-unpublished-herb',
  'Health Canada LNHPD',
  '["Draft purpose"]'::jsonb,
  '[{"text":"200 mg daily","population":"Adults","age_minimum":18}]'::jsonb,
  '["Draft risk"]'::jsonb
);

INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, claims, safety, doses) VALUES (
  'draft-unpublished-herb',
  'EMA HMPC',
  'Public',
  '["Draft claim"]'::jsonb,
  '["Draft safety"]'::jsonb,
  '["Adults: 200 mg"]'::jsonb
);

INSERT INTO public.herb_pubmed_monographs (slug, content, status) VALUES
  ('draft-unpublished-herb', '{"summary":"Unpublished herb sheet."}'::jsonb, 'compiled'),
  ('fennel', '{"summary":"Draft fennel sheet.","dosageAndAdministration":"Adults: 1.5 g."}'::jsonb, 'draft');

INSERT INTO public.drug_interactions (
  id, herb_id, drug_name, severity, description, mechanism, evidence_level, source, source_url
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'Warfarin',
  'moderate',
  'May increase bleeding risk when combined with anticoagulant therapy.',
  'Additive antiplatelet and coumarin activity.',
  'limited-evidence',
  'NIH ODS',
  'https://ods.od.nih.gov/factsheets/Chamomile-HealthProfessional/'
);

-- Legacy dosage rows that MUST be quarantined without deletion
INSERT INTO public.dosage_calculations (id, user_id, patient_age, patient_weight_kg, adult_dose, calculated_dose, formula_used) VALUES
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 8, 28, '500 mg', '200 mg', 'clarks_rule'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 35, 70, '500 mg', '500 mg', 'youngs_rule'),
  ('55555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111111', 35, 70, '500 mg', '500 mg', 'bsa'),
  ('55555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111111', NULL, 70, '500 mg', '500 mg', 'fried_rule');

INSERT INTO public.patient_profiles (id, user_id, name, relationship, age_years, age_months, weight_kg) VALUES
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 'Child Profile', 'child', 8, NULL, 28),
  ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 'Adult Profile', 'self', 32, NULL, 70);
SQL

echo "==> Pass 1: applying expand migrations (00097–00103)"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase expand --repo-dir "$REPO_DIR" --psql-url "$DATABASE_URL"

echo "==> Running old-image expand compatibility test (before 00104 contract)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_DIR}/supabase/tests/old-image-expand-compat.sql"

echo "==> Applying contract migration (00104)"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase contract --repo-dir "$REPO_DIR" --psql-url "$DATABASE_URL"

echo "==> Pass 2: re-applying migrations (00097–00104) idempotency check"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase all --repo-dir "$REPO_DIR" --psql-url "$DATABASE_URL"

echo "==> Testing real 00104 rollback on disposable clone database ${PGDATABASE}_rollback (never commits grants on main DB)"
ROLLBACK_DB="${PGDATABASE}_rollback"
ADMIN_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/postgres"
ROLLBACK_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${ROLLBACK_DB}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${ROLLBACK_DB}\" WITH (FORCE);"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${ROLLBACK_DB}\" WITH TEMPLATE \"${PGDATABASE}\";"

bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --rollback-contract --repo-dir "$REPO_DIR" --psql-url "$ROLLBACK_URL"

echo "==> Verifying old-image reads + writes succeed after real 00104 rollback"
psql "$ROLLBACK_URL" -v ON_ERROR_STOP=1 -f "${REPO_DIR}/supabase/tests/old-image-expand-compat.sql"

echo "==> Re-applying 00104 contract after rollback and running integration tests on recovered DB"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase contract --repo-dir "$REPO_DIR" --psql-url "$ROLLBACK_URL"
psql "$ROLLBACK_URL" -v ON_ERROR_STOP=1 -f "${REPO_DIR}/supabase/tests/clinical-safety-integration.sql"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${ROLLBACK_DB}\" WITH (FORCE);"

echo "==> Running idempotent contract verifier & clinical-safety integration assertions on main ${PGDATABASE}"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase all --verify-only --repo-dir "$REPO_DIR" --psql-url "$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_DIR}/supabase/tests/clinical-safety-integration.sql"

# The integration suite intentionally ends with the seeded chamomile–warfarin
# pair in retracted_hold after proving the retraction gate. Restore a
# deterministic published pair so downstream PostgREST smoke and migrated-DB
# E2E assert the real public contract instead of test residue.
echo "==> Restoring seeded public interaction pair for downstream PostgREST/E2E"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.drug_interaction_citations
SET retraction_status = 'active'
WHERE id = '77777777-7777-7777-7777-777777777771';

UPDATE public.drug_interactions
SET
  botanical_applicability = 'oral_whole_herb_or_tea',
  clinical_reviewer_id = 'clinician-1',
  verified_at = now(),
  next_review_due_at = now() + interval '180 days',
  clinical_action_status = 'clinician_approved',
  publication_status = 'published'
WHERE id = '44444444-4444-4444-4444-444444444444';
SQL

echo "✓ Targeted PG16 migration fixture (00097–00104 + expand/contract + real rollback + RLS/triggers) passed."
