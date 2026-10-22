# Deferred plan: get `headers()` out of the root layout and make pages cacheable

**Status:** deferred, not started
**Written:** 2026-10-22
**Scope:** Next.js 16.3.4 App Router (`src/app`), next-intl 4.14, Vercel
**Non-goal:** adopting Cache Components (`cacheComponents: true`). This plan stays on the previous caching model (`dynamic`, `revalidate`, `generateStaticParams`) and can be done without that flag.

## Why this exists

Every HTML route is currently rendered per request. The chain is:

1. `src/app/layout.tsx` calls `getLocaleFromRequest()` (`src/lib/i18n/server-locale.ts`), which calls `headers()`.
2. `i18n/request.ts` also calls `headers()` to resolve the locale for `getTranslations`.
3. The locale only exists in the `x-locale` request header, set by `src/proxy.ts` from the URL prefix.

Reading a request API in the root layout makes the whole tree dynamic. On top of that, six routes declare `export const dynamic = "force-dynamic"`:

- `src/app/(main)/herbs/[slug]/page.tsx`
- `src/app/(main)/interactions/[herb]/[drug]/page.tsx`
- `src/app/(main)/compare/[slug1]/vs/[slug2]/page.tsx`
- `src/app/(main)/symptoms/[symptom]/page.tsx`
- `src/app/(main)/herbalist/page.tsx`
- `src/app/admin/pubmed-review/page.tsx`

Observed on production (2026-10-22): HTML routes return `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` and `x-vercel-cache: MISS`. Every page view runs a function and its Supabase work; that is the cost PR #147 only mitigated at the query level.

The `force-dynamic` exports are not arbitrary. An earlier attempt to add ISR while `headers()` was still reachable turned any slug outside the prerendered set into a 500: Next tries to generate it on demand as static generation, and `headers()` throws inside that pass. The 2026-10-08 outage came from acting on a wrong explanation of that behavior. Therefore **locale must stop being a request-header input before ISR is re-enabled**. Removing `headers()` from the root layout is necessary but not sufficient; see the inventory below.

## Target design

Locale becomes a route parameter. The URL remains the single source of truth, and the public URL scheme does not change (no visible `/en` prefix).

- Move the root layout to `app/[locale]/layout.tsx` and all page segments under it.
- Read the locale with `locale()` from `next/root-params` (Next.js 16.3+; installed 16.3.4). Root params can be read from any Server Component or server-side utility without prop drilling.
- Keep the proxy rewrite, but make it rewrite the locale into the internal path:
  - public `/herbs/ginger` → internal `/en/herbs/ginger`
  - public `/fr/herbs/ginger` → internal `/fr/herbs/ginger` (pass through, no stripping)
  - public `/en/*` → 308 redirect to the unprefixed path, so there is one canonical English URL
  - the existing first-visit French redirect (cookie / `Accept-Language`) stays as-is
- Keep setting `x-locale` for **API route handlers only**. `next/root-params` is not available in Route Handlers, and `src/app/api/herbs/search/route.ts` reads `x-locale` today. Page routes stop reading it.
- next-intl: `getRequestConfig` gets the locale from `requestLocale`; the `[locale]` layout (and static pages) call `setRequestLocale(locale)`. Delete the `headers()` fallback in `i18n/request.ts`.
- Server-side data helpers receive `locale` as an argument. Do not call a root-param getter inside `unstable_cache`; it throws there. Existing cached helpers already accept `locale`, which is the correct shape.

## What moves where

