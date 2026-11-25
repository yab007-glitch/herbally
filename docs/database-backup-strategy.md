# HerbAlly Self-Hosted Database Backup & Recovery Strategy

**Last Updated:** 2026-11-24
**Database Engine:** Self-hosted PostgreSQL 17 (`supabase/postgres:17.6.1.136`, container `herbally-db` on Docker volume `db-data`).

---

## 1. Current Backup Architecture

HerbAlly is **no longer** hosted on Supabase Pro PITR. Production data lives in the self-hosted `herbally-db` container and is protected by three layers:

1. **Primary host encrypted dump (`deploy/backup-local.sh`):**
   - Runs `docker exec herbally-db pg_dump -U postgres -d postgres -Fc` (custom format, preserving ownership such as `supabase_auth_admin` so GoTrue migrations continue working after restore).
   - Verifies archive readability with `pg_restore --list` before encryption.
   - Encrypts with AES-256 symmetric GPG (`--passphrase-file /srv/herbally/deploy/.backup-passphrase`) into `/srv/herbally/backups/local/herbally-<UTC>.dump.gpg` and removes the plaintext `.dump`.
   - Retains the newest 14 daily encrypted archives.
2. **Windows host mirror:**
   - Atomically copies each `.dump.gpg` to `/mnt/c/Users/yab_0/herbally-backups/` (14-day retention).
3. **Off-site Mac pull:**
   - Scheduled `launchd` job pulls encrypted `.dump.gpg` snapshots off the Windows/WSL host to the owner's Mac.
   - **Operational check requirement:** Always verify both `launchd` exit status and a non-destructive restore drill — recent file timestamps alone do not prove the scheduler exited `0` or that a snapshot restores cleanly.

---

## 2. On-Demand Pre-Migration Backup

Before applying any DDL/data migration to `herbally-db`:

```bash
/srv/herbally/deploy/backup-local.sh
```

Store a separate copy of `/srv/herbally/deploy/.backup-passphrase` in the owner's password manager — an encrypted backup cannot be decrypted without it.

---

## 3. Non-Destructive Restore Verification Drill

To prove an encrypted `.dump.gpg` archive decrypts and restores cleanly without touching production `postgres`, run the drill below as a single atomic script (`set -euo pipefail`, `umask 077`, restrictive `mktemp`, failure-preserving cleanup trap that retains evidence on error and cleans up only after verification passes, and explicit restored-count assertions):

```bash
bash -c '
set -euo pipefail
umask 077

DUMP_GPG="${1:?Usage: pass path to .dump.gpg}"
PASS_FILE="/srv/herbally/deploy/.backup-passphrase"
TMP_DUMP="$(mktemp -t herbally-restore-verify.XXXXXX.dump)"
CREATED_DB=0

cleanup() {
  rc=$?
  if [ "$rc" -eq 0 ]; then
    rm -f "$TMP_DUMP"
    if [ "$CREATED_DB" -eq 1 ]; then
      docker exec -i herbally-db psql -U postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS herbally_restore_test;" >/dev/null || true
    fi
  else
    echo "Restore verification FAILED (exit=$rc). Preserving failure evidence for inspection:" >&2
    echo "  Decrypted dump (mode 0600): $TMP_DUMP" >&2
    if [ "$CREATED_DB" -eq 1 ]; then
      echo "  Test database preserved: herbally_restore_test" >&2
      echo "  Clean up after inspection: rm -f \"$TMP_DUMP\" && docker exec -i herbally-db psql -U postgres -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS herbally_restore_test;\"" >&2
    else
      echo "  Clean up after inspection: rm -f \"$TMP_DUMP\"" >&2
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT

test -r "$DUMP_GPG"
test -r "$PASS_FILE"

gpg --batch --decrypt --passphrase-file "$PASS_FILE" "$DUMP_GPG" > "$TMP_DUMP"
test -s "$TMP_DUMP"

docker exec -i herbally-db psql -U postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS herbally_restore_test; CREATE DATABASE herbally_restore_test;"
CREATED_DB=1

docker exec -i herbally-db pg_restore -U postgres -d herbally_restore_test --exit-on-error < "$TMP_DUMP"

published_herbs="$(docker exec -i herbally-db psql -U postgres -d herbally_restore_test -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.herbs WHERE is_published;")"
drug_interactions="$(docker exec -i herbally-db psql -U postgres -d herbally_restore_test -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.drug_interactions;")"
auth_users="$(docker exec -i herbally-db psql -U postgres -d herbally_restore_test -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM auth.users;")"

echo "Restored counts: published_herbs=$published_herbs drug_interactions=$drug_interactions auth_users=$auth_users"
[ "$published_herbs" -ge 100 ]
[ "$drug_interactions" -ge 50 ]
[ "$auth_users" -ge 1 ]
echo "Restore verification PASSED."
' _ /srv/herbally/backups/local/<latest>.dump.gpg
```

