# HerbAlly Independent Review Remediation Report (2026-11-24)

> [!WARNING]
> **Round-2 Follow-Up Correction (`2026-11-24`):** An independent follow-up review (`docs/audits/2026-11-24-agy-followup-review.md`) rejected the initial Round-1 working tree due to 2 Critical, 12 Important, and 2 Minor gaps in the initial fixes (including missing request-generation guards in `StackChecker` and `NpnCheckerClient`, collision bypass in `matchInteractionPair` / interaction APIs, `sitemap.ts` still emitting `noindex` collisions, `mergeServerGarden` trusting `{}` / non-array payloads, `sw.js` uncached offline herb nav returning `undefined`, newsletter resubscribe/cooldown/SMTP-failure flaws, memory limiter mixed-window cleanup and public HMAC fallback, loose `verify-db` URL matching and zero-cardinality acceptance, `deploy.yml` skipping `scripts/patch-next-image-optimizer.mjs`, late calculator autofill overwriting edits, recovery drill path/safety bugs, and incomplete storage inventory).
>
> All Round-2 fixes, red → green TDD evidence, corrected statuses, and remaining live-DB/runtime/editorial blockers are documented in [`docs/audits/2026-11-24-agy-remediation-round-2.md`](./2026-11-24-agy-remediation-round-2.md). Prior Round-1 "Fixed" claims for Findings 2, 3, 4, 6, 7, 8, 9, 10, 11, 14, and Minor items below were superseded and corrected in Round 2.

**Executor:** Antigravity CLI (AGY)  
**Baseline HEAD:** `1aa6bb48ded5b5ce46ae96c4a4434c2b42df4ed8`  
**Review Spec:** `/Users/yasser/Library/Mobile Documents/iCloud~md~obsidian/Documents/Team Memory/audits/2026-11-24-herbally-independent-current-state-review.md`  
**Related Same-Day Audit:** `docs/audits/2026-11-24-full-site-evaluation.md`  
**Implementation Plan:** `docs/superpowers/plans/2026-11-24-review-remediation.md`

> **Hard Guardrails Honored:** Zero `git commit`/branch/reset mutations, zero deployments or live DB/SQL mutations, zero `.env.local` or external account edits, zero changes to `ADS_LAUNCH_GATE`/ads/consent/analytics/index-all/editorial policy, and zero invented clinical facts or code-selected clinical severities. Pre-existing dirty files (`artifacts/adsense-watch.json`, `artifacts/expand-import-report.json`, `artifacts/ads-consent-salvage-20261116/`, `artifacts/fr-monograph-pilot-20261117/`, `ours-1.*`, `ours-2.*`) were preserved untouched.

---

## 1. Status of Every Review Finding

### Important Validated Findings (1–15)

