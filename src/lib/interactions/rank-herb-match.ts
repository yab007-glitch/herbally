import {
  herbNameContentTokens,
  normalizeMatchText,
} from "@/lib/search/normalize-query";

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

  const queryTokens = norm.split(" ").filter(Boolean);
  if (queryTokens.length === 0) return undefined;

  const coverageOf = (row: T): number => {
    const nameTokens = normalizeMatchText(
      `${row.name} ${row.scientific_name} ${row.frName ?? ""}`
    )
      .split(" ")
      .filter(Boolean);
    return queryTokens.filter((token) =>
      nameTokens.some(
        (nameToken) =>
          nameToken.startsWith(token) || token.startsWith(nameToken)
      )
    ).length;
  };
  // On a tie prefer the shorter display name: for "st johns wort extract"
  // both "St. John's Wort" and "St. Johns Wort Oil" cover three words, but
  // the second carries a word the reader never typed, and its row is a
  // different product with its own (empty) interaction set.
  const displayTokens = (row: T): number =>
    normalizeMatchText(row.name).split(" ").filter(Boolean).length;

  const bestOf = (candidates: T[]): T => {
    let best = candidates[0];
    for (const row of candidates.slice(1)) {
      const covered = coverageOf(row);
      const bestCovered = coverageOf(best);
      if (
        covered > bestCovered ||
        (covered === bestCovered && displayTokens(row) < displayTokens(best))
      ) {
        best = row;
      }
    }
    return best;
  };

  // A qualified name ("ginkgo leaf", "aloe vera juice") equals no row's name,
  // and every genus row ties on the one word they share. Prefer the row whose
  // own name starts with the plant word the reader led with, then the row
  // covering the most typed words. On 2026-11-17 "ginkgo leaf" resolved to
  // Bai Guo (a seed entry with no interaction data) instead of Ginkgo Biloba,
  // so the checker answered "no interaction" for a pair it holds; "aloe vera
  // juice" resolved to Barbadian Aloe the same way.
  const head = herbNameContentTokens(term)[0];
  if (head && head.length >= 3) {
    const headMatches = rows.filter((row) =>
      [row.name, row.frName].some((candidate) =>
        normalizeMatchText(candidate || "").startsWith(head)
      )
    );
    if (headMatches.length > 0) return bestOf(headMatches);
  }

  // Last tier: the row whose own names cover the most of what the reader
  // typed. An arbitrary `rows[0]` used to sit here, which is how any query
  // sharing a single word with the library could resolve to the wrong plant
  // and then answer "no interaction" for a pair that exists. Nothing covering
  // at least half the typed words is "we could not identify this herb", and
  // the caller reports that honestly instead of checking the wrong one.
  const needed = Math.max(1, Math.ceil(queryTokens.length / 2));
  const best = bestOf(rows);
  return coverageOf(best) >= needed ? best : undefined;
}
