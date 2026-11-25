# AGY remediation follow-up review — 2026-11-24

**Verdict:** Do not accept the first remediation working tree yet. Two Critical and twelve Important issues remain. Each item below must be verified against current code, fixed with a failing-first regression test where it changes behavior, and accurately marked blocked only if an owner/runtime decision is indispensable.

## Critical

1. **Older in-flight stack checks can overwrite newer edits** — `src/components/interactions/stack-checker.tsx:132-136,182-232`.
   - Start a check, then type/remove/clear/load a sample before fetch resolves. `invalidateResult()` clears current state, but the old request later executes `setResult(data)` and resurrects stale clinical results. Older requests can also beat newer requests.
   - Add a monotonically increasing request-generation ref. Increment on every invalidation and new check; clear result at check start; apply result/error/loading only when generation matches. AbortController may supplement but not replace generation checks. Add deferred-fetch edit-while-pending and out-of-order tests.

2. **Both public interaction-check flows bypass collision handling** — `src/lib/interactions/check.ts:281-293`, `src/app/api/interactions/check/route.ts:79-108`, `src/app/api/interactions/check-stack/route.ts:180-197`.
   - Exact-slug matching returns the first row, so `sage/anticonvulsants` can return only the moderate record while the page reports ambiguity and omits the severe conflict.
   - Collect all exact-slug matches and return an explicit structured ambiguity/conflict outcome containing all conflicting records. Never choose by order or severity. Exercise the real matcher through both API routes using the colliding fixture.

## Important

1. **Malformed garden HTTP-200 can delete all synced local herbs** — `src/lib/garden/local-garden.ts:372-397`.
   - `{}`, missing `herbs`, old proxies, or contract regressions become `data.herbs ?? []`, making an empty server response authoritative.
   - Require an object with `herbs` as an array before reconciliation; preserve local state for `{}`, `[]`, wrong shapes, and malformed JSON. Add tests.

2. **Uncached herb navigation does not return the intended offline 503** — `public/sw.js:187-208`.
   - `networkFetch` is a truthy Promise; `.catch(() => cached)` can resolve `undefined`, leaving `respondWith` without a Response.
   - Return cached immediately; otherwise await network in try/catch and return a real 503 Response. Add offline/no-cache herb-navigation tests.

3. **Unsubscribe → resubscribe → confirm leaves incoherent state** — `src/app/api/newsletter/unsubscribe/route.ts:46-52`, `src/lib/newsletter/subscribe.ts:107-141`, `src/app/api/newsletter/confirm/route.ts:42-48`.
   - Unsubscribe sets `subscribed=false`; resubscribe/confirmation update only status/consent fields. An active old cooldown can return accepted while leaving the row unsubscribed and sending nothing.
   - Define one authoritative state, set `subscribed=true` on successful confirmation if the legacy flag remains, and ensure accepted resubscribe cannot remain unsubscribed. Cover the full lifecycle with active old cooldown.

4. **Newsletter cooldown consumes no-send/failed-send attempts** — `src/lib/newsletter/subscribe.ts:107-176`.
   - Suppressed attempts can keep extending cooldown; timestamps/limiter slots are consumed before send; retries after SMTP failure can return accepted without mail; update errors are ignored; SMTP failures produce different observable behavior for confirmed versus pending addresses.
   - Separate consent time from `last_confirmation_sent_at`, check updates, do not record successful-send cooldown for suppressed/failed sends, and use safe reservation/release or a durable queue. Test send/update failure, repeated suppressed attempts, concurrency, and uniform failure responses.

5. **NPN still has false-complete and stale-result paths** — `src/app/api/npn/lookup/route.ts:105-169`, `src/lib/npn/lnhpd.ts:69-79`, `src/components/npn/npn-checker-client.tsx:104-175,388-401`.
   - A fulfilled 200 with an unrecognized shape becomes an empty section marked `ok` and may be cached complete.
   - New/failed lookups leave old data visible; overlapping lookups can resolve out of order; medication edits retain old matches.
   - Distinguish valid empty arrays from invalid payloads; mark invalid unavailable. Add request generations and clear stale product/medication state on lookup/edit. Test malformed 200, failed second lookup, out-of-order responses, and medication edit.

