# Task brief — HerbAlly performance, second pass (2026-11-23)

Repo `/Users/yasser/herbally`; production `https://herbally.app`. Builds on
`docs/agent-tasks/2026-11-23-page-load-performance.md` (first pass deployed, commits
`0de3c22..ff03fa9`).

## Where it stands now (measured live, 2026-11-23)

| Page                 | HTML   | Inline JS |
| -------------------- | ------ | --------- |
| `/herbs/turmeric`    | 195 KB | 76 KB     |
| `/fr/herbs/turmeric` | 188 KB | 67 KB     |
| `/`                  | 71 KB  | 34 KB     |
| `/herbs`             | 234 KB | 65 KB     |

Lighthouse mobile: score 75→80, TBT 170→120 ms. Throttled LCP is still ~4.8 s.

The first pass named three residual blocks. This pass attacks **1 and 2 only**. Do not attempt
3 (SSR prose/SVG floor) — it needs a layout decision the owner has not made.

## Task 1 — stop shipping the whole locale dictionary to the client

`EnLocaleProvider` / `FrLocaleProvider` pass the entire `src/lib/i18n/dictionaries/en.json`
and `fr.json` into `NextIntlClientProvider`. That is ~122–139 KB raw (~79 KB transfer) on
every page, most of it unused by client components.

- Find which keys are actually read by **client** components (`"use client"` files) as opposed
  to server components, which can read the dictionary directly.
- Pass only the namespaces those client components need. Prefer per-group providers or a
  server-built subset; do not invent a new i18n framework.
- **Correctness is the priority.** Every key a client component can reach must still resolve:
  - no `MISSING_MESSAGE` / `IntlError` at runtime,
  - no untranslated fallback appearing where a translation existed,
  - `next-intl` fallback semantics unchanged.
- Verify by loading both locales across the pages that mount client components: home,
  `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs`, `/fr/herbs`, `/symptoms`, `/interactions`,
  a 404, and the garden page.
- Add or extend a test that asserts a client component cannot read a key outside the injected
  subset, and that the injected subset still contains the keys the client components use.

Target: at least **50 KB less transfer** on herb pages; no missing-message errors.

## Task 2 — defer Sentry off the critical path

`@sentry/nextjs` is in the route-level client bundle (`2i-qaginx3z4g.js`, 119 KB transfer,
43 KB unused) and drives much of the remaining TBT.

- Initialise Sentry **after** hydration / on idle, or move client error reporting behind a
  dynamic import that only loads on error or after `requestIdleCallback`.
- Keep error capture working: a thrown error in a client component must still be reported.
  Verify by triggering a test error in a preview/local build and confirming the event is
  captured (or that the deferred client initialises), not merely that the bundle is smaller.
- Do not remove Sentry from the server runtime if it is used there.
- Do not touch Cloudflare Web Analytics, Vercel analytics, ads or consent.

Target: Sentry's client chunk absent from initial page load; TBT no worse and ideally lower.

## Do not

- Do not change copy, medical content, robots directives, the "Reviewed and verified" line, or
  the review/schema behaviour.
- Do not remove ads, consent, analytics or the chat widget.
- Do not attempt the SSR prose/SVG reduction in this pass.
- Do not raise the 200 KB payload budget test to make room; if a page grows, explain why.

## Measurement

Before and after, for `/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs`:

- document size, inline-script KB, script-tag count,
- the JS chunk list with per-chunk transfer size (from the built manifest or Lighthouse),
- Lighthouse mobile (throttled) score, TBT, LCP, total transfer,
- and a runtime check that no `MISSING_MESSAGE` appears in the console on either locale.

Measure with a cache-busting query string if Cloudflare serves `cf-cache-status: HIT`; purge
the zone only through the documented manual dashboard step, and say so in the report.

## Gates and delivery

- `npx tsc --noEmit`, `npx vitest run` (all files), `npx eslint` on changed files, `prettier --check`.
- Commit in small logical units, push, let CI deploy, then verify live.
- Report: what moved, exact before/after, any key that had to be duplicated to stay safe, any
  error you triggered on purpose, and the new residual bottleneck.
- Update the vault note `Team Memory/knowledge/2026-11-23-herbally-full-catalogue-scan.md`
  with a short performance section, or add a new dated note if you prefer — one INDEX line.
