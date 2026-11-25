#!/usr/bin/env bash
# Apply, verify, or roll back HerbAlly SQL migrations in expand / contract phases
# fail-closed with backup, ON_ERROR_STOP=1, transaction-boundary/lookbehind lint,
# and mandatory postcondition checks.
#
# Phases / Modes:
#   --phase expand      Apply 00097, 00098, 00099, 00099b, 00100, 00101, 00102, 00103
#                       (safe for reads & writes while the previous app image is serving)
#   --phase contract    Apply 00104_pediatric_boundary_contract.sql (ONLY after new
#                       app image is healthy & verified using *_public views)
#   --phase all         Apply expand + contract sequentially (default / CI fixture)
#   --verify-only       Run ONLY the idempotent postcondition verifier for --phase
#   --rollback-contract Apply scripts/rollback-00104-contract.sql and verify old-image
#                       base-table SELECT* + calculator write compatibility; fails loudly.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/herbally}"
DB_CONTAINER="${DB_CONTAINER:-herbally-db}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-${REPO_DIR}/deploy/backup-local.sh}"
TEST_MODE="false"
PSQL_URL=""
PHASE="all"
VERIFY_ONLY="false"
ROLLBACK_CONTRACT="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --test-mode)
      TEST_MODE="true"
      shift
      ;;
    --psql-url)
      PSQL_URL="${2:-}"
      shift 2
      ;;
    --repo-dir)
      REPO_DIR="${2:-}"
      shift 2
      ;;
    --phase)
      PHASE="${2:-}"
      shift 2
      ;;
    --verify-only)
      VERIFY_ONLY="true"
      shift
      ;;
    --rollback-contract)
      ROLLBACK_CONTRACT="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

case "$PHASE" in
  expand|contract|all) ;;
  *)
    echo "Invalid --phase '$PHASE' (expected expand|contract|all)" >&2
    exit 2
    ;;
esac

if [ "$TEST_MODE" = "true" ] && [ "$REPO_DIR" = "/srv/herbally" ]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

EXPAND_MIGRATIONS=(
  "supabase/migrations/00097_admin_aal2_rls.sql"
  "supabase/migrations/00098_newsletter_confirmation_sent_at.sql"
  "supabase/migrations/00099_newsletter_send_lease.sql"
  "supabase/migrations/00099b_formula_type_adult_reference_enum.sql"
  "supabase/migrations/00100_pediatric_containment_dosage_calculations.sql"
  "supabase/migrations/00101_interaction_publication_contract.sql"
  "supabase/migrations/00102_scientific_governance_and_incidents.sql"
  "supabase/migrations/00103_privacy_minimization_controls.sql"
)

CONTRACT_MIGRATIONS=(
  "supabase/migrations/00104_pediatric_boundary_contract.sql"
)

SELECTED_MIGRATIONS=()
if [ "$PHASE" = "expand" ] || [ "$PHASE" = "all" ]; then
  SELECTED_MIGRATIONS+=("${EXPAND_MIGRATIONS[@]}")
fi
if [ "$PHASE" = "contract" ] || [ "$PHASE" = "all" ]; then
  SELECTED_MIGRATIONS+=("${CONTRACT_MIGRATIONS[@]}")
fi

run_psql() {
  if [ "$TEST_MODE" = "true" ]; then
    if [ -z "$PSQL_URL" ]; then
      echo "--psql-url is required with --test-mode" >&2
      exit 2
    fi
    psql "$PSQL_URL" -v ON_ERROR_STOP=1 "$@"
  else
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
  fi
}

