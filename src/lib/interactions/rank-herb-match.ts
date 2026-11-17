import { normalizeMatchText } from "@/lib/search/normalize-query";

export interface HerbMatchCandidate {
  slug: string;
  name: string;
  scientific_name: string;
  frName?: string | null;
}

/** "Turmeric (Curcuma longa)" -> "turmeric-curcuma-longa" */
export function slugifyHerbTerm(term: string): string {
  return normalizeMatchText(term)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pick the herb row a free-text query meant.
 *
 * Checks English display name, Latin binomial, and French translated name
 * (with diacritics folded) so "Curcuma" resolves to turmeric (`Curcuma longa`,
 * frName "Curcuma") rather than `curcuma-aromatica`, and "Millepertuis"
 * resolves cleanly to `st-johns-wort`.
 */
export function rankHerbMatches<T extends HerbMatchCandidate>(
  rows: T[],
  term: string
): T | undefined {
  if (rows.length === 0) return undefined;
  const norm = normalizeMatchText(term);
  const slug = slugifyHerbTerm(term);
  const exact = rows.filter(
    (row) =>
      normalizeMatchText(row.name) === norm ||
      normalizeMatchText(row.scientific_name) === norm ||
      (row.frName ? normalizeMatchText(row.frName) === norm : false)
  );
  return (
    exact.find((row) => row.slug === slug) ??
    exact.find((row) => !row.slug.includes("-")) ??
    exact[0] ??
    rows.find((row) => normalizeMatchText(row.name).startsWith(norm)) ??
    rows.find((row) =>
      row.frName ? normalizeMatchText(row.frName).startsWith(norm) : false
    ) ??
    rows.find((row) => row.slug === slug) ??
    rows[0]
  );
}
