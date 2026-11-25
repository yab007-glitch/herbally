#!/usr/bin/env bash
# Apply pending HerbAlly SQL migrations (00097–00099) safely on the production
# WSL2 Docker host after taking an on-demand encrypted backup.
#
# Usage (from WSL root on the host):
#   bash /srv/herbally/scripts/apply-pending-migrations-00097-00099.sh
#
# Optional overrides:
#   REPO_DIR=/path/to/herbally DB_CONTAINER=herbally-db bash ...

set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/herbally}"
DB_CONTAINER="${DB_CONTAINER:-herbally-db}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-${REPO_DIR}/deploy/backup-local.sh}"

MIGRATIONS=(
  "supabase/migrations/00097_admin_aal2_rls.sql"
  "supabase/migrations/00098_newsletter_confirmation_sent_at.sql"
  "supabase/migrations/00099_newsletter_send_lease.sql"
)

for rel in "${MIGRATIONS[@]}"; do
  if [ ! -f "${REPO_DIR}/${rel}" ]; then
    echo "Missing migration file: ${REPO_DIR}/${rel}" >&2
    exit 1
  fi
done

if [ ! -x "$BACKUP_SCRIPT" ]; then
  echo "Backup script not executable or missing: ${BACKUP_SCRIPT}" >&2
  exit 1
fi

echo "==> Running pre-migration encrypted backup via ${BACKUP_SCRIPT}"
"$BACKUP_SCRIPT"

for rel in "${MIGRATIONS[@]}"; do
  echo "==> Applying ${rel}"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "${REPO_DIR}/${rel}"
done

echo "==> Verifying schema & RLS objects in ${DB_CONTAINER}"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin_aal2'
  ) THEN
    RAISE EXCEPTION 'Missing function public.is_admin_aal2()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscribers'
      AND column_name = 'last_confirmation_sent_at'
  ) THEN
    RAISE EXCEPTION 'Missing column public.newsletter_subscribers.last_confirmation_sent_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscribers'
      AND column_name = 'confirmation_send_lease_until'
  ) THEN
    RAISE EXCEPTION 'Missing column public.newsletter_subscribers.confirmation_send_lease_until';
  END IF;
END
$$;
SQL

echo "✓ Migrations 00097–00099 applied and verified cleanly."