verify_expand_postconditions() {
  echo "==> Verifying expand-phase schema, constraints, triggers, views, RPCs, and RLS postconditions"
  run_psql <<'SQL'
DO $$
DECLARE
  v_view TEXT;
  v_fn TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_aal2'
  ) THEN
    RAISE EXCEPTION 'Missing function public.is_admin_aal2()';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers' AND column_name = 'last_confirmation_sent_at'
  ) THEN
    RAISE EXCEPTION 'Missing public.newsletter_subscribers.last_confirmation_sent_at';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers' AND column_name = 'confirmation_send_lease_until'
  ) THEN
    RAISE EXCEPTION 'Missing public.newsletter_subscribers.confirmation_send_lease_until';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'formula_type' AND e.enumlabel = 'adult_reference'
  ) THEN
    RAISE EXCEPTION 'Missing enum value adult_reference on public.formula_type';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dosage_calculations' AND column_name = 'is_legacy_pediatric_quarantined'
  ) THEN
    RAISE EXCEPTION 'Missing column public.dosage_calculations.is_legacy_pediatric_quarantined';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patient_profiles' AND column_name = 'adult_dosing_eligible'
  ) THEN
    RAISE EXCEPTION 'Missing column public.patient_profiles.adult_dosing_eligible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'herbs' AND column_name = 'name_fr'
  ) THEN
    RAISE EXCEPTION 'Missing column public.herbs.name_fr';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'herbs_pediatric_quarantine'
  ) THEN
    RAISE EXCEPTION 'Missing table public.herbs_pediatric_quarantine';
  END IF;

  FOR v_view IN
    SELECT unnest(ARRAY[
      'herbs_public',
      'herb_faqs_public',
      'herb_monographs_public',
      'herb_regulatory_evidence_public',
      'herb_monograph_sources_public',
      'herb_pubmed_monographs_public'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v_view
    ) THEN
      RAISE EXCEPTION 'Missing sanitized public view public.%', v_view;
    END IF;
    IF NOT has_table_privilege('anon', 'public.' || v_view, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || v_view, 'SELECT') THEN
      RAISE EXCEPTION 'Missing anon/authenticated SELECT grant on public.%', v_view;
    END IF;
  END LOOP;

  FOR v_fn IN
    SELECT unnest(ARRAY[
      'strip_pediatric_dosage_text',
      'redact_text_array',
      'redact_text_array_jsonb',
      'filter_public_doses_jsonb',
      'redact_herb_page_bundle',
      'herb_page_bundle',
      'search_herbs_by_symptom',
      'build_herb_page_bundle'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      RAISE EXCEPTION 'Missing function public.%', v_fn;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('anon', 'public.herb_page_bundle(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.search_herbs_by_symptom(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must have EXECUTE privilege on herb_page_bundle and search_herbs_by_symptom';
  END IF;
  IF has_function_privilege('anon', 'public.build_herb_page_bundle(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.build_herb_page_bundle(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'build_herb_page_bundle(text) must be revoked from anon/authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drug_interactions' AND column_name = 'evidence_note'
  ) THEN
    RAISE EXCEPTION 'Missing column public.drug_interactions.evidence_note';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drug_interactions' AND column_name = 'publication_status'
  ) THEN
    RAISE EXCEPTION 'Missing column public.drug_interactions.publication_status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviewer_registry' AND column_name = 'licence_expires_at'
  ) THEN
    RAISE EXCEPTION 'Missing public.reviewer_registry.licence_expires_at';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_interactions_clinical_reviewer_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing FK constraint drug_interactions_clinical_reviewer_id_fkey';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_drug_interaction_publication_gate'
  ) THEN
    RAISE EXCEPTION 'Missing trigger trg_drug_interaction_publication_gate';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_drug_interactions_published_canonical'
  ) THEN
    RAISE EXCEPTION 'Missing unique index idx_drug_interactions_published_canonical';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drug_interaction_citations'
  ) THEN
    RAISE EXCEPTION 'Missing table public.drug_interaction_citations';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drug_interaction_revisions'
      AND column_name = 'interaction_record_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'drug_interaction_revisions.interaction_record_id must be NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reset_clinical_review_on_edit'
  ) THEN
    RAISE EXCEPTION 'Missing trigger trg_reset_clinical_review_on_edit';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_herb_clinical_revisions'
  ) THEN
    RAISE EXCEPTION 'Missing trigger trg_audit_herb_clinical_revisions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_safety_incident_with_audit'
  ) THEN
    RAISE EXCEPTION 'Missing function public.create_safety_incident_with_audit';
  END IF;
  IF has_column_privilege('anon', 'public.claim_citations', 'reviewer_id', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT have SELECT privilege on public.claim_citations.reviewer_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_privacy_consents'
  ) THEN
    RAISE EXCEPTION 'Missing table public.user_privacy_consents';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'retention_expires_at'
  ) THEN
    RAISE EXCEPTION 'Missing column public.chat_sessions.retention_expires_at';
  END IF;
END
$$;
SQL
}

