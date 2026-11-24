# Standing brief — zero-cost upgrade rounds (from 2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`.

This brief governs an open-ended series of improvement rounds. Read it at the start of every
round, plus the latest round log in `artifacts/upgrade-rounds/`.

## The cost rule (binding)

**Zero new spend.** A round may only use what already exists:

- the self-hosted server and its own Postgres,
- Cloudflare free plan features already enabled,
- GitHub free CI/minutes already configured,
- the existing model/credentials already in use for this work,
- open data that is free to use (PubMed E-utilities, Health Canada open data, Wikimedia
  Commons with correct attribution).

A round must **stop and report** rather than proceed if the work needs:

- a paid API, paid data source, paid SaaS, or a plan upgrade,
- a new domain, certificate purchase, or paid CDN feature,
- paid advertising, paid backlinks, paid reviews, or paid traffic,
- a new third-party dependency that adds recurring cost.

Time spent is not spend. Model quota already paid for is not spend. Anything that would put a
line on a bill is spend.

## Per-round rules (unchanged and non-negotiable)

- **No invented facts.** No doses, interactions, contraindications, citations, reviewer names,
  verification methods, or herb names without a source already in the database.
- Keep the index-all policy, the generic "Reviewed and verified" line, `reviewedBy` as an
  Organization, and the ad/consent setup exactly as they are.
- Never fix an issue by deleting a page or emptying a field unless the row is genuinely
  duplicate/orphan and the deletion is recorded.
- Back up the DB before any data write.
- `npx tsc --noEmit`, full `npx vitest run`, `npx eslint` on changed files and
  `prettier --check` must pass before each commit. Small commits, push, CI deploys.
- Verify the change **live** after deploy, with a cache-busting query string if the edge serves
  a stale copy. If you purge Cloudflare, it is the manual dashboard step only.
- If a round changes nothing measurable, say so plainly instead of manufacturing activity.

## Choosing the round's work

Pick the highest-value item that is **zero-cost, determinate, and verifiable**, in roughly this
order. Skip an item that needs a human decision and note it in the round log.

1. **Correctness bugs** — anything returning the wrong thing: broken links, wrong counts,
   invalid schema, a page that 500s, a form that fails, a locale that leaks English chrome.
2. **Performance within the existing budgets** — hit the payload budget, the LCP target, the
   font and image weight, without a redesign. The known floor is the Next/React runtime
   (~218 KB br); do not chase it.
3. **Accessibility** — drive automated axe violations to zero on the main templates, then fix
   keyboard and focus issues those tools miss.
4. **SEO hygiene that needs no new content** — internal linking, breadcrumbs, related-herb
   rails, canonical/hreflang correctness, sitemap hygiene, structured-data completeness.
5. **Reliability** — error budget, health checks, cache headers, graceful 404/500 pages,
   timeout behaviour on slow queries.
6. **Product usefulness with no new service** — the interaction checker, NPN checker, symptom
   hub and garden flows: make what exists work better. No new vendors.
7. **AdSense readiness without ads changes** — editorial transparency, methodology pages,
   original-value surfaces, navigation depth. Do not add ad units, do not buy traffic.

## Round output

Each round writes `artifacts/upgrade-rounds/round-<n>.md` with:

- what was chosen and why (one line),
- what was measured before and after (numbers, not adjectives),
- commits,
- live verification,
- what was skipped because it needs money or a human decision,
- the single highest-value item for the next round.

Also append one line to the vault note for the round and keep `INDEX.md` current.

## Stop conditions

Stop the series and report when **any** of these is true:

- the next item on the list needs spend,
- the next item needs a medical-content or policy decision from the owner,
- a round would be cosmetic churn with no measurable delta,
- the last two rounds produced no change in the metrics they targeted.

Say "no further zero-cost work with a measurable outcome" plainly. Do not keep going to look busy.