| Current                                                            | New                               | Notes                                                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/layout.tsx`                                               | `src/app/[locale]/layout.tsx`     | Becomes the root layout. `<html lang>`, providers, `generateMetadata`, Analytics/WebVitals all move unchanged. Locale from `await locale()`.           |
| `src/app/(main)/**`                                                | `src/app/[locale]/(main)/**`      | Mechanical move.                                                                                                                                       |
| `src/app/(marketing)/**`                                           | `src/app/[locale]/(marketing)/**` | Mechanical move.                                                                                                                                       |
| `src/app/(auth)/**`                                                | `src/app/[locale]/(auth)/**`      | Mechanical move.                                                                                                                                       |
| `src/app/admin/**`                                                 | `src/app/[locale]/admin/**`       | Decide whether admin is localized; it may stay English-only but still needs the segment.                                                               |
| `src/app/embed/**`                                                 | `src/app/[locale]/embed/**`       | `/embed/*` and `/fr/embed/*` must stay frameable. Proxy `frameable` logic must keep matching both.                                                     |
| `src/app/not-found.tsx`                                            | `src/app/[locale]/not-found.tsx`  | Localized 404. Verify whether a root-level fallback is needed for paths that match no `[locale]` segment.                                              |
| `src/app/error.tsx`, `global-error.tsx`                            | unchanged                         | `global-error` replaces the root layout; keep at `app/` and test it still compiles with the moved tree.                                                |
| `src/app/api/**`                                                   | unchanged                         | Route handlers stay outside `[locale]`; keep `x-locale` from the proxy for these.                                                                      |
| `robots.ts`, `sitemap.ts`, `manifest.ts`, icons, OG/Twitter images | unchanged                         | Do not use the root layout. Verify sitemap output still has both locales.                                                                              |
| `src/lib/i18n/server-locale.ts`                                    | split                             | `getLocaleFromRequest()` for pages becomes a root-param read; keep a header-based helper for route handlers/actions, named so the boundary is obvious. |
| `src/proxy.ts`                                                     | rework locale block               | Rewrite English to `/en/*`, pass `/fr/*` through, redirect public `/en/*`, keep exclusions and security headers. Keep `x-locale` for `/api/*`.         |
| `i18n/request.ts`                                                  | rework                            | Remove `headers()`; use `requestLocale` + `setRequestLocale`.                                                                                          |

## What breaks, and how to keep it from breaking

### 1. Server Actions and Route Handlers cannot read root params

This is the largest hidden cost. `getLocaleFromRequest` has 79 references across 33 files; 24 of those references are under `src/app`. Each call site has to be classified:

- **Server Component / server utility used during render:** switch to the root-param helper.
- **Server Action invoked after render:** accept `locale` as an argument. Reading `headers()` inside an action is fine for the action itself, but it does not help the page cache and keeps the "locale from a header" contract alive.
- **Route Handler:** keep the header-based helper. `/api/herbs/search` already does this directly.

Concrete blockers found in the current tree:

- `getHerbs()` in `src/lib/actions/herbs.ts` reads `getLocaleFromRequest()`; it is used by the herbs list page during render.
- `getHerbBySlug(slug)` without `opts.locale` falls back to `getLocale()` (headers) and uses a cookie-bound Supabase client. `src/app/(main)/calculator/page.tsx` and `src/app/(main)/herbalist/page.tsx` call it that way, so both remain dynamic even after the root layout is fixed. Pass `{ locale, skipCookies: true }` for public content.
- `src/lib/ai/context-fetcher.ts` uses `getLocaleFromRequest()` only as a fallback when the caller does not pass a locale. Prefer passing it; leave the fallback for tests/actions.

### 2. Other request APIs still make routes dynamic

Removing `headers()` from the layout is not enough if a page also calls `cookies()` or reads `searchParams`. Public content routes must use `skipCookies: true` / the anon client. Auth, profile, garden, admin and anything session-scoped should stay dynamic — that is correct and should not be forced static. Do a per-route inventory before phase 3 and record the result in the PR.

### 3. Proxy rewrite details

- Do not double-prefix: an internal `/fr/*` rewrite must not be rewritten again to `/fr/fr/*`. Prefer passing `/fr/*` through unchanged and only rewriting unprefixed paths.
- Keep `LOCALE_EXCLUDED_PATHS` (`/api`, `/auth`, `_next`, static assets, robots, sitemap, manifest, icons) out of locale rewriting.
- `/fr` alone must map to the French home page, not to a path with a trailing artifact.
- Unknown first segments must 404, not render a default locale silently. Validate against `LOCALES` in the layout.
- The first-visit French redirect must run before the English rewrite and must not fire for `/fr/*`.
- `/embed/*` and `/fr/embed/*` must keep their frameable headers; the current `frameable` check already handles both raw and stripped paths — re-verify after the routing change.

### 4. next-intl message resolution

`getTranslations({ locale })` calls that pass an explicit locale are safe. Calls without an explicit locale depend on `i18n/request.ts`. If `setRequestLocale` is missing, next-intl may resolve messages from the default locale while the page renders French, or throw during static generation. Verify both `en` and `fr` on every route family.

### 5. Build-time cost and the free-tier database

The build runs against the same 0.5 GB Supabase instance. Do not turn on prerendering for every herb and interaction pair at once. Start with a small cap (`PRERENDER_HERB_LIMIT` is currently 0) and rely on on-demand ISR for the rest. `dynamicParams` defaults to true; the old 500s came from `headers()` throwing during on-demand generation, not from `dynamicParams` itself. After the locale change, explicitly test a published-but-not-prerendered slug.

### 6. SEO and canonical URLs

The public URL scheme is unchanged, but verify:

- `<html lang>` is `en`/`fr` correctly on unprefixed and `/fr` URLs.
- `buildPageMetadata` canonical and `hreflang` alternates are unchanged.
- `sitemap.ts` still emits both variants.
- Public `/en/*` redirects to the unprefixed URL and does not appear in the sitemap.
- OpenGraph `locale` is still `fr_FR` / `en_US`.

### 7. Test mocks

`src/lib/i18n/__tests__/server-locale.test.ts` mocks `next/headers`. Once pages use `next/root-params`, those tests must mock the new module instead. Keep separate tests for the header-based helper used by route handlers.

## Test strategy

### Static checks (gate every PR)

- `npx tsc --noEmit` — exit 0.
- `npx eslint` — exit 0.
- `npx prettier --check .` — exit 0.
- `npx vitest run` — baseline on 2026-10-22 was 57 files / 472 tests passing. No test count regression.
- `npm run build` — exit 0.

### Build-output contract

After `next build`, the routes that should now be cacheable must stop appearing as `ƒ (Dynamic)` and appear as static/SSG (`○`/`●`) or ISR with a revalidate column. Include both locale variants. This is the primary proof that the change worked; a green unit suite alone does not prove the route became cacheable. Check `.next/prerender-manifest.json` for the expected entries as a second source.

### Unit tests to add or rewrite

- `server-locale`: root-param path returns `fr`/`en`; unknown value falls back to `DEFAULT_LOCALE`; header-based helper still returns the API locale.
- Proxy locale routing: `/` → internal `/en`; `/fr` → `/fr`; `/herbs` → `/en/herbs`; `/fr/herbs` unchanged; `/en/herbs` redirects; `/api/*` untouched; excluded paths untouched; French first-visit redirect still fires once.
- `i18n/request.ts`: resolves messages for both locales without `headers()`; locale is present for static rendering after `setRequestLocale`.
- `getHerbs` / `getHerbBySlug`: locale is honored when passed; public callers do not read cookies.

### Runtime smoke matrix (local `next start`)

For each of these, check status 200, `<html lang>`, canonical/hreflang, and a translated string:

- `/`, `/fr`
- `/herbs/ginger`, `/fr/herbs/ginger`
- `/interactions/ginger/warfarin`, `/fr/interactions/ginger/warfarin`
- `/symptoms/nausea`, `/fr/symptoms/nausea`
- `/compare/ginger/vs/turmeric`, `/fr/compare/ginger/vs/turmeric`
- `/calculator`, `/fr/calculator`
- `/garden`
- `/api/health` (must stay dynamic/no-store)

Then the regression cases that caused the 2026-10-08 outage:

- a published slug that is **not** in the prerendered set → 200, generated on demand;
- an unknown slug → 404, not 500, in both locales.

### Cache verification on a preview deployment

- First request: `x-vercel-cache: MISS`.
- Second request to an ISR route: `HIT` or `STALE`, with `cache-control` containing `s-maxage` / `stale-while-revalidate` instead of `no-store`.
- `/api/*` and authenticated routes remain uncached.
- Preview protection may interfere with header checks; use a protection-bypass token or a production canary alias.

### E2E and monitoring

- Existing Playwright suite must pass; add one French and one unprefixed smoke test.
- Sentry uptime monitor now checks `https://herbally.app/api/health` (changed 2026-10-22). Keep that endpoint dynamic and cheap.
- Compare 24–48 h before/after: 5xx rate, TTFB, function invocations, Supabase disk IO, CDN hit rate.

## Sequencing

Each phase is independently deployable and revertible. Do not combine phase 1 and phase 3.

**Phase 0 — inventory and guardrails (no behavior change)**

- Enumerate every `headers()`, `cookies()`, `searchParams` and `dynamic` usage per route; classify each helper call site as render / action / route handler.
- Add the proxy tests and the runtime smoke checklist. Record the current build output as the baseline.

**Phase 1 — introduce `[locale]` and move the tree (behavior-preserving)**

- Create `app/[locale]/layout.tsx` and move the route groups under it.
- Proxy rewrites English to `/en/*`; French passes through; public `/en/*` redirects.
- Keep `force-dynamic` everywhere and keep reading locale from `x-locale` for now.
- Goal: byte-for-byte behavioral parity, no caching change. This is the riskiest structural PR; exercise it on a preview URL before merging.

**Phase 2 — change the locale source**

- Pages and server utilities read `next/root-params`; `i18n/request.ts` uses `requestLocale` + `setRequestLocale`.
- Stop setting `x-locale` for page routes; keep it for `/api/*`.
- Update tests; keep `force-dynamic`. Verify EN/FR parity again.
- After this phase, the root layout no longer reads a request API.

**Phase 3 — enable ISR one route family at a time**

- Remove `force-dynamic` and add `generateStaticParams` + `revalidate` per route family, in this order:
  1. marketing pages (lowest risk, no DB),
  2. symptoms and compare,
  3. herbs and interactions.
- Keep a small prerender cap. Watch 5xx and Supabase after each deploy.
- Fix any remaining cookie/header reads exposed by the build output one route at a time.

**Phase 4 — raise the prerender cap**

- 0 → 25 → 100 → all (or on-demand only), watching build time, build memory, and Supabase load.
- Keep `revalidate` windows aligned with the existing `unstable_cache` TTLs (24 h for herb data, 1 h for PubMed sheets).

**Phase 5 — verify and document**

- Confirm CDN HIT/STALE on the smoke matrix; confirm headers no longer say `no-store` for public pages.
- Update this document and `docs/performance-monitoring.md` with the new expectations and the rollback steps.

## Rollback

- Phase 1: revert the move commit; the proxy rewrite goes back with it.
- Phase 2: revert to reading `x-locale` in the page helpers; `force-dynamic` is still in place, so behavior returns to today's.
- Phase 3: re-add `export const dynamic = "force-dynamic"` to the affected route — this is an immediate, per-route rollback and does not require reverting the tree move.
- Keep a production alias/canary available so a bad deploy can be switched back without a rebuild.

## Success criteria

- Every route in the smoke matrix returns 200 in both locales with correct `lang`, canonical and content.
- Previously dynamic public routes are static/ISR at build time, and repeat requests are CDN hits.
- A published-but-unlisted slug returns 200; an unknown slug returns 404 (not 500) in both locales.
- Function invocations and Supabase disk IO drop materially versus the 2026-10-22 baseline.
- No SEO regression: sitemap, hreflang and canonical URLs unchanged.

## Open questions / decisions to make in phase 1

- Root-level `not-found` behavior when the path has no valid `[locale]` segment.
- Whether `admin`, `embed` and auth routes need locale variants or can be English-only.
- Whether to keep `x-locale` as a belt-and-braces header for pages (harmless if unread) or remove it entirely outside `/api`.
- How many slugs to prerender given the free-tier database; prefer on-demand ISR if build cost is high.
- Whether a future Cache Components migration is worth it after this work; it is explicitly out of scope here.
