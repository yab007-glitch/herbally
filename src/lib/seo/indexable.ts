/**
 * Which herb pages are worth submitting to Google.
 *
 * Measured across the 3,238 published herbs on 2026-11-07: median 277 characters
 * of substance (description + recorded uses + dosage; a published monograph
 * counts 400, a regulator record 300), 1,340 at or above 400 and 1,898 below it.
 * Google reached the same verdict twice — 2,711 pages "crawled, currently not
 * indexed" and an AdSense refusal for "low-value content".
 *
 * **Views do not exempt a page any more.** Until 2026-11-07 a page with 78 views
 * was submitted regardless of substance, on the theory that an entry people
 * opened had earned its place. The counter is polluted: of those 1,898 thin
 * pages the median is 54 views and the p90 is 100, and the highest — cay-xao-tam-phan
 * at 1,638 — is a known crawler artefact. The exemption was therefore holding 426
 * thin pages in the index on bot traffic, including several Google had already
 * refused. Interest is measured in Search Console, not by this counter.
 *
 * The rule lives here so the page (which decides robots) and the sitemap (which
 * decides what is offered for crawling) cannot drift apart: a page that renders
 * noindex must not be listed in the sitemap, and vice versa.
 */

/** Characters of substance below which a page is not submitted. */
export const SUBSTANCE_MIN = 400;

export interface IndexableInput {
  description?: string | null;
  traditional_uses?: string[] | null;
  dosage_adult?: string | null;
  /** A published monograph counts: sourced detail even when the prose is short. */
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
