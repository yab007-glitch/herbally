#!/usr/bin/env bash
# Non-destructive PostgreSQL 16 Backup & Restore Drill (CI Gate).
#
# 1. Provisions and verifies source database (targeted migrations 00097-00104)
#    plus deterministic canary rows.
# 2. Creates a custom-format backup with pg_dump -Fc and inspects archive TOC
#    with pg_restore --list.
# 3. Restores into a clean disposable database (herbally_restored).
# 4. Asserts canary rows survive restore intact and executes the full
#    supabase/tests/clinical-safety-integration.sql suite against the restored DB
#    to prove RLS policies, AAL2 triggers, and pediatric quarantines survive backup/restore.

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
DUMP_FILE="/tmp/herbally-backup-drill.dump"

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
pg_dump --format=custom --no-owner --file="$DUMP_FILE" "$SOURCE_URL"
pg_restore --list "$DUMP_FILE" >/dev/null

echo "==> Step 4: Creating clean target database ${RESTORE_DB} and restoring archive"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${RESTORE_DB}\";"
pg_restore --no-owner --exit-on-error --dbname="$RESTORE_URL" "$DUMP_FILE"
rm -f "$DUMP_FILE"

echo "==> Step 5: Asserting canary row & clinical-safety triggers on restored database"
CANARY_COUNT="$(psql "$RESTORE_URL" -tAc "SELECT count(*) FROM public.herbs WHERE slug = 'restore-canary-botanical';")"
if [ "$CANARY_COUNT" != "1" ]; then
  echo "ERROR: Expected 1 restore-canary-botanical row after pg_restore, got ${CANARY_COUNT}"
  exit 1
fi

bash "${REPO_DIR}/scripts/apply-pending-migrations.sh" --test-mode --phase all --verify-only --repo-dir "$REPO_DIR" --psql-url "$RESTORE_URL"
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -f "${REPO_DIR}/supabase/tests/clinical-safety-integration.sql"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);"
echo "✓ PostgreSQL 16 Backup -> Custom Dump -> Restore -> RLS/Trigger Verification Drill PASSED."
