# Task brief — compounding growth programme (2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`.
Standing rules from `docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md` apply in full:
zero new spend, no invented facts, no deleting content to clear a metric.

## Read this before planning anything

There is **no code change that makes traffic grow exponentially**. Traffic is demand ×
distribution × trust, and today's baseline is roughly **1,200 visits and 1,490 page views per
month**, with AdSense calling the site low-value. Anyone promising a multiplier from a build is
guessing.

What the build can do is (a) make pages worth ranking, (b) make them discoverable, and (c) create
surfaces other people can link to or embed. That compounds slowly and honestly. The brief below
is therefore about **removing the reasons the site does not grow**, not about manufacturing a
number.

**Do not** attempt any of the following, under any framing:

- doorway or near-duplicate pages generated at scale,
- auto-written medical prose, AI "expert" reviews, or invented author credentials,
- fake ratings, fake testimonials, fake "as seen in" badges,
- cloaking, link schemes, paid links, PBNs, or bought traffic,
- unsolicited mass outreach, comment spam, or Reddit/Quora drive-bys,
- misleading health claims or clickbait titles that the page does not answer.

If a tactic only works because a search engine has not noticed it yet, it is not allowed.

## Phase 1 — demand before building (evidence, not vibes)

1. Build a **demand map** from free signals only:
   - Google autocomplete / "people also ask" style suggestions for `<herb>`, `<herb> benefits`,
     `<herb> side effects`, `<herb> interaction`, `<herb> vs <herb>`,
   - Wikipedia pageviews API for the top herbs (free, no key),
   - the site's own `herb_view_counts` and Cloudflare Web Analytics top pages,
   - existing Search Console exports if the owner has placed any in the repo (do not invent them).
2. Rank the top **200 herbs by demand**, and for each record which query intent exists
   (benefit, safety, dose, interaction, comparison, "is it safe while pregnant").
3. Write `artifacts/growth/demand-map.csv` and a short summary of what the catalogue cannot yet
   answer well.

## Phase 2 — make the top pages worth ranking

Only using data already in the database, and only where the source exists:

- Ensure the top 200 pages have, in this order: a direct answer in the first screen, safety,
  interactions, evidence with citations, and internal links to related herbs and conditions.
- Where a page lacks the source for a section, **do not write it**. Instead surface an honest
  "no indexed clinical literature for this use" state, which is itself useful and trustworthy.
- Fix anything that makes a page feel thin: a 2-line description on a high-demand herb is the
  priority over a perfect page nobody searches for.

## Phase 3 — build distribution surfaces (the actual growth lever)

Ship shareable, link-worthy things that cost nothing to run:

1. **Embeddable interaction checker** (`/embed/checker` exists — make it genuinely embeddable):
   a one-line snippet, a clean frame, no ads inside the embed, and an attribution link back.
   This is the most plausible organic backlink source the site has.
2. **Shareable result pages**: a user's interaction/safety result should have a stable URL,
   sensible OG image, and a "copy link" action. No personal data in the URL.
3. **NPN checker as a public tool** with a clear canonical page and structured data.
4. **Printable clinician summary** (PDF/print CSS) for a herb or interaction set — genuinely
   useful, and the kind of thing clinics link to.
5. **Open data surface**: a rate-limited, read-only JSON endpoint of herb safety fields with a
   documented licence and attribution requirement. Free, cacheable, and it invites reuse.
6. **Feeds**: RSS/JSON for "recently updated herbs" and guides, so aggregators can pick the site up.

For each: implement, add tests, and record the exact URL someone would link to.

## Phase 4 — measurement that does not lie

Define and record leading indicators, not pageviews:

- pages indexed vs submitted (Search Console — the owner must supply numbers; do not fabricate),
- pages with ≥3 citations and ≥1 interaction,
- internal link depth: clicks from home to a herb page (should be ≤3),
- tool usage from server logs (embed loads, checker runs, PDF prints),
- referring domains (owner-supplied; no paid tools),
- Core Web Vitals pass rate.

Write `artifacts/growth/baseline.md` with the numbers that are actually obtainable, and mark the
rest "owner-supplied, not available to the agent".

## Deliverables

1. `artifacts/growth/demand-map.csv` + a 1-page summary of the top 20 opportunities.
2. A prioritised build list with expected effect and effort, **all zero cost**.
3. The first tranche implemented (Phase 3 items 1–2 at minimum, plus any Phase 2 fix for the
   top-demand pages), with tests, commits, deploy and live verification.
4. A dated Team Memory note plus one INDEX line.
5. An honest closing statement: what this work can move and over what horizon, and what it
   cannot — no traffic guarantees.

## Guardrails

- Do not touch ads, consent, robots policy, the review line, or the index-all decision.
- Do not add third-party scripts or services that could bill later.
- Back up the DB before data writes; `tsc`, full tests, `eslint`, `prettier --check` before each
  commit; small commits; push; verify live.
- If a phase needs a decision only the owner can make (e.g. a new public API surface), implement
  the safe part and report the decision rather than shipping something irreversible.
