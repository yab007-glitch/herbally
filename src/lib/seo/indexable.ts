/**
 * Which herb pages are worth submitting to Google.
 *
 * Measured across the 3,238 published herbs on 2026-11-07: median 322 characters
 * of substance (description + recorded uses + dosage), 1,868 pages under 400, and
 * only 259 a reader would call substantial. Google reached the same verdict twice —
 * 2,711 pages "crawled, currently not indexed" and an AdSense refusal for
 * "low-value content".
 *
 * The rule lives here so the page (which decides robots) and the sitemap (which
 * decides what is offered for crawling) cannot drift apart: a page that renders
 * noindex must not be listed in the sitemap, and vice versa.
 */

/** Characters of substance below which a page is not submitted. */
export const SUBSTANCE_MIN = 400;

/**
 * Views that exempt a thin page. An entry people actually open is earning its
 * place; noindexing it would throw away the only traffic it has.
 */
export const VIEWS_MIN = 78;

export interface IndexableInput {
  description?: string | null;
  traditional_uses?: string[] | null;
  dosage_adult?: string | null;
  /** A published monograph counts: sourced detail even when the prose is short. */
  hasMonograph?: boolean;
  /** A regulator record counts, for the same reason. */
  hasRegulatory?: boolean;
  views?: number | null;
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
  return substanceOf(herb) >= SUBSTANCE_MIN || (herb.views ?? 0) >= VIEWS_MIN;
}
