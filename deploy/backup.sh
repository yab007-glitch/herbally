#!/usr/bin/env bash
# Nightly database backup: pg_dump → restic → Backblaze B2.
#
#   ./deploy/backup.sh                 # take a backup
#   ./deploy/backup.sh --check         # verify the repo is readable
#   ./deploy/backup.sh --restore-test  # restore the newest snapshot into a
#                                      # throwaway database and compare its
#                                      # row counts with the live database
#
# Requires /srv/herbally/backups/restic.env with:
#   RESTIC_REPOSITORY=b2:herbally-backups:/db
#   RESTIC_PASSWORD=<the repo password>
#   B2_ACCOUNT_ID=...
#   B2_ACCOUNT_KEY=...
#   HC_PING_URL=...                    # optional dead man's switch
# and retention: 7 daily, 4 weekly, 6 monthly.
#
# Scheduled by the systemd timer herbally-backup.timer at 03:17 UTC, installed
# from deploy/systemd per deploy/README.md — the same time the GitHub Actions
# job used, deliberately, so the two never overlap.

set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source /srv/herbally/backups/restic.env
set +a

compose() { docker compose --project-directory deploy "$@"; }

hc_ping() {
  [ -n "${HC_PING_URL:-}" ] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HC_PING_URL}${1:-}" \
    || echo "WARNING: healthcheck ping to ${HC_PING_URL}${1:-} failed" >&2
  return 0
}

# EXIT, not ERR: an explicit `exit 1` from the drill mismatch, or a set -u
# abort, does not run an ERR trap.
trap '[ "$?" -ne 0 ] && hc_ping /fail' EXIT

case "${1:-}" in
  --check)
    restic snapshots --latest 3
    exit 0
    ;;
  --restore-test)
    tmpdb="restore_test_$(date +%s)"
    listing="$(restic ls latest)"
    if grep -qE '/herbally\.dump$' <<<"$listing"; then
      dump_node=/herbally.dump
    elif grep -qE '^herbally\.dump$' <<<"$listing"; then
      dump_node=herbally.dump
    else
      echo "FATAL: neither /herbally.dump nor herbally.dump in snapshot latest" >&2
      exit 1
    fi
    echo "restoring newest snapshot into database $tmpdb"
    compose exec -T db psql -U postgres -qc "CREATE DATABASE $tmpdb;"
    restic dump latest "$dump_node" | \
      compose exec -T db pg_restore -U postgres -d "$tmpdb" --exit-on-error
    count_sql='SELECT (SELECT count(*) FROM public.herbs), (SELECT count(*) FROM auth.users);'
    count_rows() {
      compose exec -T db psql -U postgres -d "$1" -tA -F, -c "$count_sql"
    }
    live_counts="$(count_rows postgres)"
    restored_counts="$(count_rows "$tmpdb")"
    echo "live counts:     $live_counts"
    echo "restored counts: $restored_counts"
    if [ "$live_counts" != "$restored_counts" ]; then
      echo "RESTORE DRILL FAILED: live ($live_counts) != restored ($restored_counts)" >&2
      echo "throwaway database $tmpdb left in place for inspection; drop it with:" >&2
      echo "  docker compose --project-directory deploy exec -T db psql -U postgres -qc \"DROP DATABASE $tmpdb;\"" >&2
      exit 1
    fi
    compose exec -T db psql -U postgres -qc "DROP DATABASE $tmpdb;"
    echo "restore test passed; throwaway database dropped; counts match: $restored_counts"
    exit 0
    ;;
esac

echo "[$(date -Is)] dumping"
# Ownership must travel with the dump: GoTrue crash-loops when the auth tables
# come back owned by postgres (Known traps, deploy/README.md).
compose exec -T db pg_dump -U postgres -d postgres -Fc \
  | restic backup --stdin --stdin-filename herbally.dump --tag nightly --host herbally

echo "[$(date -Is)] applying retention"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

echo "[$(date -Is)] done"
hc_ping
exit 0
