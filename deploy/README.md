# HerbAlly on a VPS — migration runbook

Everything in this directory is ready. **What is missing is the server itself**:
there is no VPS, no provider account and no SSH key on this machine, and buying
one is a payment decision only the owner can make. Nothing below can start
until that box exists.

Assessment, cost table and risk list: Team Memory
`knowledge/2026-11-10-herbally-vps-migration-assessment.md`.

## What this directory contains

| File | Purpose |
|---|---|
| `docker-compose.yml` | db + PostgREST + GoTrue + app + Caddy. Trimmed from upstream: no studio, realtime, storage, functions, supavisor, and **no Envoy gateway**. |
| `Caddyfile` | TLS + the `/auth/v1` and `/rest/v1` routing the gateway used to do. |
| `gen-keys.mjs` | Mints `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`. |
| `bootstrap.sh` | Ubuntu 24.04 hardening, swap, firewall, Docker. |
| `backup.sh` | pg_dump → restic → B2, plus a restore drill. |
| `.env.example` | Stack secrets (db, jwt, smtp). |
| `app.env.example` | The app's runtime environment. |

### Why there is no Kong/Envoy here

The hosted project issues opaque keys (`sb_publishable_…`, `sb_secret_…`).
PostgREST cannot verify those; the gateway exists to translate them into roles.
Self-hosting lets us mint ordinary HS256 JWTs instead, which PostgREST and
GoTrue consume directly. That removes a container, a config format and a whole
class of "the gateway is up but the route map is wrong" failures.

The cost is that **the keys change**, so the image must be rebuilt with the new
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## The one ordering trap

`NEXT_PUBLIC_SUPABASE_URL` is inlined into the client bundle at build time, and
`next build` also reads the database (sitemap, symptom hubs). So the build needs
`https://api.herbally.app` to resolve and serve **before** it runs.

Sequence that works:

1. DNS zone moves to Cloudflare, still pointing at Vercel (nothing changes).
2. Add `api.herbally.app` → VPS IP, **DNS-only**, before the box is ready.
3. Caddy issues a real certificate for `api.herbally.app`.
4. Restore the database behind that name.
5. Build the image — now the URL resolves.
6. Only then move the apex.

Building first and pointing DNS later produces an image whose API calls fail in
the browser, and the failure is silent until someone opens devtools.

## Step 0 — the box

**OVHcloud VPS-2, region Beauharnois (BHS)** — 4 vCore / 8 GB / 75 GB NVMe,
unmetered, daily 24 h snapshot, ≈ C$13.38/mo with tax. Ubuntu 24.04 LTS,
**SSH key only** at creation (no root password), hostname `herbally`.

Hetzner CX33 (Falkenstein/Ashburn) is the fallback if BHS is out of stock; there
is no Hetzner Canadian region, which costs ~100 ms of latency to a mostly
Canadian audience.

Then, from this machine:

```bash
ssh-keygen -t ed25519 -C herbally-vps -f ~/.ssh/herbally_vps   # if you have none
ssh-copy-id -i ~/.ssh/herbally_vps.pub ubuntu@<ip>             # or paste the pubkey at creation
ssh -i ~/.ssh/herbally_vps ubuntu@<ip> 'sudo bash -s' < deploy/bootstrap.sh
```

`bootstrap.sh` does not lock out the current session; it disables password auth
and enables `ufw`, so confirm a second login works **before** closing the first.

## Step 1 — DNS to Cloudflare

Do this while the records still point at Vercel. Nothing about the site changes.

**Import `deploy/dns/herbally.app.zone`** — Cloudflare accepts that BIND format
directly (DNS → Records → Import). It is the live zone captured from the Vercel API
on 2026-11-10, all **16** records, with TTL 300 already set on the two that move.
Do not retype it: the two DKIM keys are 392-character RSA blobs, and one wrong
character drops mail into spam without failing anywhere.

What must be present afterwards:

- apex + `*` → CNAME `a7dd14f1431f0dc6.vercel-dns-017.com` / `cname.vercel-dns-016.com`
  (Vercel calls these ALIAS; Cloudflare flattens the apex CNAME)
- `MX` 10/20/50 → `mx.zohocloud.ca`, `mx2`, `mx3`
- `TXT` SPF `v=spf1 include:zohocloud.ca ~all`
- `TXT zoho._domainkey` (DKIM), `TXT _dmarc` (p=none, rua/ruf to info@)
- `CNAME bnc.outreach`, `TXT bk1._domainkey.outreach`, `TXT _dmarc.outreach`
- Google + Zoho verification TXT
- `CAA` letsencrypt / pki.goog / sectigo

