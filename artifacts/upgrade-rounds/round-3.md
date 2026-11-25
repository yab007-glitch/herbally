# Zero-Cost Upgrade Round 3 (2026-11-24)

Governing brief: [`docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md`](../../docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md)  
Baseline commit: `87d98ac` (`main`, post-Round 2 deploy)

## Re-evaluation Baseline

- **Round 2 verification confirmed live**:
  - `GET https://herbally.app/api/rxnorm?term=aspirin&_v=r2` returns `1` clean candidate (`{"rxcui":"1191","name":"Aspirin","synonym":"Aspirin"}`) with `cache-control: public, s-maxage=3600, stale-while-revalidate=86400`.
  - All `21 / 21` API route modules emit explicit `Cache-Control` headers.
- **Full-site live Playwright `@axe-core/playwright` + console/runtime error sweep across 34 EN/FR public routes + dark mode**:
  - `28 / 34` routes passed cleanly (`0` page errors, `0` console errors, `0` axe violations).
  - `6` live route groups surfaced reproducible runtime/accessibility defects:
    1. **`/sponsors` and `/fr/sponsors` — Live React `#418` hydration error**: Cloudflare Scrape Shield Email Obfuscation rewrote bare `info@herbally.app` text nodes inside `#contact` (`<a class="__cf_email__">` / `<span class="__cf_email__">`), splitting SSR text nodes and causing `Minified React error #418?args[]=text`.
    2. **`/login`, `/register`, `/forgot-password`, `/reset-password` (and `/fr/*`) — `4` axe violations per page (`1` serious)**:
       - `(auth)/layout.tsx` omitted `id="main-content"` on `<main>`, breaking `.skip-to-content` (`skip-link` + `region`).
       - `<nav className="mt-6">` reused `common.navFooter` (`landmark-unique` collision with `<MarketingFooter />`) and the brand logo used raw `next/link` instead of `<LocalizedLink>`.
       - Inline links (`register`, `signIn`, `back`) in `src/components/auth/auth-forms.tsx` relied solely on `hover:underline` with insufficient contrast delta against muted body text (`link-in-text-block`, serious).
    3. **`/donate` and `/fr/donate` — `3` serious `label-content-name-mismatch` violations**:
       - Tier cards rendered visible `$5 Coffee`, `$15 Supporter`, `$50 Champion` while overriding `aria-label` in reversed order (`Coffee — $5`), failing WCAG 2.5.3. Decorative icons (`Loader2`, `Icon`, `Heart`) also lacked `aria-hidden="true"`.
    4. **`/methodology` and `/fr/methodology` — `heading-order` violation**:
       - `ChipLegend` rendered `<h3>` section eyebrows directly below `<h1>` on `/methodology` (and above/inside cards on `/herbs`), while `CardTitle` on `/methodology` rendered a `<div>` instead of `<h2>` before `<h3>` subsections.
    5. **`/embed/checker`, `/fr/embed/checker`, `/widgets`, and `/fr/widgets` — `page-has-heading-one` & `landmark-unique` violations**:
       - `EmbedChecker` rendered `<p>` instead of `<h1 id="embed-checker-heading">` and `/embed/checker`'s `<main id="main-content">` lacked `aria-labelledby`, colliding with `/widgets`'s `#main-content` when embedded in an `<iframe>`.
       - Inside the `/embed/checker` iframe, the shared root `<Toaster />` rendered a second `section[aria-label="Notifications alt+T"]` landmark, triggering `landmark-unique` on `/widgets` and `/fr/widgets`.
    6. **Dark-mode herb monograph template (`/herbs/turmeric`, `/fr/herbs/turmeric`) — `13` serious `color-contrast` violations**:
       - `text-neutral-500` (`#737373`) on `dark:bg-neutral-900` (`#171717`) measured `3.78:1` (< `4.5:1` WCAG AA) across `HerbSourcesView` and `NccihSummary` (affecting all `3,122` herb pages).

## What Was Chosen and Why

