# Indexability map

What every route type is allowed to do in search, why, and where the rule lives
in code. Change the code and this table together.

Last verified against production: **2026-11-02**, `sitemap.xml` = 5,870 URLs.

## Indexable

| Route                                                                        | Locales | In sitemap                                         | Canonical | Notes                                         |
| ---------------------------------------------------------------------------- | ------- | -------------------------------------------------- | --------- | --------------------------------------------- |
| `/`                                                                          | en, fr  | yes                                                | self      | 785 EN / 867 FR words of prose below the tool |
| `/herbs`                                                                     | en, fr  | yes                                                | self      | Directory + search                            |
| `/herbs/<slug>`                                                              | en, fr  | yes, FR only when `translations->fr` exists        | self      | ~1,700 words on a populated record            |
| `/symptoms`                                                                  | en, fr  | yes                                                | self      | Hub with 26 real `<a>` links                  |
| `/symptoms/<slug>`                                                           | en, fr  | **only when a published herb carries its keyword** | self      | See "Empty hubs" below                        |
| `/compare/turmeric/vs/ginger` and the `POPULAR_COMPARISONS` set              | en, fr  | yes                                                | self      |                                               |
| `/interactions/<herb>/<drug>`                                                | en, fr  | yes, FR only when `hasFr`                          | self      |                                               |
| `/herb-drug-interactions`                                                    | en, fr  | yes                                                | self      | Was reachable as `/interactions` — now a 301  |
| `/calculator`                                                                | en, fr  | yes                                                | self      |                                               |
| `/faq`, `/about`, `/methodology`                                             | en, fr  | yes                                                | self      |                                               |
| `/guides`                                                                    | en, fr  | yes                                                | self      | Index page only                               |
| Policy pages (disclaimer, privacy, editorial, sponsorship, contact, support) | en, fr  | yes                                                | self      |                                               |
| `/herbalist`                                                                 | en, fr  | yes                                                | self      | Landing content only                          |

## Noindex

| Route                                       | robots            | Reason                                                                                                                                                                                    |
| ------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/<slug>` (drafts)                   | `noindex, follow` | Written but not human-reviewed. Flips to indexable only after a real review — see `docs/review-priority.md` and the review system in migration `20261102_review_status`.                  |
| `/symptoms/<slug>` with zero matching herbs | `noindex, follow` | The body would be "No herbs found for this condition yet". Four hubs are in this state: `bloodPressure`, `hormonal`, `prostate`, `diabetes`. The tag lifts automatically when data lands. |
| `/garden`                                   | `noindex`         | Account-scoped, empty when signed out.                                                                                                                                                    |
| Any 404                                     | `noindex, follow` | Status is already 404; `follow` keeps the outbound links usable.                                                                                                                          |
| Preview / staging deployments               | Vercel auth wall  | Not public.                                                                                                                                                                               |

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
