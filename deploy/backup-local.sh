#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/srv/herbally/backups/local"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%d_%H%M%SZ)"
OUT="$BACKUP_DIR/herbally-${STAMP}.dump"
TMP="$OUT.tmp"
docker exec herbally-db pg_dump -U postgres -d postgres -Fc --no-owner > "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"
# Verify archive is readable by pg_restore
docker exec -i herbally-db pg_restore --list < "$OUT" > /dev/null
# Keep newest 14 daily dumps
ls -1t "$BACKUP_DIR"/herbally-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -lh "$OUT"