1. **Fix live `/sponsors` & `/fr/sponsors` React `#418` hydration error (`src/app/[locale]/(marketing)/sponsors/page.tsx`, `page.test.tsx`)**: Added `renderTextWithSafeEmail()` to render `<span>info</span>@<span>herbally.app</span>` inside `#contact` copy and button text, preserving selectable/screen-reader `info@herbally.app` text while preventing Cloudflare Email Obfuscation from mutating SSR text nodes before hydration; added regression assertions in `sponsors/page.test.tsx`.
2. **Resolve all `(auth)` layout and link accessibility defects (`src/app/[locale]/(auth)/layout.tsx`, `src/components/auth/auth-forms.tsx`)**: Added `id="main-content"` to `<main>`, localized the home logo link via `<LocalizedLink>`, assigned a distinct `"Legal links"` / `"Liens légaux"` `aria-label` to `<nav className="mt-6">`, and added persistent `underline underline-offset-4` to inline auth form links.
3. **Fix `/donate` tier accessible names (`src/components/donations/donation-buttons.tsx`, `donation-buttons.test.tsx`)**: Removed the reversed `aria-label` from preset tier cards so accessible names match visible content naturally, hid decorative Lucide icons from assistive tech, and updated `donation-buttons.test.tsx`.
4. **Fix `/methodology` heading hierarchy (`src/components/herbs/chip-legend.tsx`, `src/app/[locale]/(marketing)/methodology/page.tsx`)**: Changed `ChipLegend` eyebrow labels from `<h3>` to `<p>` and wrapped methodology `CardTitle` text in `<h2>` (with `aria-hidden="true"` on decorative icons).
5. **Fix `/embed/checker` `<h1>` & `/widgets` landmark uniqueness (`src/components/embed/embed-checker.tsx`, `src/app/[locale]/embed/checker/page.tsx`, `src/components/ui/sonner.tsx`, unit tests)**: Upgraded the embed widget title to `<h1 id="embed-checker-heading">`, wired `aria-labelledby="embed-checker-heading"` on embed `<main>`, and omitted `<Toaster />` on `/embed/` routes so `<iframe>` previews do not create duplicate notification landmarks on `/widgets` / `/fr/widgets`.
6. **Fix dark-mode WCAG AA contrast on herb monographs (`src/components/herbs/herb-sources-view.tsx`, `src/components/herbs/nccih-summary.tsx`)**: Added `dark:text-neutral-400` alongside `text-neutral-500` on source metadata/headings across `HerbSourcesView` and `NccihSummary` (all `3,122` herb monograph pages).

## Before & After Measurements

| Metric                                                          | Before (Baseline)         | After (Local Gate Passed)      |
| --------------------------------------------------------------- | ------------------------- | ------------------------------ |
| Live `/sponsors` & `/fr/sponsors` React hydration error (`#418`)| Present on every load     | Fixed + unit regression guard  |
| Live `/login`, `/register`, `/forgot-password`, `/reset-password` axe issues | `3–4` violations/page (`1` serious) | Remediated (`id="main-content"`, unique nav, underlines) |
| Live `/donate` & `/fr/donate` `label-content-name-mismatch`     | `3` serious violations    | `0`                            |
| Live `/methodology` & `/fr/methodology` `heading-order`         | `1` violation             | `h1 -> h2 -> h3` clean         |
| Live `/embed/checker` & `/widgets` axe violations               | `2` (`h1` + landmark-unique) | Remediated + unit-tested    |
| Dark-mode `/herbs/turmeric` `color-contrast` violations         | `13` serious violations   | Remediated (`dark:text-neutral-400`) |
| Unit tests passing (`vitest run`)                               | `178` files / `1,412` tests | `178` files / `1,413` tests (`100%` passing) |
| Format, typecheck, lint, migrations, secrets                    | Green                     | `format:check`, `typecheck`, `lint`, `build`, `99` migrations, `detect-secrets` all `0` |

## Skipped Items (Owner Decision or Spend Required)

- **6 colliding `drug_interactions` URL pairs** (`src/lib/interactions/pair-url.ts`): Fail-safe `noindex` intact; awaiting owner clinical sign-off.
- **Unreviewed AI herb monographs & content fields**: Requires clinical review (`IMPROVEMENT_ROADMAP.md`, `STATUS.md`).
- **Infrastructure / third-party capacity scaling**: Requires hardware/tier spend.

## Stop-Criteria Evaluation

Post-deploy live verification of all fixed EN/FR light & dark routes plus `npm audit --omit=dev` will determine whether Round 3 completes the zero-cost loop (`"no further zero-cost work with a measurable outcome"`).
