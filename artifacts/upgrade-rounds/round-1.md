# Zero-Cost Upgrade Round 1 (2026-11-24)

Governing brief: [`docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md`](../../docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md)  
Baseline commit: `ee3290c` (`main`)

## Re-evaluation Baseline

- **Perf & Payload**:
  - `GET https://herbally.app/?_v=loop1`: `72.3 KB` HTML, `34.3 KB` inline JS, `239ms`
  - `GET https://herbally.app/herbs/turmeric?_v=loop1`: `197.9 KB` HTML, `71.6 KB` inline JS, `225ms`
  - `GET https://herbally.app/fr/herbs/turmeric?_v=loop1`: `190.5 KB` HTML, `65.5 KB` inline JS, `342ms`
  - `GET https://herbally.app/herbs?_v=loop1`: `235.0 KB` HTML, `57.5 KB` inline JS, `287ms`
  - Payload budget test (`src/components/herbs/__tests__/herb-payload-budget.test.tsx`): `HerbSchema` JSON-LD `3.33 KB`, Herb SSR HTML `81.9 KB` + client props `16.1 KB` (`97.9 KB` combined < `200 KB` budget).
- **Correctness & Sitemap**:
  - `https://herbally.app/sitemap.xml?_v=loop1`: `8,062` `<loc>` entries (`8,062` unique); sampled `200` URLs (`100` herbs + `100` non-herb URLs) at concurrency 4 → `0` non-`200`, `0` `noindex`.
  - Code audit surfaced a real bug in `/embed/checker`: `EmbedChecker` called `searchAbort.current?.abort()` on mount instead of unmount cleanup, lacked `res.ok` error handling, lacked `/fr` locale routing for French embed visitors, and `/embed/checker` lacked a `<main id="main-content">` landmark for `<SkipToContent />`.
  - Code audit also surfaced a real bug in `searchHerbs()` (`src/lib/actions/herbs.ts`): keyword searches did not select `translations`, so French keyword hits returned English names; plus raw `error.message` leaks in `herbs.ts` and `admin-mfa.ts`, missing `Cache-Control` headers across API routes (including transient RxNorm timeouts being cacheable for 1h), and `21` non-submit `<button>` elements without `type="button"`.
- **Translations**:
  - Live `/fr/herbs/turmeric` returned `<html lang="fr">` with French schema blocks.
  - Embed widget (`/fr/embed/checker`) translated UI strings to French via `tools.json` (`embed.*`), but outbound `/herbalist?q=...` and attribution links hardcoded English paths/prompts.
- **Accessibility**:
  - `0` `target="_blank"` anchors missing `rel="noopener"`.
  - `21` non-submit `<button>` elements missing explicit `type="button"`; `/embed/checker` lacked `<main id="main-content">` and ARIA combobox roles.
- **Structured Data**:
  - Verified JSON-LD `@type` sets intact across `/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs`, `/widgets`, and `/embed/checker`.
- **Runtime**:
  - `https://herbally.app/api/health` → HTTP `200` `{"status":"healthy","version":"0.1.0"}`.
  - Live `verify-db` GitHub Actions job `138929951618` → `3,122` published herbs, `99` migrations, `Errors: 0`, `Warnings: 6` (only the 6 known fail-safe collisions).
  - `npm audit --omit=dev --audit-level=moderate` → `0` vulnerabilities.

## What Was Chosen and Why

Fixed correctness, localization, accessibility, error-sanitization, CDN-cache safety, and test-coverage gaps surfaced directly by the fresh audit with zero spend and zero invented content:

