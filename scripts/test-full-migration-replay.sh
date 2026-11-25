#!/usr/bin/env bash
# Required full-chain migration replay harness (00001 through latest *.sql)
# on a disposable PostgreSQL 16 instance with Supabase auth/storage/extensions stubs.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-herbally_replay}"
DATABASE_URL="${DATABASE_URL:-postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}}"

echo "==> Bootstrapping minimal Supabase extensions/roles/auth/storage stubs for full replay"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN SUPERUSER; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT, raw_user_meta_data JSONB DEFAULT '{}'::jsonb);
GRANT SELECT ON TABLE auth.users TO service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon'); $$;
CREATE TABLE IF NOT EXISTS storage.buckets (id TEXT PRIMARY KEY, name TEXT, public BOOLEAN DEFAULT false);
CREATE TABLE IF NOT EXISTS storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT, owner UUID);
SQL

echo "==> Replaying all SQL migrations in lexical order (00001..latest)"
for file in "${REPO_DIR}"/supabase/migrations/*.sql; do
  echo "  -> $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done

echo "==> Granting Supabase-equivalent service_role privileges & verifying non-superuser CRUD"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

BEGIN;
DO $$
DECLARE
  v_is_super BOOLEAN;
  v_bypass_rls BOOLEAN;
  v_id UUID;
  v_desc TEXT;
  v_rev_by TEXT;
  v_last_rev TIMESTAMPTZ;
  v_review_status TEXT;
  v_inc_id UUID;
  v_crud_inc_id UUID;
  v_audit_count INT;
BEGIN
  SELECT rolsuper, rolbypassrls INTO v_is_super, v_bypass_rls
  FROM pg_roles WHERE rolname = 'service_role';
  IF v_is_super THEN
    RAISE EXCEPTION 'service_role must not be superuser in replay fixture';
  END IF;
  IF NOT v_bypass_rls THEN
    RAISE EXCEPTION 'service_role must have BYPASSRLS in replay fixture';
  END IF;

  EXECUTE 'SET LOCAL ROLE service_role';

  -- Six-table raw SELECT check post-00104
  PERFORM dosage_child FROM public.herbs LIMIT 1;
  PERFORM question FROM public.herb_faqs LIMIT 1;
  PERFORM drug_interactions FROM public.herb_monographs LIMIT 1;
  PERFORM doses FROM public.herb_regulatory_evidence LIMIT 1;
  PERFORM claims FROM public.herb_monograph_sources LIMIT 1;
  PERFORM content FROM public.herb_pubmed_monographs LIMIT 1;

  INSERT INTO public.herbs (
    name, slug, scientific_name, description, dosage_adult, is_published, reviewed_by, last_reviewed
  ) VALUES (
    'Replay Smoke Herb', 'replay-smoke-herb', 'Herba replayia', 'Initial description.', '300 mg daily', false, 'yasser-bheekun', now()
  )
  RETURNING id, description INTO v_id, v_desc;
  IF v_id IS NULL OR v_desc <> 'Initial description.' THEN
    RAISE EXCEPTION 'service_role INSERT RETURNING failed on full replay';
  END IF;

  UPDATE public.herbs
  SET description = 'Updated replay description.'
  WHERE id = v_id
  RETURNING description, reviewed_by, last_reviewed, provenance->>'review_status'
  INTO v_desc, v_rev_by, v_last_rev, v_review_status;
  IF v_desc <> 'Updated replay description.' THEN
    RAISE EXCEPTION 'service_role UPDATE RETURNING failed on full replay';
  END IF;
  IF v_rev_by IS NOT NULL OR v_last_rev IS NOT NULL OR v_review_status <> 'needs_re_review' THEN
    RAISE EXCEPTION 'Expected provenance review_status=needs_re_review on replay clinical edit, got reviewed_by=%, last_reviewed=%, status=%', v_rev_by, v_last_rev, v_review_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_content_revisions
    WHERE record_slug = 'replay-smoke-herb'
      AND operation = 'UPDATE'
      AND clinical_fields_changed = true
  ) THEN
    RAISE EXCEPTION 'Expected clinical_content_revisions UPDATE row for replay-smoke-herb';
  END IF;

  DELETE FROM public.herbs WHERE id = v_id;

  SELECT public.create_safety_incident_with_audit(
    'pediatric_safety',
    'high',
    'https://herbally.app/en/calculator',
    'Replay smoke incident',
    'No PHI',
    'open_triage',
    now() + interval '72 hours',
    'public_intake'
  ) INTO v_inc_id;
  IF v_inc_id IS NULL THEN
    RAISE EXCEPTION 'service_role create_safety_incident_with_audit failed on full replay';
  END IF;
  SELECT count(*) INTO v_audit_count
  FROM public.safety_incident_audit_log WHERE incident_id = v_inc_id;
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 safety_incident_audit_log row for replay incident %, got %', v_inc_id, v_audit_count;
  END IF;
  DELETE FROM public.safety_incidents WHERE id = v_inc_id;

  INSERT INTO public.safety_incidents (
    category, severity, surface_url, summary, details, triage_status, sla_due_at
  ) VALUES (
    'pediatric_safety', 'high', 'https://herbally.app/en/calculator',
    'Replay service_role CRUD check', 'Details', 'open_triage', now() + interval '72 hours'
  )
  RETURNING id INTO v_crud_inc_id;
  INSERT INTO public.safety_incident_audit_log (incident_id, actor, action, note)
  VALUES (v_crud_inc_id, 'service_role_replay_test', 'created', 'smoke');
  PERFORM * FROM public.safety_incident_audit_log WHERE incident_id = v_crud_inc_id;
  DELETE FROM public.safety_incidents WHERE id = v_crud_inc_id;

  RESET ROLE;
END
$$;
ROLLBACK;
SQL

echo "==> Running full expand + contract postcondition verifier on replayed database"
bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase all --verify-only --repo-dir "$REPO_DIR" --psql-url "$DATABASE_URL"

echo "✓ Full migration replay (00001..latest) succeeded and passed postcondition verification."
