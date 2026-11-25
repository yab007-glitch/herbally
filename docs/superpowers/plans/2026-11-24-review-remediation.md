# HerbAlly Independent Review Remediation Plan (2026-11-24)

Baseline HEAD: `1aa6bb48ded5b5ce46ae96c4a4434c2b42df4ed8`
Pre-existing dirty files preserved untouched:
`artifacts/adsense-watch.json`, `artifacts/expand-import-report.json`, `artifacts/ads-consent-salvage-20261116/`, `artifacts/fr-monograph-pilot-20261117/`, `ours-1.json`, `ours-1.png`, `ours-2.json`, `ours-2.png`.

---

## 1. Safety Correctness

- [x] **Finding 1 — Interaction availability failures become false negatives**
  - Introduced `InteractionDataUnavailableError` and `isStubSupabase()` in `src/lib/interactions/errors.ts`.
  - Updated `src/lib/interactions/resolve-herb.ts` to throw `InteractionDataUnavailableError` when Supabase is unavailable or any query fails (returning `null` only on clean 0-row matches).
  - Updated `src/lib/interactions/pairs.ts` (`getInteractionPair`, `getHerbPairs`) to throw `InteractionDataUnavailableError` on missing client, query errors, or timeouts instead of degrading to `null`/`[]`.
  - Updated `src/app/[locale]/(main)/interactions/[herb]/[drug]/page.tsx` and `src/app/[locale]/(main)/interactions/[herb]/page.tsx` to propagate `InteractionDataUnavailableError` as a retryable 500 (preserving `placeholder.supabase.co` stub behavior for CI).
  - Verified `GET /api/interactions/check` and `POST /api/interactions/check-stack` return HTTP 503 `{ unavailable: true }` on DB failure.
  - TDD: Added failing-then-passing regression tests in `src/lib/interactions/__tests__/availability-and-collisions.test.ts`, `src/app/api/interactions/__tests__/check.route.test.ts`, and `src/app/[locale]/(main)/interactions/[herb]/[drug]/__tests__/page.test.tsx`.

- [x] **Finding 2 — Stale clinical results after input edits**
  - Updated `src/components/interactions/stack-checker.tsx` to invalidate stale `result`, `showWalletCard`, and `error` on every input/draft/sample/chip mutation, and render the wallet card strictly from the `result` snapshot rather than mutable `herbs`/`drugs` state.
  - Updated `src/components/calculator/dose-calculator-form.tsx` and `src/components/calculator/profile-integration.tsx` to use an immutable `CalculationSnapshot`, invalidate `snapshot` / `safetyBlock` / `error` on every field/toggle/range/formula edit, pass converted `weightKg` to `SaveCalcButton`, and surface save failures cleanly.
  - TDD: Extended `src/components/interactions/__tests__/stack-checker.test.tsx` and `src/components/calculator/__tests__/dose-calculator-form.test.tsx` with edit-after-result regression tests.

- [x] **Finding 3 — NPN partial upstream failures presented/cached as complete**
  - Updated `src/app/api/npn/lookup/route.ts` to expose `sectionStatus`, `unavailableSections`, `herbMatchingUnavailable`, and `partial`; return HTTP 502 if all 4 LNHPD sections fail; suppress public caching (`Cache-Control: no-store`) whenever `partial` is true.
  - Updated `src/components/npn/npn-checker-client.tsx` to display prominent partial-data alerts and explicit per-section unavailable notices (especially for `risks` and `ingredients`).
  - TDD: Added failing-then-passing tests in `src/app/api/npn/__tests__/lookup.route.test.ts` and `src/components/npn/__tests__/npn-checker-client.test.tsx`.

- [x] **Finding 7 — Garden partial write failures & DELETE acknowledgment**
  - Updated `src/app/api/garden/route.ts` `POST` to return `savedSlugs` and HTTP 500 when all writes fail / 207 on partial failure; include `{ removed: true, slug }` on `DELETE`.
  - Updated `src/lib/garden/local-garden.ts` so `markSynced` is called only when the server explicitly acknowledges the specific slug, and `removeHerbFromServer` checks `res.ok && data?.removed === true` before clearing synced tracking.
  - TDD: Added failing-then-passing tests in `src/app/api/garden/__tests__/route.test.ts` and `src/lib/garden/__tests__/local-garden.test.ts`.