---

## 4. Full Production Restore (Destructive — Emergency Only)

Decrypt and verify archive readability (`pg_restore --list`) **before** stopping services or touching production `postgres`. The restore script tracks stopped services and attaches a failure-safe `EXIT` trap that attempts to bring `auth`, `rest`, and `app` back up, validates container healthchecks and `http://127.0.0.1:3000/api/health`, preserves the restrictive temp dump on failure, and exits with the original failing status:

```bash
bash -c '
set -euo pipefail
umask 077

DUMP_GPG="${1:?Usage: pass path to .dump.gpg}"
PASS_FILE="/srv/herbally/deploy/.backup-passphrase"
TMP_DUMP="$(mktemp -t herbally-prod-restore.XXXXXX.dump)"
SERVICES_STOPPED=0

restart_and_verify() {
  cd /srv/herbally/deploy
  docker compose up -d auth rest app
  for i in $(seq 1 30); do
    auth_health="$(docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" herbally-auth 2>/dev/null || echo missing)"
    rest_health="$(docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" herbally-rest 2>/dev/null || echo missing)"
    app_health="$(docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" herbally-app 2>/dev/null || echo missing)"
    if [ "$auth_health" = "healthy" ] && [ "$rest_health" = "healthy" ] && [ "$app_health" = "healthy" ]; then
      docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health >/dev/null
      return 0
    fi
    sleep 2
  done
  echo "Health check timed out: auth=$auth_health rest=$rest_health app=$app_health" >&2
  return 1
}

cleanup() {
  rc=$?
  if [ "$rc" -eq 0 ]; then
    rm -f "$TMP_DUMP"
    exit 0
  fi

  echo "CRITICAL: Production restore FAILED (exit=$rc). Preserving decrypted dump (mode 0600) at: $TMP_DUMP" >&2
  echo "Remove manually once incident is resolved: rm -f \"$TMP_DUMP\"" >&2

  if [ "$SERVICES_STOPPED" -eq 1 ]; then
    echo "Attempting emergency restart and health verification of auth, rest, and app..." >&2
    if restart_and_verify; then
      echo "Services restarted and passed health checks, BUT the restore FAILED (exit=$rc). Verify database state manually before resuming traffic!" >&2
    else
      echo "MANUAL INTERVENTION REQUIRED: automatic service restart/health verification FAILED after restore failure (exit=$rc)." >&2
      echo "Inspect: cd /srv/herbally/deploy && docker compose ps && docker compose logs --tail=100 db auth rest app" >&2
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT

test -r "$DUMP_GPG"
test -r "$PASS_FILE"

gpg --batch --decrypt --passphrase-file "$PASS_FILE" "$DUMP_GPG" > "$TMP_DUMP"
test -s "$TMP_DUMP"
docker exec -i herbally-db pg_restore --list < "$TMP_DUMP" >/dev/null

cd /srv/herbally/deploy
SERVICES_STOPPED=1
docker compose stop auth rest app
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --exit-on-error < "$TMP_DUMP"
restart_and_verify
SERVICES_STOPPED=0
echo "Production restore PASSED and services are healthy."
' _ /srv/herbally/backups/local/<target>.dump.gpg
```

> **If automatic restart or health validation fails (`MANUAL INTERVENTION REQUIRED`):**
>
> 1. Inspect container states and recent logs in `/srv/herbally/deploy`: `docker compose ps && docker compose logs --tail=100 db auth rest app`.
> 2. Confirm `herbally-db` is healthy and check whether the partial restore left `postgres` inconsistent; if needed, re-run `pg_restore` against a verified archive or restore `auth`/`rest` roles (`supabase/volumes/db/auth-schema-ownership.sql` reference).
> 3. Only after `docker compose up -d auth rest app` and `http://127.0.0.1:3000/api/health` succeed should you remove the preserved `$TMP_DUMP` file (`rm -f "$TMP_DUMP"`).

---

## 5. Migration Discipline

- Never edit an already-applied migration under `supabase/migrations/`; always add a new `NNNNN_description.sql` file.
- Run `npx tsx scripts/verify-herb-database.ts --migrations-only` in CI and `--ci --production-only` against `api.herbally.app` once CI credentials are configured.
