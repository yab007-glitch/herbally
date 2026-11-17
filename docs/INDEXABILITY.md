# Indexability map

What every route type is allowed to do in search, why, and where the rule lives
in code. Change the code and this table together.

Last verified against production: **2026-11-16**, `sitemap.xml` = 3,052 URLs
(1,239 herb pages in each locale, plus 574 non-herb URLs of which 442 are
`/interactions/<herb>/<drug>` pages). The herb count only moves when a herb gains
a source; the interaction count moves with the interaction table, so expect the
total to drift without any change to this file.

## Indexable

| Route                                                                          | Locales | In sitemap                                         | Canonical | Notes                                         |
| ------------------------------------------------------------------------------ | ------- | -------------------------------------------------- | --------- | --------------------------------------------- |
| `/`                                                                            | en, fr  | yes                                                | self      | 785 EN / 867 FR words of prose below the tool |
| `/herbs`                                                                       | en, fr  | yes                                                | self      | Directory + search                            |
| `/herbs/<slug>`                                                                | en, fr  | **only when the entry has a source** — see below   | self      | FR only when `translations->fr` exists        |
| `/symptoms`                                                                    | en, fr  | yes                                                | self      | Hub with 26 real `<a>` links                  |
| `/symptoms/<slug>`                                                             | en, fr  | **only when a published herb carries its keyword** | self      | See "Empty hubs" below                        |
| `/compare/turmeric/vs/ginger` and the `POPULAR_COMPARISONS` set                | en, fr  | yes                                                | self      |                                               |
| `/interactions/<herb>/<drug>`                                                  | en, fr  | yes, FR only when `hasFr`                          | self      |                                               |
| `/herb-drug-interactions`                                                      | en, fr  | yes                                                | self      | Was reachable as `/interactions` — now a 301  |
| `/calculator`                                                                  | en, fr  | yes                                                | self      |                                               |
| `/faq`, `/about`, `/methodology`                                               | en, fr  | yes                                                | self      |                                               |
| `/guides`                                                                      | en, fr  | yes                                                | self      | Index page only                               |
| Policy pages (disclaimer, privacy, terms, editorial-policy, sponsors, contact) | en, fr  | yes                                                | self      | AdSense checks these; all return 200          |     |
| `/herbalist`                                                                   | en, fr  | yes                                                | self      | Landing content only                          |

## Noindex

| Route                                       | robots            | Reason                                                                                                                                                                                    |
| ------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/<slug>` (drafts)                   | `noindex, follow` | Written but not human-reviewed. Flips to indexable only after a real review — see `docs/review-priority.md` and the review system in migration `20261102_review_status`.                  |
| `/symptoms/<slug>` with zero matching herbs | `noindex, follow` | The body would be "No herbs found for this condition yet". Four hubs are in this state: `bloodPressure`, `hormonal`, `prostate`, `diabetes`. The tag lifts automatically when data lands. |
| `/garden`                                   | `noindex`         | Account-scoped, empty when signed out.                                                                                                                                                    |
| Any 404                                     | `noindex, follow` | Status is already 404; `follow` keeps the outbound links usable.                                                                                                                          |
| Preview / staging deployments               | Vercel auth wall  | Not public.                                                                                                                                                                               |

## Herb pages: the page may be indexable without being advertised

Since 2026-11-16 the sitemap lists a herb only if the entry carries a
`herb_regulatory_evidence` record, an imported regulator monograph in
`herb_monograph_sources`, or a published hand-written monograph. A
PubMed-compiled information sheet does not qualify: it is derived from
abstracts, and counting it had let 97% of the library back into the sitemap
(3,155 of 3,238 pages), against Google's own verdict of 4,249 URLs "crawled,
currently not indexed".

That leaves **1,999 of the 3,238 published herbs in the sitemap's blind spot but
still `index,follow` on the page itself** (2,011 before the EMA monographs were
imported on 2026-11-16). That is a decision, not an oversight:

- The page is judged by its own content. Those entries render a compiled sheet
  averaging ~3,200 characters with a PMID on every claim, which is real content
  and clears `isIndexable()`; telling Google not to index them would remove
  1,999 pages that answer a long-tail query nobody else covers.
- The sitemap is an advertisement, and advertising text the site cannot source
  from a regulator is what produced the 4,249-page unindexed bucket. The page
  does not promise anything; it just doesn't get pushed.
- If a hand-written monograph or regulator record ever lands for one of those
  slugs, the next sitemap build picks it up with no code change.

`src/app/sitemap.ts` therefore loads the same sourced set the page uses and
filters on it; the page keeps using `isIndexable()` alone. Being stricter in
the sitemap than on the page is safe in one direction only — a page may be
indexable without being advertised, but a `noindex` page must never be listed.

## Deliberately absent from the sitemap

`/admin/*`, `/api/*`, `/profile/*`, sign-in-dependent tool states, and search
result URLs (`/herbs?q=…`) — none of them serve unique crawlable content.

## Why the empty-hub rule exists

`symptom_keywords` is a `text[]` on `herbs`. A hub is listed only if some
published herb's array contains its `dbKeyword`, computed inside the sitemap's
existing herb query loop — no extra round-trip. Search Console carries 2,711
pages under "Crawled – currently not indexed"; an indexable page whose entire
body is an empty state is the most common cause of that bucket, so it is the
cheapest thing to remove from it.

If the herb query fails, the sitemap **fails open** and lists every hub: losing
52 live URLs because Supabase timed out is worse than listing a thin one.

## Related

- `docs/GOOGLE_INDEXING.md` — Search Console / Bing / IndexNow setup
- `docs/seo-performance-baseline.md` — Lighthouse numbers
- `docs/review-priority.md` — Tier 1/2/3 review queue