---

## 2. Security & Privacy

- [x] **Finding 5 (Repo/Code Portion) — Admin MFA boundary & AAL2 RLS migration** _(Live migration apply & AAL1/AAL2 REST verification pending owner execution)_
  - Updated `src/lib/actions/admin-mfa.ts` to block `startAdminTotpEnrollment` and unverified-factor `verifyAdminTotpCode` when a verified factor already exists and `aal.currentLevel !== "aal2"`.
  - Authored `supabase/migrations/00097_admin_aal2_rls.sql` with `public.is_admin_aal2()` and AAL2-gated admin policies (not applied live).
  - TDD: Added failing-then-passing tests in `src/lib/actions/__tests__/admin-mfa.test.ts` and `src/__tests__/admin-aal2-rls.test.ts`.

- [x] **Finding 6 — Service worker narrow public allowlist & honest offline responses**
  - Updated `public/sw.js` to bump cache versions, remove personalized routes from pre-cache, deny `/auth/`, `/admin`, `/profile`, `/garden`, and non-allowlisted `/api/*`, cache only public GETs without `private`/`no-store`/`no-cache`/`Set-Cookie`, return HTTP 503 JSON on offline API misses (never HTTP 200 `[]`), and support `CLEAR_CACHES` messages.
  - TDD: Added failing-then-passing tests in `src/__tests__/service-worker.test.ts`.

- [x] **Finding 8 — Complete local-data clearing & honest AI-cache retention disclosure**
  - Created `src/lib/privacy/storage-inventory.ts` covering all localStorage/sessionStorage keys (including `herbally-garden-notes`, `herbally-garden-removed`, `herbally-garden-synced`) plus Cache Storage.
  - Updated `src/components/privacy/clear-local-data-button.tsx` to clear all layers asynchronously and report honest success/failure UI; wired `clearBrowserCaches()` into logout in `src/components/auth/account-menu.tsx`.
  - Updated `src/lib/i18n/dictionaries/en/server.json` and `fr/server.json` to clearly disclose 7-day unlinked `ai_response_cache` retention alongside immediate session deletion.
  - TDD: Extended `src/components/privacy/__tests__/clear-local-data-button.test.tsx`.

- [x] **Finding 9 & Minor #2 (App Portion) — Atomic/timeout-safe HMAC rate limiting & streaming body caps** _(Cloudflare/PostgREST edge confirmation remains owner-verified)_
  - Updated `src/lib/rate-limit.ts` to hash keys with keyed HMAC-SHA256 (`RATE_LIMIT_HASH_SECRET` fallback), replace `/pipeline` with an atomic Redis Lua `EVAL`, enforce fetch `AbortSignal.timeout`, and bound in-memory key cardinality.
  - Created `src/lib/http/read-json-body.ts` streaming byte-cap reader and applied across all 10 JSON POST routes (`chat`, `garden`, `check-stack`, `newsletter`, `analytics/vitals`, `interpret-search`, `herbs/view`, `donate`, `revalidate-herb`, `revalidate-pubmed-sheet`), fixing `/api/chat` 10× post-parse cap.
  - TDD: Extended `src/lib/rate-limit.test.ts`, created `src/lib/http/__tests__/read-json-body.test.ts`, and added `src/app/api/__tests__/chat-body-limit.test.ts`.

- [x] **Finding 10 — Newsletter uniform external response & per-address cooldown**
  - Updated `src/lib/newsletter/subscribe.ts`, `src/app/api/newsletter/route.ts`, and `src/components/marketing/newsletter-signup.tsx` to return one uniform `{ ok: true, status: "accepted" }` outcome and enforce a 15-minute per-address resend cooldown.
  - TDD: Extended `src/lib/newsletter/__tests__/subscribe.test.ts` and added `src/app/api/newsletter/__tests__/route.test.ts`.

