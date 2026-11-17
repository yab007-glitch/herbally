import {
  normalizeMatchText,
  splitSearchTokens,
} from "@/lib/search/normalize-query";
import { extractFrenchHerbName } from "@/lib/utils/localize-herb";

/**
 * Rank herb search results so exact/prefix name matches surface first across
 * both English and French herb names (with accents and elided articles folded).
 *
 * Ranks, best first:
 *   0 whole name equals the query        ("Aloe Vera" for "aloe vera")
 *   1 name starts with the query         ("Ginkgo Biloba" for "ginkgo")
 *   2 name contains the query            ("Ethiopian Turmeric" for "turmeric")
 *   3 every query word appears in name   ("Turmeric" for "turmeric powder")
 *   4 some query word appears in name
 *   5 nothing matches
 *
 * Tiers 3 and 4 only exist because the candidate query is broader than the
 * name: without them a row whose description mentions both words could sort
 * beside a real partial name match. Stable within a tier.
 */
export function rankHerbResults<
  T extends { name: string; translations?: unknown },
>(results: T[], term: string): T[] {
  const tokens = splitSearchTokens(term);
  const norm = normalizeMatchText(tokens.join(" ")) || normalizeMatchText(term);
  if (!norm) return results;
  const queryTokens = norm.split(" ");

  const candidateRank = (candidate: string | null | undefined): number => {
    const n = normalizeMatchText(candidate || "");
    if (!n) return 5;
    if (n === norm) return 0;
    if (n.startsWith(norm)) return 1;
    if (n.includes(norm)) return 2;
    const nameTokens = n.split(" ");
    const covered = queryTokens.filter((token) =>
      nameTokens.some(
        (nameToken) =>
          nameToken.startsWith(token) || token.startsWith(nameToken)
      )
    ).length;
    if (covered === queryTokens.length) return 3;
    return covered > 0 ? 4 : 5;
  };

  const rowRank = (row: T): number =>
    Math.min(
      candidateRank(row.name),
      candidateRank(extractFrenchHerbName(row.translations))
    );

  const nameTokenCount = (row: T): number =>
    normalizeMatchText(row.name).split(" ").filter(Boolean).length;

  // How many of the typed words this row's name covers. Used only to order
  // partial matches: a herb whose name carries three of four typed words
  // ("St. John's Wort" for "st johns wort extract") is closer than one that
  // shares a single word ("Sticta pulmonacea", whose name merely starts with
  // "st").
  const coverageOf = (row: T): number =>
    Math.max(
      ...[row.name, extractFrenchHerbName(row.translations)].map(
        (candidate) => {
          const n = normalizeMatchText(candidate || "");
          if (!n) return 0;
          const nameTokens = n.split(" ");
          return queryTokens.filter((token) =>
            nameTokens.some(
              (nameToken) =>
                nameToken.startsWith(token) || token.startsWith(nameToken)
            )
          ).length;
        }
      )
    );

  return [...results].sort((a, b) => {
    const rankDiff = rowRank(a) - rowRank(b);
    if (rankDiff !== 0) return rankDiff;
    const rank = rowRank(a);
    // Between partial name matches only: more typed words covered wins; on a
    // tie, the shorter name is the closer one ("Turmeric" for "turmeric
    // powder", not "Ethiopian Turmeric"). Outside ranks 3 and 4 the caller's
    // order (evidence grade for symptom matches) must survive untouched.
    if (rank === 3 || rank === 4) {
      const coverageDiff = coverageOf(b) - coverageOf(a);
      if (coverageDiff !== 0) return coverageDiff;
      return nameTokenCount(a) - nameTokenCount(b);
    }
    return 0;
  });
}
