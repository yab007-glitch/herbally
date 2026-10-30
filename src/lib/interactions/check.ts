import { drugSlug } from "./pair-url";

/**
 * Matching for the homepage interaction checker.
 *
 * The checker takes free text ("blood thinners like warfarin", "SSRI
 * antidepressants"), while the curated database stores one generic/class
 * name per pair ("Warfarin (Coumadin)", "Antidepressants (SSRIs)").
 * Matching is deliberately conservative: an exact generic-name match
 * wins, then a whole-token match, then a containment match on the
 * slugified input. Anything else is "no record" — never a guess, and
 * never presented as a database result.
 */

export interface CheckablePair {
  drugName: string;
  drugSlug: string;
}

/** Slugify a free-text medication input the same way pair URLs do. */
export function drugInputSlug(input: string): string {
  return drugSlug(input);
}

/** Whole-word tokens of a free-text input, slugified individually. */
function inputTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function matchInteractionPair<T extends CheckablePair>(
  drugInput: string,
  pairs: T[]
): T | null {
  const slug = drugInputSlug(drugInput);
  if (!slug || pairs.length === 0) return null;

  // 1. Exact generic-name match: "warfarin" -> "Warfarin (Coumadin)".
  for (const pair of pairs) {
    if (pair.drugSlug === slug) return pair;
  }

  // 2. Whole-token match: "blood thinners like warfarin" contains
  // "warfarin"; "SSRI antidepressants" contains "antidepressants".
  // Singular/plural forms compare equal ("antidepressant" matches
  // "antidepressants") — but a short fragment never does ("asp" must
  // not match "aspirin").
  const singular = (s: string) =>
    s.length > 4 && s.endsWith("s") ? s.slice(0, -1) : s;
  const tokens = new Set(inputTokens(drugInput).map(singular));
  for (const pair of pairs) {
    if (tokens.has(singular(pair.drugSlug))) return pair;
  }

  // 3. Containment in one direction only: the slugified input may
  // contain the pair slug ("ssri-antidepressants" contains
  // "antidepressants"). The reverse is forbidden — a short input
  // must never claim a longer drug name it merely prefixes.
  for (const pair of pairs) {
    if (pair.drugSlug.length >= 4 && slug.includes(pair.drugSlug)) {
      return pair;
    }
  }

  return null;
}