Then switch nameservers at Name.com and **send a test email in and out** before
continuing. A missing DKIM record does not fail loudly — it quietly lands mail
in spam. Verify with `dig +short TXT zoho._domainkey.herbally.app @1.1.1.1`.

Add `api.herbally.app` A → VPS IP, **DNS-only** (grey cloud). The API is not
cacheable and ACME is simpler without the proxy in the way.

## Step 2 — the stack

```bash
sudo -i
mkdir -p /srv/herbally && cd /srv/herbally
# rsync the repo (from your machine): rsync -av --exclude node_modules --exclude .git ./ app/
cd app/deploy

cp .env.example .env && chmod 600 .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
node gen-keys.mjs -o .env          # or: docker run --rm -v $PWD:/w -w /w node:22 node gen-keys.mjs -o .env

# Supabase's init scripts (roles.sql + jwt.sql) are vendored under
# deploy/supabase/volumes/db/ so the deploy dir is self-contained.
chmod +x bootstrap.sh backup.sh

docker compose up -d db
docker compose ps                  # db must be healthy before anything else
```

`db-init` runs automatically as a dependency of `auth` and `rest`. It fixes the
one thing that otherwise crash-loops GoTrue on a fresh volume — see
**Verified** below. It is idempotent and safe to leave in place.

## Step 3 — move the data

Run these on the VPS. The dump is taken **inside the `supabase/postgres` image**
so `pg_dump` matches the server version, and it is piped straight into the
restore — no 150 MB file left lying around.

```bash
cd /srv/herbally/app/deploy
read -rsp 'hosted DATABASE_URL (session pooler, port 5432): ' SRC; echo

# Ownership and grants are preserved on purpose: the auth tables must stay
# owned by supabase_auth_admin or GoTrue cannot run its migrations, and the
# public GRANTs to anon/authenticated/service_role are what RLS sits on top of.
docker run --rm supabase/postgres:17.6.1.136 \
  pg_dump --dbname="$SRC" --schema=public -Fc -f - > /srv/herbally/backups/public.dump

docker run --rm supabase/postgres:17.6.1.136 \
  pg_dump --dbname="$SRC" --schema=auth -Fc -f - > /srv/herbally/backups/auth.dump
```

Restore, while `auth` and `rest` are **still stopped**:

```bash
# public — the dump carries CREATE EXTENSION for pg_trgm, so a clean slate is fine
docker run --rm -i --network herbally_default supabase/postgres:17.6.1.136 \
  pg_restore --dbname="postgres://postgres:$POSTGRES_PASSWORD@db:5432/postgres" \
             --clean --if-exists --exit-on-error \
  < /srv/herbally/backups/public.dump

# auth — pg_dump -n does NOT emit CREATE SCHEMA, so create it first
docker compose exec -T db psql -U postgres -c \
  "CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;"
docker run --rm -i --network herbally_default supabase/postgres:17.6.1.136 \
  pg_restore --dbname="postgres://postgres:$POSTGRES_PASSWORD@db:5432/postgres" \
             --exit-on-error \
  < /srv/herbally/backups/auth.dump
```

`$POSTGRES_PASSWORD` is in `deploy/.env`; `source .env` first.

Verify before starting anything else:

```bash
docker compose exec -T db psql -U postgres -d postgres <<'SQL'
SELECT count(*) AS herbs            FROM public.herbs;
SELECT count(*) AS published        FROM public.herbs WHERE is_published;
SELECT count(*) AS users            FROM auth.users;
SELECT count(*) AS policies         FROM pg_policies WHERE schemaname='public';
SELECT extname FROM pg_extension WHERE extname='pg_trgm';
EXPLAIN (COSTS OFF) SELECT id FROM herbs WHERE name ILIKE '%ginger%';  -- GIN index
SQL
```

Expected: 3,348 herbs, 3,238 published, 7 users, 59 policies, `pg_trgm` present.

## Step 4 — build and run

`deploy/app.env` is the app's runtime environment. Fill it from Vercel, then
change the three Supabase lines:

```bash
vercel env pull deploy/app.env --environment=production   # run on your own machine
chmod 600 deploy/app.env
# then edit:
#   NEXT_PUBLIC_SUPABASE_URL=https://api.herbally.app
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from deploy/.env>
#   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from deploy/.env>
# and add:
#   TRUST_PROXY_HEADERS=1
#   RATE_LIMIT_BACKEND=memory
```

Then:

