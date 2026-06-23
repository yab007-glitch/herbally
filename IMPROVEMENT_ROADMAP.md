# HerbAlly Roadmap

**Last updated:** June 23, 2026

---

## Current State

- **Build:** Clean. 0 TS errors, 0 lint errors, 402 unit tests passing.
- **Coverage:** ~27% statements, ~19% branches. Thresholds removed from
  vitest.config.ts — they were set below actuals and served no purpose.
- **Safety guard:** Server-side. The chat route buffers the full AI response
  and runs it through `guardResponse()` before sending a single byte to the
  client. Client-side double-processing removed.
- **Security:** RLS on all tables. `00038_security_hardening.sql` fixed
  privilege escalation, IDOR, and search_path injection. No known open
  vulnerabilities.
- **i18n:** EN/FR parity (1,000 keys each), 0 English leaks on French pages.
- **Herb database:** 2,700+ herbs, mostly AI-generated monographs.
  Provenance defaults to `unverified`. No human reviewer has backfilled
  any significant number.

---

## Priority 1: Content Credibility (the actual product risk)

The database is the product. Right now it's 2,700 AI-generated monographs
with no human review. This is the biggest risk — not bugs, not performance.

- [ ] Get 50-100 highest-traffic herbs human-reviewed with real evidence
      grades (A/B/C/D) and source citations. Use `mark-herb-provenance.ts`.
- [ ] Surface evidence grade prominently on herb pages (above fold, not
      buried in tabs).
- [ ] Add "Last reviewed: [date] by [reviewer]" to every reviewed herb page.
- [ ] For unreviewed herbs, show a visible "AI-generated, not yet reviewed"
      notice instead of silently presenting AI content as authoritative.
- [ ] Long-term: decide whether to keep 2,700 unreviewed herbs or trim to
      a reviewed subset. 300 reviewed > 2,700 unreviewed.

## Priority 2: Test Coverage (honest improvement)

- [ ] Write tests for `src/lib/garden/monograph-priority.ts` (931 lines,
      untested — the herb prioritization logic is critical).
- [ ] Write tests for `src/lib/ai/context-fetcher.ts` (579 lines, has tests
      but coverage is shallow for the herb extraction logic).
- [ ] Write tests for `src/lib/actions/herbs.ts` (456 lines, the main DB
      query layer).
- [ ] Target: 40% statements / 30% branches by end of Q3 2026. Re-enable
      vitest thresholds at that point.

## Priority 3: Performance

- [ ] Run Lighthouse on production, record actual LCP/INP/CLS numbers.
      The roadmap has said "TBD" for two months.
- [ ] Run `npm run analyze` and identify bundle bloat.
- [ ] Optimize the 5,534-URL sitemap generation (could be slow).

## Priority 4: Growth (only after P1 is done)

- [ ] Symptom-first search ("I have anxiety" → herb recommendations).
- [ ] Symptom landing pages for SEO ("herbs for anxiety", etc.).
- [ ] User type toggle (consumer / practitioner) — pick ONE, build it well.
      Drop the "three audience tiers" plan — it's scope creep.

---

## What's Done (don't re-do these)

- ESLint/TypeScript: clean.
- Security hardening: `00038` shipped.
- i18n: EN/FR parity verified, 0 leaks.
- Safety guard: server-side, pre-stream, both locales.
- PWA: manifest fixed, service worker functional.
- E2E tests: 31 passing.
- AI response caching: guarded, RLS-protected.
- OpenRouter fallback chain: working with observability logging.

---

## Principles

1. Ship reviewed content before adding features.
2. Don't write audit documents — write code.
3. If coverage matters, write tests. If it doesn't, stop pretending.
4. One roadmap. One status doc. No audits of audits.

---

_This is the only roadmap. If it's stale, update it. Don't create a new one._