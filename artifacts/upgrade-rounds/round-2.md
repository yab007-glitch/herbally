# Zero-Cost Upgrade Round 2 (2026-11-24)

Governing brief: [`docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md`](../../docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md)  
Baseline commit: `58bd136` (`main`, post-Round 1 deploy)

## Re-evaluation Baseline

- **Round 1 verification confirmed live**:
  - `https://herbally.app/embed/checker?_v=r1` and `/fr/embed/checker?_v=r1` serve `<main id="main-content"`, `role="combobox"`, and localized attribution (`/` vs `/fr`).
  - `GET https://herbally.app/api/garden` returns `200` with `cache-control: private, no-store`.
  - `GET https://herbally.app/api/rxnorm?term=aspirin` returns `200` with `cache-control: public, s-maxage=3600, stale-while-revalidate=86400`.
  - `https://herbally.app/api/health` returns `200 healthy`.
- **Fresh bugs & gaps found in Round 2 scan**:
  - **Live `GET /api/rxnorm?term=aspirin` data bug**: Returned `8` items including multiple nameless `{"rxcui":"1191"}` stubs and `4` casing duplicates of RxCUI `1191` (`"Aspirin"`, `"aspirin"`, `"ASPIRIN"`).
  - **Client fetch race / error-handling gaps**:
    - `SymptomSearchClient` (`src/app/[locale]/(main)/symptoms/symptom-search-client.tsx`) lacked an `AbortController` across searches/unmount and called `res.json()` without checking `res.ok`.
    - `HomeSearchClient` (`src/app/[locale]/(marketing)/home-search-client.tsx`) called `res.json()` on `/api/herbs/search` without checking `res.ok`.
    - `DonationButtons` (`src/components/donations/donation-buttons.tsx`) lacked `res.ok` checks, allowed concurrent checkout clicks across cards vs custom button, used blocking `window.alert()`, allowed non-finite custom amounts into `Math.max/min`, and left 3 decorative `<svg>` icons without `aria-hidden="true"`.
  - **Missing `Cache-Control` consistency across remaining API routes**:
    - `GET /api/interactions/check?herb=ginger&drug=warfarin` and `GET /api/herbs/search?q=ginger` returned `HTTP/2 200` with no `cache-control` header at origin; `check-stack` lacked `no-store` on error responses; `/api/herbs/view`, `/api/analytics/vitals`, `/api/interpret-search`, and `/api/npn/lookup` (`400`/`404`/`429`) omitted `Cache-Control: no-store`.
    - Untested public routes: `/api/herbs/view` and `/api/analytics/vitals`.

## What Was Chosen and Why

1. **RxNorm candidate filtering & RxCUI deduplication** (`src/lib/utils/rxnorm-client.ts`): Filter out candidates without non-empty `rxcui` and `name`, and deduplicate repeated RxCUI / case-variant entries while preserving ranking order.
2. **Client `fetch` cancellation, error resilience, & donation UX** (`symptom-search-client.tsx`, `home-search-client.tsx`, `donation-buttons.tsx`): Prevented stale search overwrite races on rapid submissions/unmount, guarded `!res.ok` before `.json()`, replaced blocking `alert()` with accessible `role="alert"` + `toast.error()`, prevented double checkout requests, guarded `Number.isFinite` amount parsing, and hid decorative SVGs.
3. **Complete API `Cache-Control` & `Vary: x-locale` coverage**: Added explicit `public, s-maxage=...` + `Vary: x-locale` on healthy deterministic GET lookups (`/api/interactions/check`, `/api/herbs/search`) and `no-store` on all error, collision, mutation, POST, and telemetry endpoints (`check-stack`, `herbs/view`, `analytics/vitals`, `interpret-search`, `npn/lookup` error/404 paths).
4. **Unit test additions**: Added `donation-buttons.test.tsx`, `herbs/view/__tests__/route.test.ts`, `analytics/vitals/__tests__/route.test.ts`, RxNorm deduplication test, and `Cache-Control` / `Vary` header assertions in `check.route.test.ts`.

## Before & After Measurements

| Metric                                                  | Before                         | After                                                            |
| ------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Live `/api/rxnorm?term=aspirin` nameless/duplicate rows | `8` items (`4` nameless, dupes)| `1` unique valid item (`1191 / Aspirin`), `0` nameless, `0` dupes|
| Client `await fetch()` without `res.ok` / abort guard   | `3` UI components              | `0`                                                              |
| API routes in `src/app/api/` with explicit Cache-Control| `14` / `21`                    | `21` / `21` (all routes covered)                                 |
| Unit tests passing (`vitest run`)                       | `175` files / `1,400` tests    | `178` files / `1,412` tests (`100%` passing)                     |
| Production static build pages                           | `186`                          | `186 / 186` clean                                                |

## Skipped Items (Owner Decision or Spend Required)

- **6 colliding `drug_interactions` URL pairs** (`src/lib/interactions/pair-url.ts`): Protected behind `noindex` fail-safe; awaiting owner clinical sign-off.
- **Unreviewed AI herb monographs & content fields**: Requires clinical review (`IMPROVEMENT_ROADMAP.md`, `STATUS.md`).
- **Higher hardware concurrency scaling**: Self-hosted host capacity constraint (non-zero spend).

## Ranked Next Opportunities (Zero-Cost Assessment for Stop vs. Round 3)

1. **Live Lighthouse Mobile + Playwright `@axe-core/playwright` check across public templates (`/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/embed/checker`, `/fr/embed/checker`)**: Verify post-Round-1/2 templates pass `0` axe-core violations live.
2. **Test coverage for pure business-logic helper modules (e.g. `src/lib/i18n/herb-page-copy.ts`, `src/lib/herbs/photo-credits.ts`, `src/lib/interactions/pairs.ts`)**: Raises unit test coverage on pure data-mapping utilities.
3. **Bundle/performance check within existing SSR/client payload budget**: Re-verify `/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs` stay well under the `200 KB` threshold (`herb-payload-budget.test.tsx`).

**Top candidate next:** #1 live verification + final check whether any determinate bug remains before stopping under the brief's diminishing-returns / cosmetic-churn stop criteria.
