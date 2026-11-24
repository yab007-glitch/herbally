# Task brief — competitive analysis, evidence-based (2026-11-24)

Repo `/Users/yasser/herbally`. Standing rules apply: **zero new spend** (no Ahrefs, SEMrush,
Similarweb paid, no paid datasets), **no invented facts**, no copying proprietary text.

## Why

HerbAlly has 3,124 monographs, an interaction checker, an NPN lookup and symptom hubs, and still
gets ~1,200 visits a month. Breadth is not differentiation. Before building anything else, find
out precisely what the competition does, where it is weak, and which gap HerbAlly can own.

"Better than all of them" is not a real target. **Be the only sensible choice for one job** is.

## Competitor set (visit each, record what you actually see)

Direct interaction/safety tools:

1. Drugs.com interaction checker
2. WebMD interaction checker
3. Medscape interaction checker
4. Natural Medicines (TRC) — record paywall boundary
5. Examine.com — record paywall boundary
6. Memorial Sloan Kettering "About Herbs"
7. NCCIH herb pages
8. MedlinePlus herbal medicine pages

Reference/monograph sites:

9. RxList / WebMD vitamins & supplements
10. Healthline herbal supplements
11. Verywell Health herbs
12. HerbMed / HerbMedPro (if still reachable)
13. Health Canada LNHPD / NHPID public search
14. EMA HMPC monograph list
15. A Canadian-facing competitor: Jean Coutu / Familiprix natural health pages, or a Quebec
    herbalist reference — record whichever actually publishes herb safety content.

For each: is it free, partially paywalled, or paid? Is it US-only or does it carry Canadian
regulatory data? Does it cite sources per claim? Does it cover French?

## Method (free sources only)

- Visit the public pages with a browser; capture the URL, the date, and a screenshot path under
  `artifacts/competitive/<slug>.png` where a visual claim matters.
- For paywalled products, record **only what is publicly visible** and mark the rest
  "unverified — paywall". Do not scrape behind a login.
- Use public artefacts for scale where available: sitemap URL counts, published page counts,
  public "last reviewed" dates, Tranco rank if the domain appears in the free list.
- Do **not** use paid traffic estimates; if you quote a third-party estimate, mark it as
  third-party and dated.
- Copy no text into the repo beyond a short quote (≤25 words) with attribution and URL.

## Analysis dimensions

For every competitor, record:

- herb/supplement breadth and how deep each entry goes,
- whether claims carry citations, and what kind,
- interaction coverage: how a user enters data, what it returns, whether it handles
  supplements at all,
- pregnancy/lactation and pediatric guidance,
- regulatory data (Health Canada NPN/NHPID, EMA, FDA),
- French language support and quality,
- trust signals: named authors, reviewer credentials, editorial policy, update dates,
- monetisation and its effect on the page (ad density, interstitials, upsells),
- speed and mobile usability (rough, public measurement only).

## What to produce

1. `artifacts/competitive/matrix.csv` — one row per competitor, one column per dimension, with a
   short evidence note and URL in the final column.
2. `artifacts/competitive/analysis.md` — the narrative: what each does best, where each is weak,
   and the three weaknesses that recur across the market.
3. **Three differentiator proposals**, ranked by (visitor impact × feasibility under the
   constraints). For each:
   - the job it does and for whom,
   - why the incumbents cannot or will not do it (regulatory data they lack, business model that
     prevents it, language they do not serve, editorial stance they cannot take),
   - what HerbAlly already has that makes it cheap to build,
   - the data or feature work required, with an explicit statement that it needs **no new
     medical claims and no paid service**,
   - how a visitor would find it (search intent or a shareable surface), because a feature nobody
     searches for does not bring visitors.
4. A one-page recommendation: the single wedge to build next, and what to explicitly stop doing.

## Rules on claims

- No "we are the best" assertions without the matrix cell that proves it.
- No competitor traffic number unless it is public and dated; otherwise say "unknown".
- No recommendations that require inventing content, buying links, or scraping paywalled data.
- If a competitor is clearly stronger on a dimension, say so plainly — the point is to find the
  gap, not to flatter the site.

## Delivery

- Commit the artifacts and the report; no product code changes in this pass.
- Write a dated Team Memory note and one INDEX line.
- Keep the report short enough to read in ten minutes; put the detail in the CSV.
