# HerbAlly Status

**Last updated:** June 23, 2026

---

## Build & Tests

| Check            | Status                                                          |
| ---------------- | --------------------------------------------------------------- |
| TypeScript       | ✅ 0 errors                                                     |
| ESLint           | ✅ 0 errors, 0 warnings                                         |
| Prettier         | ✅ All conform                                                  |
| Unit tests       | ✅ 402 passing                                                  |
| E2E tests        | ✅ 31 passing, 3 skipped (AI-dependent)                         |
| Coverage         | ~27% statements, ~19% branches (thresholds removed — were fake) |
| Production build | ✅ 275 static pages                                             |

## Security

| Check            | Status                                                  |
| ---------------- | ------------------------------------------------------- |
| RLS              | ✅ All tables                                           |
| Security headers | ✅ All 6 present                                        |
| Known vulns      | None open. `00038` fixed escalation, IDOR, search_path. |

## i18n

| Check             | Status                         |
| ----------------- | ------------------------------ |
| EN/FR key parity  | ✅ 1,000/1,000                 |
| French page leaks | ✅ 0 found (12/12 pages clean) |
| `<html lang>`     | ✅ Correct per locale          |

## AI Safety

| Check                          | Status                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Server-side guard (pre-stream) | ✅ Response buffered, guarded before send                                                         |
| Hard blocks (EN/FR)            | ✅ 30+ patterns (cessation, cure claims, doctor dismissal, emergency misdirection, unsafe dosing) |
| Soft warns (EN/FR)             | ✅ Diagnostic language, guarantee claims, authority overreach                                     |
| Adversarial normalization      | ✅ NFKD + leet-speak + zero-width char removal                                                    |
| Client-side double-guard       | ❌ Removed (was double-processing)                                                                |

## Content (the real problem)

| Check                    | Status                              |
| ------------------------ | ----------------------------------- |
| Herb count               | 2,700+                              |
| Human-reviewed herbs     | ~0                                  |
| Provenance system        | ✅ Exists, defaults to `unverified` |
| Evidence grades on pages | ❌ Not implemented                  |
| "AI-generated" notice    | ❌ Not shown to users               |

## SEO

| Check           | Status                          |
| --------------- | ------------------------------- |
| Sitemap URLs    | 5,534 (EN + FR)                 |
| robots.txt      | ✅                              |
| Structured data | ✅ MedicalWebPage, Organization |

## Performance

| Metric | Status       |
| ------ | ------------ |
| LCP    | Not measured |
| INP    | Not measured |
| CLS    | Not measured |

Performance has been "TBD" for two months. Needs a real Lighthouse run.

---

## What Changed Today (June 23, 2026)

1. **Deleted 9 meta-documents** — 8 redundant audit reports + OWNERSHIP_TAKEOVER.md.
   The project was spending more energy auditing itself than shipping.
2. **Removed fake coverage thresholds** — vitest.config.ts had thresholds set
   below actual coverage so CI always passed. Removed until coverage is real.
3. **Removed client-side safety guard double-processing** — server already
   guards the full response pre-stream. Client was re-running the guard,
   which could double-append warning disclaimers.
4. **Rewrote roadmap and status** — replaced stale aspirational docs with
   current reality.

## Next Action

Get 50-100 high-traffic herbs human-reviewed. Everything else is secondary.

---

_This is the only status document. Update it when things change._
