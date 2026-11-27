#!/usr/bin/env bash
# Non-destructive PostgreSQL 16 Backup & Restore Drill (CI Gate).
#
# 1. Provisions and verifies source database (targeted migrations 00097-00104)
#    plus deterministic canary rows.
# 2. Creates a custom-format backup with pg_dump -Fc and inspects archive TOC
#    with pg_restore --list.
# 3. Restores into a clean disposable database (herbally_restored).
# 4. Asserts canary rows survive restore intact, runs full expand+contract
#    schema/grant postcondition checks (--verify-only), and executes live
#    restored-DB RLS, revocation, and audit trigger assertions.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
SOURCE_DB="${PGDATABASE:-herbally_test}"
RESTORE_DB="${SOURCE_DB}_restored"
ADMIN_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/postgres"
SOURCE_URL="${DATABASE_URL:-postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${SOURCE_DB}}"
RESTORE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${RESTORE_DB}"
DUMP_DIR="$(mktemp -d)"
DUMP_FILE="${DUMP_DIR}/herbally-backup-drill.dump"
trap 'rm -rf "$DUMP_DIR" >/dev/null 2>&1 || true' EXIT
PG_BIN_IMAGE="${PG_BIN_IMAGE:-}"

run_pg_dump() {
  if [ -n "$PG_BIN_IMAGE" ]; then
    docker run --rm --network host -u "$(id -u):$(id -g)" -v "${DUMP_DIR}:${DUMP_DIR}" "$PG_BIN_IMAGE" pg_dump "$@"
  else
    pg_dump "$@"
  fi
}

run_pg_restore() {
  if [ -n "$PG_BIN_IMAGE" ]; then
    docker run --rm --network host -u "$(id -u):$(id -g)" -v "${DUMP_DIR}:${DUMP_DIR}" "$PG_BIN_IMAGE" pg_restore "$@"
  else
    pg_restore "$@"
  fi
}

export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE="$SOURCE_DB"

echo "==> Step 1: Preparing migrated source database (${SOURCE_DB})"
bash "${REPO_DIR}/scripts/test-migrations-postgres.sh"

echo "==> Step 2: Inserting backup-restore canary record into ${SOURCE_DB}"
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.herbs (
  name, slug, scientific_name, description, dosage_adult, is_published
) VALUES (
  'Restore Canary Botanical',
  'restore-canary-botanical',
  'Canaria restaurata',
  'Canary record verifying pg_dump and pg_restore integrity.',
  '250 mg daily',
  false
)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description;
SQL

echo "==> Step 3: Running pg_dump -Fc and verifying archive table of contents"
rm -f "$DUMP_FILE"
run_pg_dump --format=custom --no-owner --file="$DUMP_FILE" "$SOURCE_URL"
run_pg_restore --list "$DUMP_FILE" >/dev/null

echo "==> Step 4: Creating clean target database ${RESTORE_DB} and restoring archive"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${RESTORE_DB}\";"
run_pg_restore --no-owner --exit-on-error --dbname="$RESTORE_URL" "$DUMP_FILE"
rm -f "$DUMP_FILE"

echo "==> Step 5: Asserting canary row, postconditions, and live RLS/triggers on restored database"
CANARY_COUNT="$(psql "$RESTORE_URL" -tAc "SELECT count(*) FROM public.herbs WHERE slug = 'restore-canary-botanical';")"
if [ "$CANARY_COUNT" != "1" ]; then
  echo "ERROR: Expected 1 restore-canary-botanical row after pg_restore, got ${CANARY_COUNT}"
  exit 1
fi

bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase all --verify-only --repo-dir "$REPO_DIR" --psql-url "$RESTORE_URL"

psql "$RESTORE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE
  v_visible INT;
  v_desc TEXT;
  v_rev_status TEXT;
  v_id UUID;
BEGIN
  -- 1) Restored RLS visibility for anon must still hide unconsented/expired reviewers
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO v_visible FROM public.reviewer_registry;
  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'Expected 2 consented active reviewers visible to anon on restored DB, got %', v_visible;
  END IF;
  RESET ROLE;

  -- 2) Restored column revocation must still block authenticated RETURNING herbs.description
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.herbs (name, slug, scientific_name, description, dosage_adult, is_published)
    VALUES ('Restored Auth Blocked', 'restored-auth-blocked', 'Test', 'Blocked.', '100 mg', false)
    RETURNING description INTO v_desc;
    RAISE EXCEPTION 'authenticated unexpectedly returned revoked herbs.description on restored DB';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  -- 3) Restored clinical revision trigger + needs_re_review must fire on service_role edit
  EXECUTE 'SET LOCAL ROLE service_role';
  INSERT INTO public.herbs (
    name, slug, scientific_name, description, dosage_adult, is_published, reviewed_by, last_reviewed
  ) VALUES (
    'Restored Trigger Check', 'restored-trigger-check', 'Restaura trigga', 'Before edit.', '150 mg', false, 'yasser-bheekun', now()
  )
  RETURNING id INTO v_id;

  UPDATE public.herbs
  SET description = 'After edit.'
  WHERE id = v_id
  RETURNING description, provenance->>'review_status' INTO v_desc, v_rev_status;

  IF v_desc <> 'After edit.' OR v_rev_status <> 'needs_re_review' THEN
    RAISE EXCEPTION 'Restored review reset trigger failed: desc=%, status=%', v_desc, v_rev_status;
  END IF;
  RESET ROLE;
END
$$;
ROLLBACK;
SQL

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);"
echo "✓ PostgreSQL 16 Backup -> Custom Dump -> Restore -> RLS/Trigger Verification Drill PASSED."