- [x] **Minor Security/Auth/Logging Fixes (Item 12)**
  - Fixed `returnTo` query/hash concatenation in `src/lib/actions/auth.ts`.
  - Removed donor email & amount from routine stdout in `src/app/api/webhooks/stripe/route.ts`.
  - Aligned registration/reset password `minLength` to `12` in `src/components/auth/auth-forms.tsx` and EN/FR `core.json`.
  - TDD: Added failing-then-passing tests in `src/lib/actions/auth.test.ts`, `src/app/api/webhooks/stripe/route.test.ts`, and `src/components/auth/__tests__/auth-forms.test.tsx`.

---

## 3. Data Integrity

- [x] **Finding 4 (Technical Detection & Fail-Safe) — Interaction URL collision detection & fail-safe resolution** _(Editorial disambiguation of the 6 live pairs pending owner clinical decision)_
  - Added `EDITORIAL_PAIR_CANONICAL_DRUG`, `findPairUrlCollisions()`, and deterministic `.order("drug_name").order("id")` in `src/lib/interactions/pair-url.ts` and `src/lib/interactions/pairs.ts`.
  - Throws `InteractionUrlCollisionError` on unresolved multi-row URL collisions and renders a fail-safe page displaying all colliding records with `noindex, nofollow` without choosing clinical severity or merging records.
  - Logs sitemap collisions in `src/app/sitemap.ts` and fails `scripts/verify-herb-database.ts` on unresolved collisions.

- [x] **Finding 11 (Script/CI Portion) — Truthful `verify-db` & implemented safety-conflict check** _(GitHub Secrets `VERIFY_DB_SUPABASE_URL` / `VERIFY_DB_SUPABASE_ANON_KEY` / `REQUIRE_LIVE_VERIFY_DB=true` pending owner configuration)_
  - Extracted pure verification rules into `src/lib/db/verify-rules.ts` (`classifySupabaseTarget`, `checkSafetyConflicts`).
  - Updated `scripts/verify-herb-database.ts` so `--ci` fails honestly when credentials are missing/placeholder, separates `legacy-hosted` vs `production` targets (`--production-only`), supports `--migrations-only`, and enforces safety-conflict + URL-collision rules.
  - Updated `.github/workflows/ci.yml` to run `verify-migrations` and guard `verify-db` with `REQUIRE_LIVE_VERIFY_DB` / secret presence without masking empty credentials as live DB coverage.
  - TDD: Created `src/lib/db/__tests__/verify-rules.test.ts`.

---

## 4. Operational Assurance

- [x] **CI Formatting & Lint Warnings**
  - Formatted `docs/agent-tasks/2026-11-24-source-thin-herbs.md` with Prettier.
  - Fixed all 4 unused-variable ESLint warnings (`sitemap.ts`, `herbs/[slug]/page.tsx`, `author-byline.tsx`).

