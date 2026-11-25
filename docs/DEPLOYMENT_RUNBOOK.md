# HerbAlly Self-Hosted Deployment & Recovery Runbook

**Last Updated:** 2026-11-24
**Runtime Architecture:** Self-hosted Docker Compose (`herbally-db`, `herbally-rest`, `herbally-auth`, `herbally-app`, `herbally-caddy`, `herbally-tunnel`) on WSL2 + Cloudflare Tunnel + GitHub Actions self-hosted runner (`[self-hosted, linux, herbally]`).

---

## 1. Local & CI Quality Gates

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test:coverage
npm run build
```

Database integrity checks:

```bash
# Static migration check (no DB credentials required)
npx tsx scripts/verify-herb-database.ts --migrations-only

# Live database check (requires VERIFY_DB_SUPABASE_URL / VERIFY_DB_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_*)
npx tsx scripts/verify-herb-database.ts --ci --production-only
```

---

## 2. Production Deployment Flow (`.github/workflows/deploy.yml`)

1. Pushing to `main` triggers `.github/workflows/ci.yml` (`secrets`, `verify-migrations`, `verify-db`, `lint`, `typecheck`, `test`, `coverage`, `format`, `test-e2e`, `build`).
2. When `CI` succeeds on `push` to `main` (or via manual `workflow_dispatch`), `.github/workflows/deploy.yml` runs on the self-hosted runner:
   - Compares changed files against `/srv/herbally/.last-deployed-sha`; docs/artifact-only commits skip container rebuild/recreate.
   - Tags the running `herbally-app:local` image as `herbally-app:rollback`.
   - Syncs source to `/srv/herbally/` with `rsync -a --delete` while preserving `deploy/`, `backups/`, `artifacts/`, `.next`, and `node_modules`.
   - Builds `app` via `docker compose build` and recreates `herbally-app` after clearing stale Next.js fetch cache.
   - Polls Docker health (`http://127.0.0.1:3000/api/health`), runs live public smoke tests (`/`, `/api/interactions/check`, `/sitemap.xml`), and writes `/srv/herbally/.last-deployed-sha`.

---

## 3. Environment & Secrets

- Stack secrets live in `/srv/herbally/deploy/.env` (mode `600`, never committed; template: `deploy/.env.example`).
- App runtime variables live in `/srv/herbally/deploy/app.env` (mode `600`, never committed; template: `deploy/app.env.example`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is baked at build time via `deploy/.env` (`ANON_KEY`) and pinned by `docker-compose.yml`; do not duplicate it in `app.env`.
- Security headers (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Robots-Tag`) are enforced in `src/proxy.ts` and `next.config.ts`.

---

## 4. Schema Changes & Rollback Procedure

### Before Deploying SQL Migrations

1. Take an on-demand encrypted backup first:
   ```bash
   /srv/herbally/deploy/backup-local.sh
   ```
2. Verify the migration is backward-compatible with the currently running app image (or deploy in expand-then-contract phases).
3. Apply SQL explicitly inside `herbally-db` from the synced repository root (`/srv/herbally`):
   ```bash
   cd /srv/herbally
   docker exec -i herbally-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /srv/herbally/supabase/migrations/<NNNNN_file>.sql
   ```

### Application Rollback

If `deploy.yml` fails health or smoke checks, it automatically re-tags `herbally-app:rollback` → `herbally-app:local` and restarts `app`. For a manual rollback on the host:

```bash
cd /srv/herbally/deploy
docker tag herbally-app:rollback herbally-app:local
docker compose up -d --force-recreate --no-deps app
```

> **Schema compatibility warning:** Image rollback reverts only the Next.js container (`herbally-app`), **not** PostgreSQL schema changes. If a failed release included a migration under `supabase/migrations/`, verify whether the rolled-back code works with the current schema or restore from the pre-migration encrypted dump per [docs/database-backup-strategy.md](./database-backup-strategy.md).

---

## 5. Health & Smoke Verification

```bash
curl -fsS https://herbally.app/api/health
curl -fsSI https://herbally.app/
curl -fsS "https://herbally.app/api/interactions/check?herb=ginger&drug=warfarin"
```

Note on Cloudflare edge cache: after urgent content/code fixes, verify cache-busted origin (`?_v=...`) and purge Cloudflare cache in the Cloudflare dashboard if edge-cached HTML/XML is stale.
