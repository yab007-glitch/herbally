# HerbAlly Status

**Last updated:** September 26, 2026

---

## Build & Tests

| Check            | Status                                                          |
| ---------------- | --------------------------------------------------------------- |
| TypeScript       | ✅ 0 errors                                                     |
| ESLint           | ✅ 0 errors, 0 warnings                                         |
| Unit tests       | ✅ 460 passing (55 files)                                       |
| E2E tests        | ⚠️ 81 passed / 6 failed (WebKit-only) / 9 skipped; chromium+firefox green except 2 timeout flakes |
| Coverage         | ~25% statements, ~18% branches (thresholds still removed)       |
| Production build | ✅ 464 pages prerendered                                        |

### ⚠️ The build output marks EVERY route `ƒ (Dynamic)`

`node_modules/next/dist/docs`: `headers()` is a Request-time API that "will opt
a route into dynamic rendering." `src/app/layout.tsx` calls
`getLocaleFromRequest()` → `headers()` on every render, and the proxy sets
`x-locale` for all paths — so static/ISR `revalidate` config in individual
pages has no effect in production. Verified live: every route returns
`cache-control: private, no-cache, no-store` + `x-vercel-cache: MISS`, including
for Googlebot. `_next/static/*` assets cache normally (HIT, immutable), so this
is page rendering only. Fixing it means moving the locale read out of the root
layout (or reading it per-page where a static shell is acceptable).

## Security

| Check            | Status                                                  |
| ---------------- | ------------------------------------------------------- |
| RLS              | ✅ All tables                                           |
| Security headers | ✅ All 6 present (verified on production)               |
| npm audit        | ✅ 0 vulnerabilities (prod and dev)                     |
| Secrets          | ✅ `detect-secrets.sh --all` clean                      |
| CSP              | ⚠️ Blocks the Next.js dev blob-worker; `worker-src` not set |

## i18n

| Check             | Status                                  |
| ----------------- | --------------------------------------- |
| EN/FR key parity  | ✅ 1,211/1,211 keys, 0 missing either way |
| `<html lang>`     | ✅ Correct per locale                    |

## AI Safety

| Check                          | Status                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Server-side guard (pre-stream) | ✅ Response buffered, guarded before send                                                         |
| Hard blocks (EN/FR)            | ✅ 30+ patterns (cessation, cure claims, doctor dismissal, emergency misdirection, unsafe dosing) |
| Soft warns (EN/FR)             | ✅ Diagnostic language, guarantee claims, authority overreach                                     |
| Adversarial normalization      | ✅ NFKD + leet-speak + zero-width char removal                                                    |

## Content (the real problem)

| Check                    | Status                              |
| ------------------------ | ----------------------------------- |
| Herb count               | 2,699                               |
| Human-reviewed herbs     | **0** — every `verified_by` value is `auto-verification-script` |
| Provenance split         | 1,146 `ai_summarized` / 1,042 `unverified` / 511 `primary_source` |
| Green "Verified" badge   | ⚠️ Shown on those 511 auto-verified herbs |
| Evidence grades on pages | Partly (A/B/C/trad values in DB)    |

## SEO

| Check           | Status                          |
| --------------- | ------------------------------- |
| Sitemap URLs    | 5,793 (EN + FR)                 |
| robots.txt      | ✅                              |
| Structured data | ⚠️ JSON-LD was missing on 14 FR pages (fixed 2026-09-26) |

## Performance

| Metric | Status       |
| ------ | ------------ |
| LCP    | Not measured |
| INP    | Not measured |
| CLS    | Not measured |

Still true. Page caching (above) matters more than any of these three right now.

---

## What Changed (September 26, 2026)

1. **Fixed the FR hydration error** (HERBALLY-5, 88 events, ongoing). Two causes:
   `FirstVisitBanner` read `sessionStorage` inside a `useState` initializer, and
   `useDetectedLocale` computed a value inside `useMemo` — both run during the
   client's hydration render while the server renders the "empty" branch. Both
   now read through `useSyncExternalStore` with a deterministic server snapshot.
   Verified: `/`, `/fr`, `/herbs`, `/herbalist`, `/calculator` all free of React
   #418; the banner still appears for its real trigger case (English browser on
   a French page) and dismiss persists across reload.
2. **Fixed the `.join is not a function` crash** (HERBALLY-9 / -A / -7) two ways:
   repaired 21 malformed `translations.fr` entries across 14 herbs (bare strings
   where arrays are expected), and added coercion at the boundary
   (`localize-herb.ts`, `herb-schema.tsx`, `system-prompt.ts`) so bad jsonb can
   never crash a render again. Those 14 French pages were silently shipping
   without their JSON-LD block. Backup: `backups/fr-translations-2026-09-26.json`.
3. **Added regression tests** for both bug classes (8 new tests, 452 → 460).
4. **Audited the whole stack** — see the audit findings in this session's report.

## Next Action

Get 50-100 high-traffic herbs genuinely human-reviewed. The green "Verified"
badge currently appears on 511 herbs that no human has reviewed — that is a
correctness problem, not a polish item.

---

_This is the only status document. Update it when things change._