| #   | Finding                                                               | Status              | Technical Evidence & Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Interaction availability failures become false negatives              | **Fixed**           | Added `InteractionDataUnavailableError` & `isStubSupabase()` in `src/lib/interactions/errors.ts`. `resolveHerb` (`src/lib/interactions/resolve-herb.ts`) and `getHerbPairs`/`getInteractionPair` (`src/lib/interactions/pairs.ts`) now throw `InteractionDataUnavailableError` on missing client or query/timeout errors instead of returning `null`/`[]`. `GET /api/interactions/check` and `POST /api/interactions/check-stack` return HTTP `503 { unavailable: true }`. `[herb]/[drug]/page.tsx` and `[herb]/page.tsx` propagate DB unavailability as a retryable 500 outside `placeholder.supabase.co` CI stub mode.                                                                                                                                                                                                          |
| 2   | Clinical results become stale after edits                             | **Fixed**           | `StackChecker` (`src/components/interactions/stack-checker.tsx`) now calls `invalidateResult()` on every herb/drug chip removal, add, draft edit, sample load, and clear, and its Foldable Wallet Card reads exclusively from `result.herbs` / `result.drugs`. `DoseCalculatorForm` (`src/components/calculator/dose-calculator-form.tsx`) stores an immutable `CalculationSnapshot`, clears `snapshot`/`safetyBlock`/`error` on every field/unit/toggle/range/formula edit, passes converted `weightKg` to `SaveCalcButton`, and `SaveCalcButton` (`src/components/calculator/profile-integration.tsx`) surfaces save errors instead of silently ignoring failures.                                                                                                                                                              |
| 3   | NPN partial upstream failures presented/cached as complete            | **Fixed**           | `GET /api/npn/lookup` (`src/app/api/npn/lookup/route.ts`) returns `sectionStatus`, `unavailableSections`, `herbMatchingUnavailable`, and `partial`; returns HTTP `502` when all 4 detail endpoints fail; and sets `Cache-Control: no-store` whenever `partial` is true. `NpnCheckerClient` (`src/components/npn/npn-checker-client.tsx`) renders a prominent partial-record banner and explicit `role="alert"` notices for unavailable sections (including Risks/Cautions and Ingredients).                                                                                                                                                                                                                                                                                                                                       |
| 4   | Interaction URL deduplication hides record conflicts                  | **Partially fixed** | **Technical detection & fail-safe fixed:** `pair-url.ts` adds `EDITORIAL_PAIR_CANONICAL_DRUG` (empty until clinical sign-off) and `findPairUrlCollisions()`; `pairs.ts` orders deterministically (`.order("drug_name").order("id")`) and throws `InteractionUrlCollisionError` on unresolved collisions; `[herb]/[drug]/page.tsx` renders an honest `noindex, nofollow` fail-safe page displaying **all** colliding rows without picking a severity or merging clinical text; `sitemap.ts` logs collisions; `verify-herb-database.ts` fails on unresolved collisions. **Blocked (Editorial):** Owner clinical disambiguation of the 6 colliding `drug_interactions` pairs (including `sage/anticonvulsants` moderate vs severe) requires editorial review and DB/canonical sign-off.                                              |
| 5   | Admin MFA boundary & AAL2 RLS                                         | **Partially fixed** | **Code & migration authored:** `src/lib/actions/admin-mfa.ts` now blocks `startAdminTotpEnrollment()` and unverified-factor `verifyAdminTotpCode()` when a verified TOTP factor exists and `aal.currentLevel !== "aal2"`. `supabase/migrations/00097_admin_aal2_rls.sql` defines `public.is_admin_aal2()` (`auth.jwt() ->> 'aal' = 'aal2'` + `profiles.role = 'admin'`) and upgrades admin policies across `profiles`, `herb_categories`, `herbs`, `drug_interactions`, `interaction_checks`, `chat_sessions`, `chat_messages`, `herb_faqs`, `donations`, and `herb_monographs` while keeping own-profile reads intact for the AAL1 MFA gate. **Blocked (Live DB/Verification):** Applying `00097` to live Postgres and executing live AAL1 vs AAL2 direct PostgREST REST verification require owner production access.           |
| 6   | Service worker caches too broadly & returns HTTP 200 offline `[]`     | **Fixed**           | `public/sw.js` bumps cache names (`herbally-public-v7`, `herbally-public-api-v3`), removes `/garden` and `/herbalist` from `STATIC_URLS`, excludes `/auth/`, `/admin`, `/profile`, `/garden`, `/login`, `/register`, `Authorization` requests, and non-allowlisted `/api/*`, caches only public GETs lacking `private`/`no-store`/`no-cache`/`Set-Cookie`, returns HTTP `503` JSON (`{ error, offline: true, unavailable: true }`) on offline API misses, and handles `CLEAR_CACHES` messages.                                                                                                                                                                                                                                                                                                                                    |
| 7   | Garden sync converts transient write failures into local data loss    | **Fixed**           | `POST /api/garden` (`src/app/api/garden/route.ts`) returns `savedSlugs`, HTTP `500` when all writes fail, and HTTP `207` on partial failure; `DELETE /api/garden` returns `{ removed: true, slug }`. `src/lib/garden/local-garden.ts` calls `markSynced` only on explicit per-slug acknowledgment and only clears synced tracking on `DELETE` when `res.ok && data?.removed === true`.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8   | Incomplete privacy clearing & AI cache retention                      | **Fixed**           | Created `src/lib/privacy/storage-inventory.ts` covering all `localStorage`/`sessionStorage` keys (including `herbally-garden-notes`, `herbally-garden-removed`, `herbally-garden-synced`) plus `clearBrowserCaches()`. `ClearLocalDataButton` (`src/components/privacy/clear-local-data-button.tsx`) clears all layers asynchronously and reports `role="alert"` if any layer fails instead of falsely claiming removal. `AccountMenu` (`src/components/auth/account-menu.tsx`) clears browser caches on logout. Updated EN/FR `privacy.dataRetention.text` and `privacy.yourRights.deletion` in `src/lib/i18n/dictionaries/{en,fr}/server.json` to honestly disclose 7-day unlinked `ai_response_cache` retention alongside immediate session/message deletion.                                                                  |
| 9   | Abuse controls (rate limit, streaming body cap, edge)                 | **Partially fixed** | **App layer fixed:** `src/lib/rate-limit.ts` replaces non-atomic `/pipeline` with an atomic Redis Lua `EVAL`, adds `AbortSignal.timeout(2500)`, HMAC-SHA256-hashes Redis keys (`RATE_LIMIT_HASH_SECRET` fallback), and bounds in-memory `requestLog` at 10,000 keys. Created `src/lib/http/read-json-body.ts` streaming byte-cap reader and applied it to all 10 JSON POST routes (`chat` 50KB—removing the 10× post-parse bug—`garden` 100KB, `check-stack` 16KB, `newsletter` 4KB, `analytics/vitals` 10KB, `interpret-search` 10KB, `herbs/view` 2KB, `donate` 4KB, `revalidate-herb` 32KB, `revalidate-pubmed-sheet` 4KB). **Blocked (Edge/Infra):** Confirming Cloudflare WAF/body-size limits and direct `/rest/v1` + `/auth/v1` rate-limiting requires owner Cloudflare/Caddy inspection.                                  |
| 10  | Newsletter leaks subscription state & lacks resend cooldown           | **Fixed**           | `src/lib/newsletter/subscribe.ts`, `src/app/api/newsletter/route.ts`, and `src/components/marketing/newsletter-signup.tsx` now return one uniform `{ ok: true, status: "accepted" }` external response across new, pending, confirmed, unsubscribed, and honeypot submissions, and enforce a 15-minute per-address resend cooldown (`RESEND_COOLDOWN_MS` via `consented_at` + `rateLimit`).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | `verify-db` CI gate not truthful & safety-conflict rule unimplemented | **Partially fixed** | **Script & workflow fixed:** Extracted `classifySupabaseTarget()` and `checkSafetyConflicts()` into `src/lib/db/verify-rules.ts`; `scripts/verify-herb-database.ts` now implements `--migrations-only`, `--production-only`, safety-conflict checks, and interaction URL collision checks, and exits `1` under `--ci` when credentials are missing or placeholder. `.github/workflows/ci.yml` splits `verify-migrations` from `verify-db` and guards live `verify-db` with `VERIFY_DB_SUPABASE_URL` / `VERIFY_DB_SUPABASE_ANON_KEY` and `REQUIRE_LIVE_VERIFY_DB`. **Blocked (Owner Secrets/Env):** Owner must configure read-only production `VERIFY_DB_SUPABASE_URL` / `VERIFY_DB_SUPABASE_ANON_KEY` GitHub Secrets + `REQUIRE_LIVE_VERIFY_DB=true` variable and separate local `.env` from the legacy `*.supabase.co` snapshot. |
| 12  | Monitoring cadence (`.github/workflows/uptime-watch.yml` cron drift)  | **Blocked**         | GitHub Actions scheduled workflow frequency (`1–4` runs/day observed vs 30m cron) cannot be fixed inside repo code alone; requires an external uptime probe / dead-man alert configured by the owner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 13  | Backup automation (`launchd` exit 1 + restore proof)                  | **Blocked**         | Diagnosing the Mac `launchd` off-site pull exit code `1` and running a restore proof on the latest off-site encrypted snapshot are external host/runtime actions outside the repo. `docs/database-backup-strategy.md` was updated with the accurate non-destructive restore drill procedure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14  | Stale deploy/recovery/backup docs & `deploy.yml` safeguards           | **Fixed**           | Updated `deploy/README.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/database-backup-strategy.md`, `README.md`, and `deploy/app.env.example` to document the current self-hosted Docker Compose + Caddy + Cloudflare Tunnel + `backup-local.sh` architecture. Updated `.github/workflows/deploy.yml` with non-runtime path filtering via `/srv/herbally/.last-deployed-sha` and explicit SQL migration warnings on deploy and image rollback.                                                                                                                                                                                                                                                                                                                                                                                          |
| 15  | Test assurance & coverage ratchet                                     | **Fixed**           | Added 14 new focused test files and extended 6 existing suites covering every remediated safety/security/data-integrity failure mode. Coverage rose from `48.24% / 39.48% / 43.70% / 49.05%` to `52.78% / 43.25% / 46.99% / 53.84%`, and `vitest.config.ts` now enforces a regression ratchet (`50% / 41% / 44% / 51%`). CI live-AI chat smoke test remains intentionally gated on `OLLAMA_CLOUD_API_KEY`.                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Minor Validated Findings & Formatting