6. **Memory limiter cleanup mixes windows** — `src/lib/rate-limit.ts:42-64`.
   - Cleanup applies the current caller's window to every key, so minute traffic can erase daily/15-minute history.
   - Store window/expiry per key and clean each with its own window. Add fake-time mixed-window tests, including unrelated-route cleanup.

7. **`verify-db` can pass without production or real data** — `src/lib/db/verify-rules.ts:4-12`, `scripts/verify-herb-database.ts:198-320`, `.github/workflows/ci.yml:31-52`.
   - CI falls back to legacy credentials and omits `--production-only`; arbitrary/custom/lookalike/insecure hosts can pass; zero categories/herbs/interactions pass vacuously.
   - Parse URLs and require the exact HTTPS production origin in production-only mode. Use it in CI and remove legacy fallback when live verification is required. Require sensible nonzero/minimum catalog and interaction cardinality. Do not print credentials.

8. **Enabling the live gate will block main on known collisions** — `scripts/verify-herb-database.ts:309-352`, `.github/workflows/ci.yml:146-158`.
   - Build requires `verify-db`; known unresolved collisions become errors. Do not hide conflicts, but design a safe rollout: resolve records editorially before enabling, or use a narrow reviewed inventory of known fail-safe collisions while failing new/changed collisions. The inventory is acceptable only after API ambiguity and sitemap behavior are fixed.

9. **Noindex collision pages remain in the sitemap** — `src/app/sitemap.ts:834-903`, `src/app/[locale]/(main)/interactions/[herb]/[drug]/page.tsx:274-283`, `src/app/__tests__/sitemap.test.ts:365-412`.
   - Exclude unresolved collision paths from EN/FR sitemap generation. For editorially resolved paths, derive sitemap metadata from the selected row only rather than OR-ing FR status across conflicting rows. Reverse the contradictory test expectation.

10. **Deploy filter skips real runtime build changes** — `.github/workflows/deploy.yml:49-56`, `Dockerfile:24-32`.
    - `scripts/**` is excluded, but the Docker build executes `scripts/patch-next-image-optimizer.mjs`.
    - Remove broad exclusion or narrowly allowlist proven non-runtime scripts. Add a fixture proving an image-optimizer change sets `deploy_needed=true`.

11. **Late profile autofill bypasses dosage invalidation and can overwrite edits** — `src/components/calculator/dose-calculator-form.tsx:122-139`.
    - Track dirty fields, avoid overwriting user edits, invalidate when autofill actually changes relevant fields, and add deferred-profile-after-calculation tests.

12. **New recovery drill is not reliably safe** — `docs/DEPLOYMENT_RUNBOOK.md:53-63`, `docs/database-backup-strategy.md:25-50`.
    - Correct `/srv/herbally/app/deploy` versus `/srv/herbally/deploy`; anchor migration working directory; use `set -euo pipefail`, restrictive `mktemp`, cleanup traps, and explicit restored-count assertions. A decrypt/restore failure must not be followed by DROP/deletion that obscures the failure.

## Minor

1. **Public HMAC fallback** — `src/lib/rate-limit.ts:28-33`. Require a configured server secret for Upstash; never use a repository-known fallback. Runtime configuration remains uninspected.
2. **Storage inventory still incomplete** — add and test `herbally-lang-banner-dismissed` and the HerbAlly session reload markers used in `src/components/i18n/first-visit-banner.tsx:12`, `src/components/ads/ad-document-guard.tsx:65`, and `src/components/ads/ad-slot.tsx:145`. Do not change ads/consent policy.

## Coordinator verification already completed

- 1,313 unit tests and coverage ratchet passed independently.
- Format, typecheck, lint, build, migration-only validation, and secret scan passed independently.
- Full Chromium: 40 passed / 11 skipped.
- Firefox: 39 passed / 11 skipped / 1 flaky `e2e/chat.spec.ts:22` PMID-link test passed on retry. The failed snapshot showed no assistant reply; the remediation does not modify that renderer. Preserve this as a flaky-test note; do not weaken the test.
- Existing long-running `next dev` on port 3000 must remain untouched.
