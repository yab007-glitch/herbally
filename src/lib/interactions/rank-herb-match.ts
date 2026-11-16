export interface HerbMatchCandidate {
  slug: string;
  name: string;
  scientific_name: string;
}

/** "Turmeric (Curcuma longa)" -> "turmeric-curcuma-longa" */
export function slugifyHerbTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pick the herb row a free-text query meant.
 *
 * Two published entries can share one display name — "Turmeric" is recorded
 * for both Curcuma longa (slug `turmeric`) and Curcuma xanthorrhiza (slug
 * `java-turmeric`) — and the database returns candidates in unspecified order.
 * Taking `rows[0]` therefore answered a question about common turmeric with
 * Java turmeric's interactions. When the query is the herb's own slug, that
 * row wins; otherwise the existing ranking is unchanged:
 *
 *   1. exact name or scientific-name match (slug tie-break)
 *   2. name prefix match
 *   3. first candidate
 */
export function rankHerbMatches<T extends HerbMatchCandidate>(
  rows: T[],
  term: string
): T | undefined {
  if (rows.length === 0) return undefined;
  const lower = term.trim().toLowerCase();
  const slug = slugifyHerbTerm(term);
  const exact = rows.filter(
    (row) =>
      row.name.toLowerCase() === lower ||
      row.scientific_name.toLowerCase() === lower
  );
  return (
    exact.find((row) => row.slug === slug) ??
    exact[0] ??
    rows.find((row) => row.name.toLowerCase().startsWith(lower)) ??
    rows.find((row) => row.slug === slug) ??
    rows[0]
  );
}