```bash
docker compose up -d auth rest caddy
docker compose ps                     # auth + rest healthy
curl -sS https://api.herbally.app/rest/v1/herbs?select=id&limit=1 \
  -H "apikey: $ANON_KEY"
```

Build the app (needs `api.herbally.app` to resolve — see the ordering trap):

```bash
docker compose build app              # ~3-6 min
docker compose up -d app
docker compose logs -f app            # wait for "Ready"
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' http://127.0.0.1:3000/api/health
```

## Step 5 — verify before cutover

- 20 representative URLs: EN + FR herb page, symptom hub, compare, interactions,
  calculator, herbalist, admin, embed.
- Cold request then warm request — the second should be much faster (ISR is
  actually holding now).
- Sign in with one of the 7 existing accounts (bcrypt hashes travel in
  `auth.users`), and check password reset lands on `/auth/callback`.
- Re-point the Stripe webhook to `https://herbally.app/api/webhooks/stripe` and
  put the new signing secret in `app.env`, then `docker compose up -d app`.
- One newsletter send; one view-beacon write; Sentry receiving.

## Step 6 — cutover and rollback

```bash
# Cloudflare: apex + www A → VPS IP (proxied or DNS-only, see below)
# keep the Vercel project and its env untouched for 30 days
```

Watch `/api/health`, error rate and TTFB for 24 h.

**Rollback is one DNS record** — flip the apex back to `cname.vercel-dns.com`
(TTL 300, ~5 min). Keep Vercel Pro for 30 days and leave the hosted Supabase
project **paused, not deleted** until the VPS has run clean for two weeks.

### Cloudflare proxy: read this first

If the apex is proxied (orange cloud), every request reaches the app from a
Cloudflare edge IP. IP-based rate limiting then collapses into one shared
bucket — which would throttle every user together the moment one bot misbehaves.
The `Caddyfile` already forwards `CF-Connecting-IP` when present, so proxying is
supported. **Start DNS-only**, confirm behaviour, then enable the proxy and
check that `/api/chat` still rate-limits per visitor rather than globally.

## Backups

```bash
# /srv/herbally/backups/restic.env, mode 600:
#   RESTIC_REPOSITORY=b2:herbally-backups:/db
#   RESTIC_PASSWORD=...
#   B2_ACCOUNT_ID=...
#   B2_ACCOUNT_KEY=...

echo '17 3 * * * root /srv/herbally/app/deploy/backup.sh >> /var/log/herbally-backup.log 2>&1' \
  > /etc/cron.d/herbally-backup
```

Monthly, run `./backup.sh --restore-test` — an untested backup is not a backup.
The GitHub Actions nightly job keeps running against the hosted project until
it is paused; after cutover it should point at the new database instead.

## Verified

Run on Docker 29.5.2 (Ubuntu 24.04 VM), from an empty volume:

| Check | Result |
|---|---|
| `db`, `rest`, `auth` healthchecks | all healthy on a cold start |
| JWT minted by `gen-keys.mjs` | accepted by PostgREST; a bad signature returns 401 |
| RLS | anon key saw only `is_published = true` rows |
| `/rest/v1/*` through Caddy | 200, prefix stripped correctly |
| `/auth/v1/*` through Caddy | 200 |
| Unknown path through Caddy | 404 |
| GoTrue migration head | `20260831180000` — **identical to the hosted project**, so a restore runs zero migrations |
| `Caddyfile` | `caddy validate` passes |

**Not** verified yet, because they need the box or the hosted password: the app
image build (needs `api.herbally.app` to resolve), `pg_restore` of the real
150 MB dump, certificate issuance, and mail delivery.

## Known traps

| Trap | Why it bites |
|---|---|
| Building before `api.herbally.app` resolves | `NEXT_PUBLIC_*` is baked in; API calls fail only in the browser |
| Mounting `/app/.next/server/app` | Docker seeds it from the old image → stale pages after every deploy |
| Restoring `auth` without `CREATE SCHEMA auth` | `pg_dump -n` does not emit `CREATE SCHEMA` |
| Letting GoTrue migrate the image's pre-seeded `auth` schema | `must be owner of function uid` — GoTrue connects as `supabase_auth_admin`, the image's functions belong to `postgres`. `db-init` replaces the schema, but never one that came from the dump |
| Dumping with `--no-owner` into the migration | `supabase_auth_admin` loses ownership of `auth` tables; GoTrue cannot migrate |
| Missing DKIM during the DNS move | Mail keeps flowing but starts landing in spam |
| Cancelling Vercel with DNS still there | Resolution and email go down together |
| Forgetting Stripe's new signing secret | Webhook returns 400 and donations stop recording |