| Item                                                                     | Status                         | Technical Evidence & Reason                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI Prettier failure (`docs/agent-tasks/2026-11-24-source-thin-herbs.md`) | **Fixed**                      | Formatted with Prettier; `npm run format:check` passes cleanly across the repository.                                                                                                                                          |
| `returnTo` query construction (`src/lib/actions/auth.ts`)                | **Fixed**                      | Added `appendWelcomeParam()` using `URL` so `/profile` becomes `/profile?welcome=login` (and preserves existing queries/hashes).                                                                                               |
| Rate-limiter literal IP keys vs privacy copy (`src/lib/rate-limit.ts`)   | **Fixed**                      | `upstashRateLimit` now keys Redis with `ratelimit:v1:${hashRateLimitKey(key)}` (HMAC-SHA256), matching the privacy policy disclosure.                                                                                          |
| Stripe webhook donor PII logs (`src/app/api/webhooks/stripe/route.ts`)   | **Fixed**                      | `stripe_donation_completed` now logs `{ eventId, sessionId, status }` instead of donor `email` and `amount`.                                                                                                                   |
| Password minimum 8 vs GoTrue 12 (`auth-forms.tsx`, `core.json`)          | **Fixed**                      | Updated `RegisterForm` and `ResetPasswordForm` `minLength={12}` plus EN/FR `core.json` placeholder/error copy (`8` → `12`).                                                                                                    |
| README stale counts & pediatric wording (`README.md`)                    | **Fixed**                      | Updated to `3,100+ published medicinal herbs` and `Adult-only (18+) dosage calculator`.                                                                                                                                        |
| 4 ESLint unused-variable warnings                                        | **Fixed**                      | Removed unused locals in `src/app/sitemap.ts` and `src/app/[locale]/(main)/herbs/[slug]/page.tsx`, and prefixed `_isReviewed` in `src/components/herbs/author-byline.tsx`. `npm run lint` passes with 0 errors and 0 warnings. |
| Sentry v11 / Vite native-config / direct dependency updates              | **Not churned (by guardrail)** | Zero known vulnerabilities reported by `npm audit`; major/direct dependency upgrades were skipped per guardrail ("no speculative redesign or new dependency unless strictly necessary").                                       |
| WSL SSH `WSAETIMEDOUT` host Docker/disk inspection                       | **Blocked**                    | Runtime Windows/WSL host connectivity issue outside the repo.                                                                                                                                                                  |

