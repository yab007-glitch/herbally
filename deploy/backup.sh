#!/usr/bin/env bash
# Nightly database backup: pg_dump → restic → Backblaze B2.
#
#   ./deploy/backup.sh                 # take a backup
#   ./deploy/backup.sh --check         # verify the repo is readable
#   ./deploy/backup.sh --restore-test  # restore the newest snapshot into a
#                                      # throwaway database and count rows
#
# Requires /srv/herbally/backups/restic.env with:
#   RESTIC_REPOSITORY=b2:herbally-backups:/db
#   RESTIC_PASSWORD=<the repo password>
#   B2_ACCOUNT_ID=...
#   B2_ACCOUNT_KEY=...
# and retention: 7 daily, 4 weekly, 6 monthly.
#
# Scheduled from /etc/cron.d/herbally-backup at 03:17 UTC — the same time the
# GitHub Actions job used, deliberately, so the two never overlap.

set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source /srv/herbally/backups/restic.env
set +a

compose() { docker compose --project-directory deploy "$@"; }

case "${1:-}" in
  --check)
    restic snapshots --latest 3
    exit 0
    ;;
  --restore-test)
    tmpdb="restore_test_$(date +%s)"
    echo "restoring newest snapshot into database $tmpdb"
    compose exec -T db psql -U postgres -qc "CREATE DATABASE $tmpdb;"
    restic dump latest herbally.dump | \
      docker run --rm -i --network "herbally_default" -e PGPASSWORD="$POSTGRES_PASSWORD" \
        supabase/postgres:17.6.1.136 \
        pg_restore --no-owner --dbname "postgres://postgres@db:5432/$tmpdb" --exit-on-error
    compose exec -T db psql -U postgres -d "$tmpdb" \
      -c "SELECT count(*) AS herbs FROM herbs;" \
      -c "SELECT count(*) AS users FROM auth.users;"
    compose exec -T db psql -U postgres -qc "DROP DATABASE $tmpdb;"
    echo "restore test passed; throwaway database dropped"
    exit 0
    ;;
esac

echo "[$(date -Is)] dumping"
compose exec -T db pg_dump -U postgres -d postgres -Fc --no-owner \
  | restic backup --stdin --stdin-filename herbally.dump --tag nightly --host herbally

echo "[$(date -Is)] applying retention"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

echo "[$(date -Is)] done"
