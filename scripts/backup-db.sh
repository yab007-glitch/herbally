#!/usr/bin/env bash
#
# backup-db.sh — snapshot the HerbAlly database.
#
# Why this exists: the Supabase project runs on the Free plan, which includes
# NO backups (the dashboard reports "No backups"). The database *is* the
# product — 2,699 curated herbs with monographs, FAQs and hand-reviewed PubMed
# sheets — and it is the one asset here that cannot be rebuilt from this repo.
# Until this runs on a schedule, there is exactly one copy of it.
#
# Requires:
#   SUPABASE_DB_URL     Postgres connection string. Use the SESSION POOLER —
#                       GitHub runners have no IPv6, and Supabase's direct
#                       connection is IPv6-only. It looks like:
#                         postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
#                       Dashboard -> Project Settings -> Database -> Connection string
#   BACKUP_PASSPHRASE   Optional; if set, the dump is gpg-encrypted and the
#                       plaintext is removed. REQUIRED in CI: this repository is
#                       public, and workflow artifacts on a public repository are
#                       readable by anyone with a GitHub account.
#
# Usage:
#   ./scripts/backup-db.sh [output-dir]      # default: .backups/ (gitignored)
#
# Restore:
#   gpg --batch --pinentry-mode loopback --decrypt -o herbs.dump herbs.dump.gpg
#   pg_restore --list herbs.dump             # inspect before restoring
#   pg_restore --clean --if-exists --no-owner -d "$TARGET_DB_URL" herbs.dump
#
# Scope: the `public` schema only. The `auth` schema (email addresses, password
# hashes) needs elevated privileges to dump and is deliberately excluded — see
# the note at the bottom of this file.

set -euo pipefail

OUT_DIR="${1:-.backups}"
SCHEMA="public"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}
log() { printf '%s\n' "$*"; }

[ -n "${SUPABASE_DB_URL:-}" ] || fail "SUPABASE_DB_URL is not set (see the header of this script)."

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found. Install the PostgreSQL client tools."
command -v psql >/dev/null 2>&1 || fail "psql not found. Install the PostgreSQL client tools."

# pg_dump refuses to dump a server newer than itself, and the message it prints
# when that happens does not say what to do about it. Check up front so the
# failure names its own fix.
server_major=$(psql "$SUPABASE_DB_URL" -tAc "show server_version_num" | tr -d '[:space:]' | cut -c1-2)
[ -n "$server_major" ] || fail "Could not read the server version — check that SUPABASE_DB_URL is correct and reachable."
client_major=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if [ "$client_major" -lt "$server_major" ]; then
  fail "pg_dump is version $client_major but the server is $server_major. Install postgresql-client-$server_major — pg_dump can dump older servers, never newer ones."
fi

mkdir -p "$OUT_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
base="$OUT_DIR/herbally-$stamp.dump"

log "Dumping '$SCHEMA' (pg_dump $client_major -> server $server_major)..."
# Custom format: compressed, and pg_restore can list it and restore selectively.
# --no-owner/--no-privileges so it restores into a fresh project's roles without
# ownership errors. The dump itself is load on the same 0.5 GB instance the app
# runs on, so keep this to once a day — see the workflow schedule.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --schema="$SCHEMA" \
  --no-owner \
  --no-privileges \
  --file="$base"

# A backup that silently captures nothing is worse than no backup, because it
# looks like one. These two checks cover the realistic failure modes — an empty
# file, and a schema-only dump that has structure but no rows.
[ -s "$base" ] || fail "pg_dump produced an empty file."

size=$(wc -c <"$base" | tr -d ' ')
if [ "$size" -lt 1000000 ]; then
  fail "Dump is only $size bytes — far too small for this database. Treating as failed."
fi

if ! listing=$(pg_restore --list "$base"); then
  fail "Dump is unreadable (pg_restore could not list it). Treating as failed."
fi
printf '%s\n' "$listing" | grep -q "TABLE DATA $SCHEMA herbs" ||
  fail "Dump has no table data for $SCHEMA.herbs — it is schema-only or truncated. Treating as failed."

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  command -v gpg >/dev/null 2>&1 || fail "BACKUP_PASSPHRASE is set but gpg is not installed."
  encrypted="$base.gpg"
  # --passphrase-fd 0 keeps the passphrase out of the process list.
  printf '%s' "$BACKUP_PASSPHRASE" |
    gpg --batch --yes --quiet \
      --pinentry-mode loopback \
      --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 \
      --output "$encrypted" "$base"
  # Remove the plaintext: a copy kept next to the encrypted one defeats the
  # encryption, and in CI it is the difference between an artifact that is
  # inert and one that leaks the database onto a public repository.
  rm -f "$base"
  base="$encrypted"
  log "Encrypted with AES256."
else
  log "WARNING: BACKUP_PASSPHRASE is not set — writing an UNENCRYPTED dump."
  log "         Do not upload this anywhere public."
fi

sha256sum "$base" 2>/dev/null || shasum -a 256 "$base"
log "Wrote $base ($size bytes uncompressed)."
log ""
log "Store the passphrase somewhere you would still have it if this machine"
log "and the repository were gone. Without it the dump cannot be restored, and"
log "there is no recovery path for it."
log ""
log "Restore into a fresh database with:"
log "  pg_restore --clean --if-exists --no-owner -d \"\$TARGET_DB_URL\" \"$base\""

# NOTE — what this dump does NOT contain: the `auth` schema. Logins, email
# addresses and password hashes live there, and dumping it needs elevated
# privileges the `postgres` role does not have over the pooler. Restoring this
# dump therefore rebuilds the content and the `public` tables but not user
# accounts — `public.profiles` rows will exist without their `auth.users` rows.
# If you want accounts in the backup too, dump with `--schema=auth` using the
# project's database password and a privileged role, and treat the resulting
# file as sensitive personal data.