---

## 2. TDD Ledger (Failed Before Fix → Passed After Fix)

| Test Suite                                                                   | Observed Failure Before Fix                                                                                                                                          | Result After Fix                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/interactions/__tests__/availability-and-collisions.test.ts`         | Failed to resolve `../errors` (`InteractionDataUnavailableError`, `InteractionUrlCollisionError` absent; functions returned `null`/`[]` and picked first collision). | Passed (7/7 tests; 13/13 interaction+sitemap suites, 95/95 tests). |
| `src/app/api/interactions/__tests__/check.route.test.ts`                     | Failed on missing `../errors` module.                                                                                                                                | Passed (4/4 tests).                                                |
| `src/app/[locale]/(main)/interactions/[herb]/[drug]/__tests__/page.test.tsx` | Failed on missing `@/lib/interactions/errors` module.                                                                                                                | Passed (3/3 tests).                                                |
| `src/components/interactions/__tests__/stack-checker.test.tsx`               | Failed 2/4 tests: `"Reduces warfarin efficacy."` remained in DOM after removing herb or typing draft.                                                                | Passed (4/4 tests).                                                |
| `src/components/calculator/__tests__/dose-calculator-form.test.tsx`          | Failed 1/12 tests: `renderedDose` stayed `"441.2mg"` after editing adult dose to `"1000"`.                                                                           | Passed (12/12 tests).                                              |
| `src/app/api/npn/__tests__/lookup.route.test.ts`                             | Failed 4/4 tests: `body.partial` was `undefined`, `Cache-Control` stayed `public, s-maxage=3600...`, all-section fail returned `200`.                                | Passed (4/4 tests).                                                |
| `src/components/npn/__tests__/npn-checker-client.test.tsx`                   | Failed 1/1 test: no `role="alert"` rendered for partial failure / unavailable risks.                                                                                 | Passed (1/1 test).                                                 |
| `src/app/api/garden/__tests__/route.test.ts`                                 | Failed 3/3 tests: `POST` returned `200` on all-fail and partial-fail; `DELETE` omitted `slug`.                                                                       | Passed (3/3 tests).                                                |
| `src/lib/garden/__tests__/local-garden.test.ts`                              | Failed 3/13 tests: `{ saved: 0, errors: ["ginger"] }` and `{}` marked synced and caused local deletion on merge; failed `DELETE` did not preserve state.             | Passed (13/13 tests).                                              |
| `src/lib/actions/__tests__/admin-mfa.test.ts`                                | Failed 2/5 tests: `mfa.enroll` and `mfa.challengeAndVerify` on unverified factor were called at AAL1 despite existing verified factor.                               | Passed (5/5 tests).                                                |
| `src/__tests__/admin-aal2-rls.test.ts`                                       | Failed 2/2 tests (`ENOENT` for `00097_admin_aal2_rls.sql`).                                                                                                          | Passed (2/2 tests).                                                |
| `src/__tests__/service-worker.test.ts`                                       | Failed 4/4 tests: intercepted private `/api/garden`, returned HTTP `200 []` offline, cached `private, no-store`, lacked `CLEAR_CACHES`.                              | Passed (4/4 tests).                                                |
| `src/components/privacy/__tests__/clear-local-data-button.test.tsx`          | Failed 2/2 tests: omitted `herbally-garden-notes`/`removed`/`synced` and Cache Storage, and showed `role="status"` success when `caches.delete` failed.              | Passed (2/2 tests).                                                |
| `src/lib/rate-limit.test.ts`                                                 | Failed 1/5 tests: Upstash used `/pipeline` and returned `{ success: true, remaining: 9 }` without `EVAL` or HMAC hashing.                                            | Passed (5/5 tests).                                                |
| `src/lib/http/__tests__/read-json-body.test.ts`                              | Failed to resolve `../read-json-body`.                                                                                                                               | Passed (4/4 tests).                                                |
| `src/app/api/__tests__/chat-body-limit.test.ts`                              | Failed 1/1 test: returned `400` instead of `413` on 60 KB chunked body (10× post-parse cap).                                                                         | Passed (1/1 test).                                                 |
| `src/lib/newsletter/__tests__/subscribe.test.ts`                             | Failed 3/10 tests: returned `"pending"`/`"already-pending"` instead of uniform `"accepted"`.                                                                         | Passed (10/10 tests).                                              |
| `src/app/api/newsletter/__tests__/route.test.ts`                             | Failed 1/2 tests: returned `400` instead of `413` on >4 KB body.                                                                                                     | Passed (2/2 tests).                                                |
| `src/lib/actions/auth.test.ts`                                               | Failed 1/14 (`"/profile&welcome=login"` instead of `"/profile?welcome=login"`).                                                                                      | Passed (14/14 tests).                                              |
| `src/components/auth/__tests__/auth-forms.test.tsx`                          | Failed 2/2 tests: `minLength="8"` instead of `"12"`.                                                                                                                 | Passed (2/2 tests).                                                |
| `src/app/api/webhooks/stripe/route.test.ts`                                  | Failed 1/11 tests: logged `{ email: "a@b.com", amount: 2500, status: "completed" }`.                                                                                 | Passed (11/11 tests).                                              |
| `src/lib/db/__tests__/verify-rules.test.ts`                                  | Failed to resolve `../verify-rules`.                                                                                                                                 | Passed (6/6 tests).                                                |

---

## 3. Final Verification Command Results

| Command                                                                                                                                                               | Result   | Details                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                                                                                                                | **PASS** | All matched files use Prettier code style (run after final edits).                                                                                                                                                                              |
| `npm run typecheck`                                                                                                                                                   | **PASS** | `tsc --noEmit` exited `0`.                                                                                                                                                                                                                      |
| `npm run lint`                                                                                                                                                        | **PASS** | `eslint` exited `0` with `0` errors and `0` warnings.                                                                                                                                                                                           |
| `npm run test:coverage`                                                                                                                                               | **PASS** | `162` test files passed, `1,313` tests passed. Coverage: `52.78%` statements (5413/10255), `43.25%` branches (3910/9040), `46.99%` functions (986/2098), `53.84%` lines (5032/9345); meets configured ratchet thresholds (`50 / 41 / 44 / 51`). |
| `npm run build`                                                                                                                                                       | **PASS** | Next.js 16.4.6 production build succeeded; `186/186` static pages generated.                                                                                                                                                                    |
| `npx tsx scripts/verify-herb-database.ts --migrations-only`                                                                                                           | **PASS** | Checked `97` SQL migration files cleanly.                                                                                                                                                                                                       |
| Safe Playwright Chromium (`e2e/smoke.spec.ts`, `e2e/calculator.spec.ts` against local standalone server with `placeholder.supabase.co` and `OLLAMA_CLOUD_API_KEY=""`) | **PASS** | `9 passed`, `1 skipped` (`Smoke test: API Chat` intentionally skipped without `OLLAMA_CLOUD_API_KEY`) in `40.4s`.                                                                                                                               |

---

## 4. Changed & Added Files

### Modified Files (56 remediation edits; 2 pre-existing dirty artifact files untouched)

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `README.md`
- `deploy/README.md`
- `deploy/app.env.example`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/agent-tasks/2026-11-24-source-thin-herbs.md`
- `docs/database-backup-strategy.md`
- `public/sw.js`
- `scripts/verify-herb-database.ts`
- `src/app/[locale]/(main)/herbs/[slug]/page.tsx`
- `src/app/[locale]/(main)/interactions/[herb]/[drug]/page.tsx`
- `src/app/[locale]/(main)/interactions/[herb]/page.tsx`
- `src/app/api/analytics/vitals/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/donate/route.ts`
- `src/app/api/garden/route.ts`
- `src/app/api/herbs/view/route.ts`
- `src/app/api/interactions/check-stack/route.ts`
- `src/app/api/interpret-search/route.ts`
- `src/app/api/newsletter/route.ts`
- `src/app/api/npn/lookup/route.ts`
- `src/app/api/revalidate-herb/route.ts`
- `src/app/api/revalidate-pubmed-sheet/route.ts`
- `src/app/api/webhooks/stripe/route.test.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/sitemap.ts`
- `src/components/auth/account-menu.tsx`
- `src/components/auth/auth-forms.tsx`
- `src/components/calculator/__tests__/dose-calculator-form.test.tsx`
- `src/components/calculator/dose-calculator-form.tsx`
- `src/components/calculator/profile-integration.tsx`
- `src/components/herbs/author-byline.tsx`
- `src/components/interactions/__tests__/stack-checker.test.tsx`
- `src/components/interactions/stack-checker.tsx`
- `src/components/marketing/newsletter-signup.tsx`
- `src/components/npn/npn-checker-client.tsx`
- `src/components/privacy/__tests__/clear-local-data-button.test.tsx`
- `src/components/privacy/clear-local-data-button.tsx`
- `src/lib/actions/admin-mfa.ts`
- `src/lib/actions/auth.test.ts`
- `src/lib/actions/auth.ts`
- `src/lib/garden/__tests__/local-garden.test.ts`
- `src/lib/garden/local-garden.ts`
- `src/lib/i18n/dictionaries/en/core.json`
- `src/lib/i18n/dictionaries/en/server.json`
- `src/lib/i18n/dictionaries/fr/core.json`
- `src/lib/i18n/dictionaries/fr/server.json`
- `src/lib/interactions/pair-url.ts`
- `src/lib/interactions/pairs.ts`
- `src/lib/interactions/resolve-herb.ts`
- `src/lib/newsletter/__tests__/subscribe.test.ts`
- `src/lib/newsletter/subscribe.ts`
- `src/lib/rate-limit.test.ts`
- `src/lib/rate-limit.ts`
- `vitest.config.ts`

