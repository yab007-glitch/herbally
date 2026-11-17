/**
 * Which herb pages are worth submitting to Google.
 *
 * Measured across the 3,238 published herbs on 2026-11-07: median 277 characters
 * of substance (description + recorded uses + dosage; a published monograph
 * counts 400, a regulator record 300), 1,340 at or above 400 and 1,898 below it.
 * Google reached the same verdict twice — 2,711 pages "crawled, currently not
 * indexed" and an AdSense refusal for "low-value content".
 *
 * A PubMed-compiled information sheet still counts for the page's own robots
 * decision. Those sheets are built from real abstracts with a PMID on every
 * claim, average ~3,200 characters, and are what the page renders for the
 * 2,500 herbs that have no hand-written monograph — counting them (2026-11-08)
 * lifted the indexable set from 1,347 to ~2,594. Since 2026-11-16 they no
 * longer count for the sitemap (see below): the page may be judged on its own
 * merit, but the site no longer advertises what it cannot source.
 *
 * **Views do not exempt a page any more.** Until 2026-11-07 a page with 78 views
 * was submitted regardless of substance, on the theory that an entry people
 * opened had earned its place. The counter is polluted: of those 1,898 thin
 * pages the median is 54 views and the p90 is 100, and the highest — cay-xao-tam-phan
 * at 1,638 — is a known crawler artefact. The exemption was therefore holding 426
 * thin pages in the index on bot traffic, including several Google had already
 * refused. Interest is measured in Search Console, not by this counter.
 *
 * **A compiled sheet is not a source (2026-11-16).** Counting PubMed-derived
 * sheets as monographs lifted the advertised set to ~2,594, and in production it
 * let 97% of the library through — 3,155 of 3,238 published herbs. Google knew
 * 9,007 URLs, kept 2,373, and left 4,249 in "crawled, currently not indexed".
 * Length was standing in for depth. The sitemap now requires a record we can
 * point at: a regulator record, an imported regulator monograph, or a
 * hand-written one. A sheet still renders and still supports the page's own
 * content claim; it no longer buys a place in the sitemap.
 *
 * The page still decides robots from this same function, so a thin page never
 * claims to be indexable. Being stricter in the sitemap than on the page is
 * deliberate and safe: a page may be indexable without being advertised, but a
 * noindex page must never be listed.
 */

/** Characters of substance below which a page is not submitted. */
export const SUBSTANCE_MIN = 400;

export interface IndexableInput {
  description?: string | null;
  traditional_uses?: string[] | null;
  dosage_adult?: string | null;
  /**
   * A published monograph, or regulator monograph text imported into
   * `herb_monograph_sources`. A PubMed-compiled sheet does **not** count here:
   * it is derived, not sourced, and counting it is what let 97% of the library
   * back into the sitemap.
   */
  hasMonograph?: boolean;
  /** A regulator record counts, for the same reason. */
  hasRegulatory?: boolean;
}

/** Substance, not word count: uses are sentences, a dosage is a paragraph. */
export function substanceOf(herb: IndexableInput): number {
  const uses = (herb.traditional_uses ?? []).reduce(
    (sum, use) => sum + (use?.length ?? 0),
    0
  );
  return (
    (herb.description?.length ?? 0) +
    uses +
    (herb.dosage_adult?.length ?? 0) +
    (herb.hasMonograph ? 400 : 0) +
    (herb.hasRegulatory ? 300 : 0)
  );
}

export function isIndexable(herb: IndexableInput): boolean {
  return substanceOf(herb) >= SUBSTANCE_MIN;
}
