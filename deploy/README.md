# HerbAlly Self-Hosted Stack (`deploy/`)

HerbAlly runs in production on the owner's self-hosted Windows/WSL2 Docker host (`herbally-db`, `herbally-rest`, `herbally-auth`, `herbally-app`, `herbally-caddy`, `herbally-tunnel`), fronted by Cloudflare Tunnel and Cloudflare DNS/CDN, and deployed automatically via the GitHub self-hosted runner (`.github/workflows/deploy.yml`).

> **Note:** `deploy/backup.sh` and `deploy/systemd/` remain as reference assets for a future Linux VPS + restic/B2 target. Current live backups run via `deploy/backup-local.sh` (AES-256 GPG encrypted `pg_dump` mirrored to Windows and pulled off-site to the owner's Mac).

## Directory Contents

| File                     | Purpose                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`     | `db` (Postgres 17.6), `db-init`, `rest` (PostgREST v14), `auth` (GoTrue v2), `app` (Next.js 16), `caddy` (Caddy 2.10), `tunnel` (`cloudflared`).    |
| `Caddyfile`              | TLS/HTTP routing for `herbally.app` (`app`) and `api.herbally.app` (`/rest/v1/*`, `/auth/v1/*`).                                                    |
| `cloudflared/config.yml` | Named Cloudflare Tunnel (`herbally`) ingress rules.                                                                                                 |
| `gen-keys.mjs`           | Mints `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`.                                                                                                 |
| `backup-local.sh`        | Current production backup script: `pg_dump -Fc` → `pg_restore --list` verify → AES-256 GPG → Windows mirror (14-day retention).                     |
| `.env.example`           | Stack secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, SMTP).                                                            |
| `app.env.example`        | Container runtime environment (`SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_CLOUD_API_KEY`, `STRIPE_*`, `SENTRY_*`, `UPSTASH_*`, `RATE_LIMIT_HASH_SECRET`). |

## Key Architecture Notes

1. **Build-time `NEXT_PUBLIC_*` inlining:** `docker-compose.yml` passes `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`ANON_KEY`) as a build argument and pins it at runtime so `app.env` never diverges from the client bundle. `extra_hosts` maps `api.herbally.app` to `127.0.0.1` during `docker compose build app` so static generation queries the local stack.
2. **No Envoy/Kong gateway:** Self-signed HS256 JWTs (`gen-keys.mjs`) are verified directly by PostgREST and GoTrue behind Caddy.
3. **Database migrations:** Schema changes in `supabase/migrations/` must be applied carefully against `herbally-db` before/with compatible app code; image rollbacks in `deploy.yml` restore only the `herbally-app` container image and do **not** auto-revert SQL migrations.
4. **Full operational procedures:** See [docs/DEPLOYMENT_RUNBOOK.md](../docs/DEPLOYMENT_RUNBOOK.md) and [docs/database-backup-strategy.md](../docs/database-backup-strategy.md).