### Added Files

- `docs/superpowers/plans/2026-11-24-review-remediation.md`
- `docs/audits/2026-11-24-agy-remediation.md`
- `src/lib/interactions/errors.ts`
- `src/lib/privacy/storage-inventory.ts`
- `src/lib/http/read-json-body.ts`
- `src/lib/db/verify-rules.ts`
- `supabase/migrations/00097_admin_aal2_rls.sql`
- `src/lib/interactions/__tests__/availability-and-collisions.test.ts`
- `src/app/api/interactions/__tests__/check.route.test.ts`
- `src/app/[locale]/(main)/interactions/[herb]/[drug]/__tests__/page.test.tsx`
- `src/app/api/npn/__tests__/lookup.route.test.ts`
- `src/components/npn/__tests__/npn-checker-client.test.tsx`
- `src/app/api/garden/__tests__/route.test.ts`
- `src/lib/actions/__tests__/admin-mfa.test.ts`
- `src/__tests__/admin-aal2-rls.test.ts`
- `src/__tests__/service-worker.test.ts`
- `src/lib/http/__tests__/read-json-body.test.ts`
- `src/app/api/__tests__/chat-body-limit.test.ts`
- `src/app/api/newsletter/__tests__/route.test.ts`
- `src/components/auth/__tests__/auth-forms.test.tsx`
- `src/lib/db/__tests__/verify-rules.test.ts`

