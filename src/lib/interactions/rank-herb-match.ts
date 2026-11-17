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
  const direct =
    exact.find((row) => row.slug === slug) ??
    exact.find((row) => !row.slug.includes("-")) ??
    exact[0] ??
    rows.find((row) => normalizeMatchText(row.name).startsWith(norm)) ??
    rows.find((row) =>
      row.frName ? normalizeMatchText(row.frName).startsWith(norm) : false
    ) ??
    rows.find((row) => row.slug === slug);
  if (direct) return direct;

  // Last tier: the row whose own names cover the most of what the reader
  // typed. An arbitrary `rows[0]` used to sit here, which is how any query
  // sharing a single word with the library could resolve to the wrong plant
  // and then answer "no interaction" for a pair that exists. Nothing covering
  // at least half the typed words is "we could not identify this herb", and
  // the caller reports that honestly instead of checking the wrong one.
  const queryTokens = norm.split(" ").filter(Boolean);
  if (queryTokens.length === 0) return undefined;
  const needed = Math.max(1, Math.ceil(queryTokens.length / 2));
  let best: T | undefined;
  let bestCovered = 0;
  let bestNameTokens = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const nameTokens = normalizeMatchText(
      `${row.name} ${row.scientific_name} ${row.frName ?? ""}`
    )
      .split(" ")
      .filter(Boolean);
    const covered = queryTokens.filter((token) =>
      nameTokens.some(
        (nameToken) =>
          nameToken.startsWith(token) || token.startsWith(nameToken)
      )
    ).length;
    // On a tie prefer the shorter display name: for "st johns wort extract"
    // both "St. John's Wort" and "St. Johns Wort Oil" cover three words, but
    // the second carries a word the reader never typed, and its row is a
    // different product with its own (empty) interaction set.
    const displayTokens = normalizeMatchText(row.name)
      .split(" ")
      .filter(Boolean).length;
    if (
      covered > bestCovered ||
      (covered === bestCovered && covered > 0 && displayTokens < bestNameTokens)
    ) {
      best = row;
      bestCovered = covered;
      bestNameTokens = displayTokens;
    }
  }
  return bestCovered >= needed ? best : undefined;
}