1. **Embed widget correctness, landmark & FR parity** (`src/app/[locale]/embed/checker/page.tsx`, `src/components/embed/embed-checker.tsx`): Fixed the inverted `useEffect` abort cleanup, guarded non-OK `/api/herbs/search` responses, added `<main id="main-content">`, added ARIA `combobox`/`listbox`/`option` roles, and localized outbound `/herbalist` queries + attribution links for `/fr/embed/checker`.
2. **Explicit `type="button"` across UI** (`14` client components, `21` non-submit `<button>` elements): Eliminated implicit `type="submit"` hazards inside forms across navigation, tabs, FAQs, symptoms, language switcher, and chat controls (`0` remaining untyped JSX `<button>` elements in `src/`).
3. **French keyword localization & raw DB/MFA error sanitization** (`src/lib/actions/herbs.ts`, `src/lib/actions/admin-mfa.ts`): Selected `translations` on keyword search in `searchHerbs()` so French keyword results localize properly, and replaced returned raw PostgREST/GoTrue `error.message` strings with static user-facing messages while keeping structured server logging.
4. **API `Cache-Control` & revalidation parity** (`src/app/api/revalidate-herb/route.ts`, `revalidate-pubmed-sheet/route.ts`, `rxnorm/route.ts`, `openfda/route.ts`, `garden/route.ts`, `donate/route.ts`, `newsletter/*.ts`, `src/lib/utils/rxnorm-client.ts`): Added `private, no-store` on private/admin/mutation/redirect endpoints, `public, s-maxage=3600, stale-while-revalidate=86400` on healthy public lookups (`no-store` on errors/unavailability), prevented RxNorm transient outages from being CDN-cached for 1 hour via `searchDrugsWithAvailability()`, and expanded `POST /api/revalidate-herb` to revalidate localized `/compare` and `/symptoms` subtrees.
5. **High-value unit tests**: Added `embed-checker.test.tsx`, `revalidate-herb/__tests__/route.test.ts`, `scrub-event.test.ts` (Sentry PII/health redaction), and `fetch-with-timeout.test.ts` (timeout + 3-strike circuit breaker), plus regression assertions in `herbs.test.ts`, `admin-mfa.test.ts`, `rxnorm.test.ts`, `openfda.test.ts`, `garden/__tests__/route.test.ts`, and `newsletter/__tests__/route.test.ts`.

## Before & After Measurements

| Metric                                                | Before     | After                                             |
| ----------------------------------------------------- | ---------- | ------------------------------------------------- |
| Untyped non-submit JSX `<button>` elements in `src/`  | `21`       | `0`                                               |
| `/embed/checker` `<main id="main-content">` landmark  | Missing    | Present                                           |
| `EmbedChecker` unmount abort cleanup & FR parity      | Broken/EN  | Fixed (`useEffect` cleanup + `/fr/herbalist`)     |
| `searchHerbs()` keyword query `translations` selection| Omitted    | Selected & localized                              |
| Raw `error.message` returned in `herbs.ts` / MFA      | `8` sites  | `0` non-PGRST103 raw leaks                        |
| Private/admin/lookup API routes explicit `Cache-Control` | Partial | `9` hardened routes (`no-store` / public SWR)     |
| Unit tests passing (`vitest run`)                     | `171 / 1383` | `175` files / `1,400` tests (`100%` passing)    |
| Production static build pages                         | `186`      | `186 / 186` clean                                 |

## Skipped Items (Owner Decision or Spend Required)

- **6 colliding `drug_interactions` URL pairs** (`src/lib/interactions/pair-url.ts`, `src/lib/db/verify-rules.ts`): Protected behind `noindex` fail-safe UI; requires clinical/editorial adjudication before selecting canonical severity/records.
- **2,700+ unreviewed AI monographs / provenance audit**: Requires human/clinical review (`IMPROVEMENT_ROADMAP.md`, `STATUS.md`).
- **20-way concurrency origin `502` headroom**: Single-host self-hosted hardware capacity item; 4–6-way traffic and single-user requests succeed cleanly.

## Ranked Next Opportunities (Zero-Cost, Candidates for Round 2)

1. **Test coverage & error-boundary hardening on untested `src/app/api/*` routes (`ads/region`, `analytics/vitals`, `herbs/view`, `npn/lookup`, `interactions/check`, `interactions/check-stack`)**: High reliability gain, zero spend, catches edge-case regressions on public medical/analytics APIs before deploy.
2. **Client-side error & empty-state hardening on `/interactions`, `/npn-checker`, and `/calculator` (e.g., `fetch` non-OK handling, explicit `Cache-Control` on `/api/herbs/view`, `/api/analytics/vitals`, `/api/ads/region`)**: Medium UX & reliability gain, zero spend.
3. **Lighthouse mobile & axe-core Playwright audit across main public templates (`/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/embed/checker`)**: Confirms zero A11y regressions and measures any interactive TBT / LCP improvements within the static shell.

**Top candidate for Round 2:** #1 + #2 combined (auditing remaining untested `/api/*` routes + adding missing `Cache-Control` headers and unit tests for `/api/npn/lookup`, `/api/interactions/check`, `/api/interactions/check-stack`, `/api/herbs/view`, `/api/analytics/vitals`, `/api/ads/region`, and verifying any client `fetch` callers handle `unavailable: true` / non-OK cleanly).