---

## 5. Remaining Owner & Runtime Actions

1. **Clinical/Editorial Collision Resolution (Finding 4):** Review the colliding `drug_interactions` rows (especially `sage/anticonvulsants` moderate vs severe, plus any other colliding pairs flagged by `verify-herb-database.ts`) and either consolidate/rename the drug qualifiers in PostgreSQL or record explicit canonical overrides in `EDITORIAL_PAIR_CANONICAL_DRUG` (`src/lib/interactions/pair-url.ts`).
2. **Apply Admin AAL2 Migration & Test Live REST (Finding 5):** Take a fresh `backup-local.sh` snapshot, apply `supabase/migrations/00097_admin_aal2_rls.sql` to `herbally-db`, and verify via direct PostgREST REST calls (`AAL1` admin JWT vs `AAL2` admin JWT) that admin-only reads/writes on `herbs`, `chat_sessions`, `chat_messages`, `interaction_checks`, `donations`, and `herb_monographs` are denied at `AAL1` and permitted at `AAL2`.
3. **Configure Production `verify-db` Secrets & Separate Local `.env` (Finding 11):** Add read-only production `VERIFY_DB_SUPABASE_URL` (`https://api.herbally.app`) and `VERIFY_DB_SUPABASE_ANON_KEY` in GitHub Repository Secrets, set repository variable `REQUIRE_LIVE_VERIFY_DB=true`, and separate local `.env` from the legacy `*.supabase.co` project.
4. **Independent Uptime Probe (Finding 12):** Configure an external uptime/dead-man monitor against `https://herbally.app/api/health` rather than relying solely on GitHub Actions cron cadence.
5. **Repair & Prove Mac Off-Site Backup Scheduler (Finding 13):** Inspect the Mac `launchd` job stderr/logs to resolve its exit code `1`, add explicit failure alerting, and run a non-destructive restore drill against the latest encrypted `.dump.gpg` snapshot.
6. **Edge & WSL Host Verification (Finding 9 / Infra):** Confirm Cloudflare request-body-size limits and `/rest/v1` + `/auth/v1` edge rate limiting, and inspect WSL2 Docker/disk/log health directly on the Windows host (`WSAETIMEDOUT` over SSH blocked remote check).