- [x] **Finding 14 — Self-hosted deployment/recovery/backup docs & `deploy.yml` safeguards**
  - Rewrote `deploy/README.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `docs/database-backup-strategy.md` for self-hosted Docker Compose + Caddy + Cloudflare Tunnel + `backup-local.sh` architecture, updated `README.md`, and documented `RATE_LIMIT_HASH_SECRET` in `deploy/app.env.example`.
  - Updated `.github/workflows/deploy.yml` with path filtering for non-runtime commits (`docs/**`, `artifacts/**`, `*.md`, `e2e/**`, `scripts/**`, `uptime-watch.yml`) and explicit schema-migration compatibility warnings on deploy/rollback.

- [x] **Finding 15 — Coverage ratchet & focused high-risk regression tests**
  - Added focused tests across interaction availability/collisions, stack/calculator edit-after-result, NPN partial failures, garden sync acknowledgments, admin MFA AAL1/AAL2, SW caching/offline, local-data clearing, rate limiting, streaming body caps, newsletter cooldown, and DB verification rules.
  - Configured `coverage.thresholds` in `vitest.config.ts` (`50%` statements, `41%` branches, `44%` functions, `51%` lines — 2 pts below observed actuals).

- [ ] **Runtime / External / Editorial Items Documented as Blocked (Not Touched)**
  - Finding 4 (Editorial): Owner clinical resolution of the 6 colliding `drug_interactions` URL pairs.
  - Finding 5 (Live): Apply `supabase/migrations/00097_admin_aal2_rls.sql` & verify live AAL1 vs AAL2 PostgREST REST access.
  - Round-2 Important #3/#4 & Round-3 Important #1 (Live): Apply `supabase/migrations/00098_newsletter_confirmation_sent_at.sql` and `supabase/migrations/00099_newsletter_send_lease.sql` to `herbally-db` before deploying updated newsletter code.
  - Finding 9 / Round-2 Minor #1 (Edge/Env): Confirm Cloudflare WAF/body-size limits, direct `/rest/v1` / `/auth/v1` protections, and runtime `RATE_LIMIT_HASH_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` presence for Upstash.
  - Finding 11 (Secrets): Set GitHub Actions `VERIFY_DB_SUPABASE_URL`, `VERIFY_DB_SUPABASE_ANON_KEY`, `REQUIRE_LIVE_VERIFY_DB=true` & align local `.env`.
  - Finding 12: Independent external uptime probe / dead-man monitor for `uptime-watch.yml` cron drift.
  - Finding 13: Diagnose Mac `launchd` exit code 1 & run restore drill on latest off-site encrypted snapshot using the hardened runbook drill.
  - Infra: WSL SSH (`WSAETIMEDOUT`) host Docker/log/disk inspection.

---

## 5. Round-2 Follow-Up Remediation (2026-11-24 Independent Follow-Up Review)

Reopened from `docs/audits/2026-11-24-agy-followup-review.md` (2 Critical, 12 Important, 2 Minor):

- [x] **Critical #1 — Older in-flight stack checks overwrite newer edits / out-of-order responses**
  - Added `requestGenRef` + `abortControllerRef` cancellation and invalidation in `src/components/interactions/stack-checker.tsx`.
  - TDD: Added deferred edit-while-pending and out-of-order tests in `src/components/interactions/__tests__/stack-checker.test.tsx`.

- [x] **Critical #2 — Public interaction-check flows bypass collision handling**
  - Added `matchInteractionPairDetailed()` in `src/lib/interactions/check.ts`, `StackConflictItem` in `src/lib/interactions/stack.ts`, and structured collision responses (`no-store`) in `GET /api/interactions/check` and `POST /api/interactions/check-stack`.
  - Updated `home-search-client.tsx`, `stack-checker.tsx`, and `npn-checker-client.tsx` to render all conflicting records safely.
  - TDD: Added real-matcher collision tests in `src/lib/interactions/__tests__/availability-and-collisions.test.ts` and `src/app/api/interactions/__tests__/check.route.test.ts`.

- [x] **Important #1 — Malformed garden HTTP-200 can delete synced local herbs**
  - Hardened `mergeServerGarden()` in `src/lib/garden/local-garden.ts` to require a plain object with valid `herbs` array elements before reconciling.
  - TDD: Added malformed payload tests in `src/lib/garden/__tests__/local-garden.test.ts`.

- [x] **Important #2 — Uncached offline herb navigation missing 503 Response**
  - Fixed `isHerbDetail` handler in `public/sw.js` to return cached immediately (with background refresh) or await network in `try/catch` and return `new Response("Offline", { status: 503 })`.
  - TDD: Added EN/FR uncached offline herb navigation tests in `src/__tests__/service-worker.test.ts`.

- [x] **Important #3 & #4 (Repo/Code Portion) — Newsletter lifecycle coherence & safe cooldown** _(Applying `00098_newsletter_confirmation_sent_at.sql` to live DB pending before deploy)_
  - Authored `supabase/migrations/00098_newsletter_confirmation_sent_at.sql` (`last_confirmation_sent_at`), updated `src/lib/types/database.ts`, aligned `subscribed: true` in `src/app/api/newsletter/confirm/route.ts`, and refactored `src/lib/newsletter/subscribe.ts` (separate send timestamp, checked DB updates, per-email in-flight deduplication, no cooldown consumption on suppressed/failed sends, uniform accepted outcome).
  - TDD: Added `src/app/api/newsletter/__tests__/lifecycle.test.ts` and extended `src/lib/newsletter/__tests__/subscribe.test.ts`.

- [x] **Important #5 — NPN false-complete payloads & stale/out-of-order client state**
  - Added `parseLnhpdArray()` in `src/lib/npn/lnhpd.ts`, updated `src/app/api/npn/lookup/route.ts`, and added request generations/abort/stale-clearing in `src/components/npn/npn-checker-client.tsx`.
  - TDD: Extended `lnhpd.test.ts`, `lookup.route.test.ts`, and `npn-checker-client.test.tsx`.

- [x] **Important #6 & Minor #1 (App Portion) — Memory limiter per-key window cleanup & remove public HMAC fallback** _(Runtime secret presence in production env remains uninspected)_
  - Stored per-key `windowMs` in `src/lib/rate-limit.ts`, removed `"herbally-rate-limit-hmac-fallback"` so `hashRateLimitKey` / Upstash requires a configured server secret, and updated `deploy/app.env.example`.
  - TDD: Extended `src/lib/rate-limit.test.ts` with fake-time mixed-window and missing-secret tests.

- [x] **Important #7 & #8 (Code/CI Portion) — Strict production URL parsing, catalog cardinality, & narrow known-collision inventory** _(Owner secrets & editorial disambiguation of the 6 pairs remain pending)_
  - Updated `src/lib/db/verify-rules.ts` (`classifySupabaseTarget`, `checkCatalogCardinality`, `KNOWN_UNRESOLVED_PAIR_COLLISIONS`, `classifyPairUrlCollisions`), `scripts/verify-herb-database.ts`, and `.github/workflows/ci.yml` (`--production-only`, removed legacy fallback).
  - TDD: Extended `src/lib/db/__tests__/verify-rules.test.ts`.

- [x] **Important #9 — Exclude noindex collision paths from sitemap & use selected row only**
  - Added `selectSitemapPairEntries()` in `src/lib/interactions/pair-url.ts`, wired into `src/app/sitemap.ts`, and reversed the contradictory test in `src/app/__tests__/sitemap.test.ts`.

- [x] **Important #10 — Deploy filter skips runtime script changes**
  - Removed `scripts/` from `.github/workflows/deploy.yml` exclusion regex and added `src/__tests__/deploy-workflow-filter.test.ts`.

- [x] **Important #11 — Late profile autofill bypasses dosage invalidation & overwrites edits**
  - Added dirty-field tracking & conditional invalidation in `src/components/calculator/dose-calculator-form.tsx` and deferred-profile tests in `src/components/calculator/__tests__/dose-calculator-form.test.tsx`.

- [x] **Important #12 — Harden self-hosted recovery drill & fix host paths**
  - Fixed `/srv/herbally/deploy/backup-local.sh` paths, anchored migration `cd /srv/herbally`, and hardened restore drill (`set -euo pipefail`, `umask 077`, `mktemp`, failure-preserving cleanup trap, restored-count assertions) in `docs/DEPLOYMENT_RUNBOOK.md` and `docs/database-backup-strategy.md`.

- [x] **Minor #2 — Complete browser storage inventory**
  - Added `herbally-lang-banner-dismissed`, `herbally:ad-document-guard`, and `herbally:ads-consent-reload` to `src/lib/privacy/storage-inventory.ts` and tested in `src/components/privacy/__tests__/clear-local-data-button.test.tsx`.

---

## 6. Round-3 Focused Remediation (2026-11-24 Round-2 Independent Re-Verification)

Focused follow-up from `docs/audits/2026-11-24-agy-round-2-reverification.md` (1 Critical, 3 Important, 1 E2E investigation):

- [x] **Critical — Homepage stale/racing clinical results (`src/app/[locale]/(marketing)/home-search-client.tsx`)**
  - Added `checkGenRef`, `checkAbortRef`, `invalidateCheck()`, unmount abort cleanup, and `e.preventDefault()` on `Enter` in `handleKeyDown`.
  - Cleared `checkResult`, `checkError`, and `checking` + aborted in-flight requests on herb edit, medication edit, `selectHerb()`, and every `handleCheck()` invocation while preserving single-field `/herbalist?q=...` router navigation.
  - Gated `res.json()`, `setCheckResult`, `setCheckError`, and `finally` (`setChecking(false)`) on `gen === checkGenRef.current`.
  - TDD: Created `src/app/[locale]/(marketing)/__tests__/home-search-client.test.tsx` covering edit-after-complete (normal, collision, autocomplete), edit-while-pending (normal, collision, network reject), out-of-order reversal, and single-field navigation.

- [x] **Important #1 (Code & Migration Portion) — Newsletter post-send stamp failure atomic expiring lease (`src/lib/newsletter/subscribe.ts`, `supabase/migrations/00099_newsletter_send_lease.sql`)** _(Applying `00098` & `00099` live pending before deploy)_
  - Authored additive `supabase/migrations/00099_newsletter_send_lease.sql` (`confirmation_send_lease_until TIMESTAMPTZ`), updated `src/lib/types/database.ts`, and cleared `confirmation_send_lease_until: null` in `confirm/route.ts` and `unsubscribe/route.ts`.
  - Replaced `inFlightSends` with bounded expiring `activeLeases` (`SEND_LEASE_MS = 2 * 60_000`) plus pre-send conditional DB lease claim on `confirmation_send_lease_until`; released DB + local leases on SMTP failure/throw, retained both until expiry on post-send stamp error/throw, and preserved uniform `{ ok: true, status: "accepted" }`.
  - TDD: Extended `src/lib/newsletter/__tests__/subscribe.test.ts` (post-send stamp error/throw immediate retry + post-restart DB lease proof, send-failure release, crash lease expiry, cross-instance CAS loss) and updated `src/app/api/newsletter/__tests__/lifecycle.test.ts`.

- [x] **Important #2 (Code Portion) — Exact reviewed signatures for all 5 non-sage known collisions (`src/lib/db/verify-rules.ts`)** _(Owner clinical disambiguation of all 6 pairs remains pending)_
  - Made `expectedSignatures` required on `KnownPairCollisionSpec` and populated exact audited `drugName|severity` signatures for `rhodiola/antidepressants`, `astragalus/immunosuppressants`, `cats-claw/immunosuppressants`, `cordyceps/immunosuppressants`, and `evening-primrose/phenothiazines`.
  - TDD: Extended `src/lib/db/__tests__/verify-rules.test.ts` with non-sage exact-signature acceptance and name/severity mutation tests.

- [x] **Important #3 — Failure-preserving drill & recovery-safe emergency restore (`docs/database-backup-strategy.md`)**
  - Updated Section 3 restore drill `cleanup()` trap to preserve restrictive `$TMP_DUMP` and `herbally_restore_test` on failure, print exact paths and manual cleanup commands, and clean up only when `rc -eq 0`.
  - Updated Section 4 emergency restore with `SERVICES_STOPPED` tracking, `restart_and_verify()` (`docker compose up -d auth rest app` + container healthchecks + `http://127.0.0.1:3000/api/health`), an `EXIT` trap that attempts recovery while retaining `$TMP_DUMP` and original `$rc`, and explicit `MANUAL INTERVENTION REQUIRED` steps.

- [x] **Additional Investigation — Mocked-chat E2E failures & pre-hydration submission loss (`src/components/pharmacist/chat-interface.tsx`, `e2e/chat.spec.ts`, `playwright.config.ts`)**
  - Diagnosed root cause on isolated port 3100: `/herbalist` SSR-renders `<textarea>` inside dynamic providers before hydration completes; pre-hydration typing populated DOM `textarea.value` while React `input` state remained `""`, leaving `Send` disabled and causing `Enter` (`e.preventDefault(); sendMessage()`) to drop the user's message.
  - Added `data-chat-ready` (`useSyncExternalStore` hydration flag), mount-time recovery of pre-hydration `inputRef.current.value`, fallback read in `sendMessage()`, and DOM value clearing.
  - Added explicit `[data-chat-ready="true"]` + `toBeEnabled()` synchronization and a chunk-delayed pre-hydration E2E regression test in `e2e/chat.spec.ts` plus optional `PLAYWRIGHT_BASE_URL` support in `playwright.config.ts`.
  - TDD & E2E: Added `renderToString` + `hydrateRoot` regression test in `src/components/pharmacist/__tests__/chat-interface.test.tsx`; verified 18/18 Chromium tests (6 tests × 3 repeats) on isolated port 3100.

---

## 7. Round-4 Final Newsletter-Only Remediation (2026-11-24 Round-3 Independent Re-Verification)

Focused follow-up from `docs/audits/2026-11-24-agy-round-3-reverification.md` (2 Important newsletter findings; all other areas accepted and untouched):

- [x] **Important #1 — Local lease vs. lifecycle transitions (`src/lib/newsletter/subscribe.ts`, `src/app/api/newsletter/confirm/route.ts`, `src/app/api/newsletter/unsubscribe/route.ts`)**
  - Moved `subscribe()` row lookup ahead of local lease acquisition so `unsubscribed` rows always execute the atomic `unsubscribed -> pending` transition with a rotated `confirm_token` and `installLocalLease()`, never short-circuited by a stale pending local lease.
  - Added identity metadata (`rowId`, `confirmToken`, `leaseUntilIso`) to `LocalSendLease` and exported `invalidateNewsletterSendLease()` guarded by `leaseId` / `rowId` / `confirmToken` so delayed/old requests cannot delete newer leases.
  - Wired `confirm/route.ts` and `unsubscribe/route.ts` to select `id, email, confirm_token` from their existing update queries and invalidate the matching local lease without logging email addresses or changing external responses.
  - TDD: Added 3 regression tests in `src/app/api/newsletter/__tests__/lifecycle.test.ts` (3/4 failed red before fix; 4/4 passed green after fix).

- [x] **Important #2 — Bounded SMTP phases/deadline & fenced post-send stamping / owner-only release (`src/lib/email/mailer.ts`, `src/lib/newsletter/subscribe.ts`)**
  - Preserved `00098_newsletter_confirmation_sent_at.sql` and `00099_newsletter_send_lease.sql` untouched; no new migration (`00100`) needed.
  - Configured explicit Nodemailer timeouts in `src/lib/email/mailer.ts` (`SMTP_DNS_TIMEOUT_MS=10000`, `SMTP_CONNECTION_TIMEOUT_MS=15000`, `SMTP_GREETING_TIMEOUT_MS=15000`, `SMTP_SOCKET_TIMEOUT_MS=20000`, `SMTP_SOCKET_CLOSE_TIMEOUT_MS=2000`, `SMTP_SEND_DEADLINE_MS=45000`, all strictly `< SEND_LEASE_MS`) and wired `AbortController` `signal` directly into `tx.sendMail(...)` (no `Promise.race`) so timeouts tear down the underlying socket.
  - Bounded `subscribe()`'s `sendMail` call via `SEND_DEADLINE_MS` (`AbortController`) and fenced both `releaseDbLease()` and post-send `last_confirmation_sent_at` stamping by `(id/email, status = "pending", confirm_token = token, confirmation_send_lease_until = leaseUntilIso)` alongside local lease-ID ownership checks.
  - TDD: Created `src/lib/email/__tests__/mailer.test.ts` (real loopback `127.0.0.1` blackhole socket teardown tests) and extended `src/lib/newsletter/__tests__/subscribe.test.ts` (hung-send deadline abort, expired-A-then-B post-send stamp fencing, owner-only failure release): 5/5 new tests failed red before fix; 30/30 mailer + newsletter tests passed green after fix.
