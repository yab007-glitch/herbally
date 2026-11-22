#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/srv/herbally/backups/local"
WIN_DIR="/mnt/c/Users/yab_0/herbally-backups"
PASSPHRASE_FILE="/srv/herbally/deploy/.backup-passphrase"

if [ ! -f "$PASSPHRASE_FILE" ]; then
  echo "FATAL: passphrase file not found: $PASSPHRASE_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR" "$WIN_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%d_%H%M%SZ)"
OUT="$BACKUP_DIR/herbally-${STAMP}.dump"
TMP="$OUT.tmp"
GPG_OUT="${OUT}.gpg"

# Ownership must travel with the dump: GoTrue crash-loops when auth tables
# come back owned by postgres.
docker exec herbally-db pg_dump -U postgres -d postgres -Fc > "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"

# Verify archive is readable by pg_restore before encrypting.
docker exec -i herbally-db pg_restore --list < "$OUT" > /dev/null

# Symmetrically encrypt with AES-256 and remove the plaintext .dump immediately.
gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-file "$PASSPHRASE_FILE" \
  -o "${GPG_OUT}.tmp" "$OUT"
mv "${GPG_OUT}.tmp" "$GPG_OUT"
chmod 600 "$GPG_OUT"
test -s "$GPG_OUT"
rm -f "$OUT"

# Mirror the encrypted archive off WSL onto Windows C: atomically.
cp "$GPG_OUT" "$WIN_DIR/herbally-${STAMP}.dump.gpg.part"
mv "$WIN_DIR/herbally-${STAMP}.dump.gpg.part" "$WIN_DIR/herbally-${STAMP}.dump.gpg"

# Ensure no unencrypted nightly dumps linger in either directory.
rm -f "$BACKUP_DIR"/herbally-*.dump "$WIN_DIR"/herbally-*.dump 2>/dev/null || true

# Keep newest 14 daily encrypted dumps in both locations.
ls -1t "$BACKUP_DIR"/herbally-*.dump.gpg 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$WIN_DIR"/herbally-*.dump.gpg 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -lh "$GPG_OUT" "$WIN_DIR/herbally-${STAMP}.dump.gpg"