verify_contract_postconditions() {
  echo "==> Verifying 00104 post-switch contract lockdown and column revocations"
  run_psql <<'SQL'
DO $$
DECLARE
  v_view TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dosage_calculations_adult_only_check' AND convalidated = true
  ) THEN
    RAISE EXCEPTION 'Missing or unvalidated constraint dosage_calculations_adult_only_check post-00104';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_dosage_calculations_adult_only'
  ) THEN
    RAISE EXCEPTION 'Missing trigger trg_dosage_calculations_adult_only post-00104';
  END IF;
  IF has_table_privilege('anon', 'public.dosage_calculations', 'INSERT') THEN
    RAISE EXCEPTION 'anon must NOT have INSERT privilege on public.dosage_calculations post-00104';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dosage_calculations'
      AND policyname = 'Anonymous can insert calculations'
  ) THEN
    RAISE EXCEPTION 'Anonymous can insert calculations policy must NOT exist post-00104';
  END IF;

  IF has_column_privilege('anon', 'public.herbs', 'dosage_child', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'dosage_adult', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'translations', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'description', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'preparation_notes', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'traditional_uses', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'modern_uses', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'contraindications', 'SELECT')
     OR has_column_privilege('anon', 'public.herbs', 'side_effects', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT retain SELECT on raw herbs dose/prose/array columns post-00104';
  END IF;
  IF has_column_privilege('authenticated', 'public.herbs', 'dosage_child', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'dosage_adult', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'translations', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'description', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'preparation_notes', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'traditional_uses', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'modern_uses', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'contraindications', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herbs', 'side_effects', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must NOT retain SELECT on raw herbs dose/prose/array columns post-00104';
  END IF;

  IF NOT has_column_privilege('anon', 'public.herbs', 'id', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.herbs', 'slug', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.herbs', 'name', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.herbs', 'name_fr', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.herbs', 'is_published', 'SELECT') THEN
    RAISE EXCEPTION 'anon must retain SELECT on non-prose metadata columns of public.herbs';
  END IF;

  IF has_column_privilege('anon', 'public.herb_faqs', 'answer', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_faqs', 'question', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_faqs', 'translations', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_faqs', 'answer', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must NOT retain SELECT on raw herb_faqs prose columns post-00104';
  END IF;

  IF has_column_privilege('anon', 'public.herb_monographs', 'summary', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monographs', 'mechanism', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monographs', 'claims', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monographs', 'safety_notes', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monographs', 'drug_interactions', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_monographs', 'summary', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_monographs', 'drug_interactions', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must NOT retain SELECT on raw herb_monographs prose columns post-00104';
  END IF;

  IF has_column_privilege('anon', 'public.herb_regulatory_evidence', 'doses', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_regulatory_evidence', 'purposes', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_regulatory_evidence', 'risks', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_regulatory_evidence', 'doses', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_regulatory_evidence', 'purposes', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_regulatory_evidence', 'risks', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must NOT retain SELECT on raw herb_regulatory_evidence arrays post-00104';
  END IF;

  IF has_column_privilege('anon', 'public.herb_monograph_sources', 'doses', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monograph_sources', 'claims', 'SELECT')
     OR has_column_privilege('anon', 'public.herb_monograph_sources', 'safety', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_monograph_sources', 'doses', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_monograph_sources', 'claims', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_monograph_sources', 'safety', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must NOT retain SELECT on raw herb_monograph_sources arrays post-00104';
  END IF;

  IF has_column_privilege('anon', 'public.herb_pubmed_monographs', 'content', 'SELECT')
     OR has_column_privilege('authenticated', 'public.herb_pubmed_monographs', 'content', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must NOT retain SELECT on raw herb_pubmed_monographs.content post-00104';
  END IF;

  FOR v_view IN
    SELECT unnest(ARRAY[
      'herbs_public',
      'herb_faqs_public',
      'herb_monographs_public',
      'herb_regulatory_evidence_public',
      'herb_monograph_sources_public',
      'herb_pubmed_monographs_public'
    ])
  LOOP
    IF NOT has_table_privilege('anon', 'public.' || v_view, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || v_view, 'SELECT') THEN
      RAISE EXCEPTION 'Sanitized view public.% must remain readable post-00104', v_view;
    END IF;
  END LOOP;
END
$$;
SQL
}

verify_rollback_postconditions() {
  echo "==> Verifying 00104 rollback restored raw SELECT* and dosage_calculations write compatibility"
  run_psql <<'SQL'
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  FOR v_tbl IN
    SELECT unnest(ARRAY[
      'herbs',
      'herb_faqs',
      'herb_monographs',
      'herb_regulatory_evidence',
      'herb_monograph_sources',
      'herb_pubmed_monographs'
    ])
  LOOP
    IF NOT has_table_privilege('anon', 'public.' || v_tbl, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || v_tbl, 'SELECT') THEN
      RAISE EXCEPTION 'Rollback failed: anon/authenticated missing SELECT on public.%', v_tbl;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dosage_calculations_adult_only_check'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: dosage_calculations_adult_only_check still present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_dosage_calculations_adult_only'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: trg_dosage_calculations_adult_only still present';
  END IF;
  IF NOT has_table_privilege('anon', 'public.dosage_calculations', 'INSERT') THEN
    RAISE EXCEPTION 'Rollback failed: anon missing INSERT on public.dosage_calculations';
  END IF;

  -- Direct SELECT * probe as anon on all 6 base tables (rolled back cleanly if empty)
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM * FROM public.herbs LIMIT 1;
  PERFORM * FROM public.herb_faqs LIMIT 1;
  PERFORM * FROM public.herb_monographs LIMIT 1;
  PERFORM * FROM public.herb_regulatory_evidence LIMIT 1;
  PERFORM * FROM public.herb_monograph_sources LIMIT 1;
  PERFORM * FROM public.herb_pubmed_monographs LIMIT 1;
  RESET ROLE;
END
$$;
SQL
}

if [ "$ROLLBACK_CONTRACT" = "true" ]; then
  ROLLBACK_SQL="${REPO_DIR}/scripts/rollback-00104-contract.sql"
  if [ ! -f "$ROLLBACK_SQL" ]; then
    echo "Missing rollback SQL file: ${ROLLBACK_SQL}" >&2
    exit 1
  fi
  echo "==> Executing 00104 contract rollback via ${ROLLBACK_SQL}"
  run_psql < "$ROLLBACK_SQL"
  verify_rollback_postconditions
  echo "✓ 00104 contract rollback applied and verified cleanly."
  exit 0
fi

if [ "$VERIFY_ONLY" = "true" ]; then
  if [ "$PHASE" = "expand" ] || [ "$PHASE" = "all" ]; then
    verify_expand_postconditions
  fi
  if [ "$PHASE" = "contract" ] || [ "$PHASE" = "all" ]; then
    verify_contract_postconditions
  fi
  echo "✓ Verification for phase '${PHASE}' passed cleanly."
  exit 0
fi

echo "==> Preflight (phase=${PHASE}): checking migration files, transactions, and PG16 regex compatibility"
for rel in "${SELECTED_MIGRATIONS[@]}"; do
  full="${REPO_DIR}/${rel}"
  if [ ! -f "$full" ]; then
    echo "Missing migration file: ${full}" >&2
    exit 1
  fi
  python3 - "$full" <<'PY'
import re, sys
path = sys.argv[1]
txt = open(path, encoding="utf-8").read()
no_comments = re.sub(r"--[^\n]*", "", txt)
no_comments = re.sub(r"/\*.*?\*/", "", no_comments, flags=re.S)
if re.search(r"\(\?<[=!]", no_comments):
    print(f"PostgreSQL 16 invalid regex lookbehind detected in {path}", file=sys.stderr)
    sys.exit(1)
out = []
i, n = 0, len(no_comments)
while i < n:
    m = re.match(r"\$([a-zA-Z_0-9]*)\$", no_comments[i:])
    if m:
        tag = m.group(0)
        end = no_comments.find(tag, i + len(tag))
        if end == -1:
            print(f"Unclosed dollar-quoted block in {path}", file=sys.stderr)
            sys.exit(1)
        i = end + len(tag)
    else:
        out.append(no_comments[i])
        i += 1
sql = "".join(out)
begins = len(re.findall(r"(?im)^\s*(?:BEGIN|START\s+TRANSACTION)\s*;", sql))
commits = len(re.findall(r"(?im)^\s*(?:COMMIT|END\s+TRANSACTION)\s*;", sql))
if begins != commits:
    print(f"Unbalanced top-level BEGIN/COMMIT in {path}: BEGIN={begins}, COMMIT={commits}", file=sys.stderr)
    sys.exit(1)
PY
done

if [ "$TEST_MODE" != "true" ] && { [ "$PHASE" = "expand" ] || [ "$PHASE" = "all" ]; }; then
  if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "Backup script missing: ${BACKUP_SCRIPT}" >&2
    exit 1
  fi
  echo "==> Running pre-migration encrypted backup via ${BACKUP_SCRIPT}"
  if [ "$(id -u)" -eq 0 ] || [ -r "$BACKUP_SCRIPT" ]; then
    bash "$BACKUP_SCRIPT"
  else
    # The production backup script and its passphrase are intentionally
    # root-only. The self-hosted runner executes this one fixed script through
    # a narrowly scoped NOPASSWD sudoers rule instead of widening file modes.
    sudo -n "$BACKUP_SCRIPT"
  fi
fi

for rel in "${SELECTED_MIGRATIONS[@]}"; do
  echo "==> Applying ${rel}"
  run_psql < "${REPO_DIR}/${rel}"
done

if [ "$PHASE" = "expand" ] || [ "$PHASE" = "all" ]; then
  verify_expand_postconditions
fi

if [ "$PHASE" = "contract" ] || [ "$PHASE" = "all" ]; then
  verify_contract_postconditions
fi

echo "✓ Migration phase '${PHASE}' applied and verified cleanly."
