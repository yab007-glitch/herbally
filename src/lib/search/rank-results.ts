import {
  normalizeMatchText,
  splitSearchTokens,
} from "@/lib/search/normalize-query";
import { extractFrenchHerbName } from "@/lib/utils/localize-herb";

/**
 * Rank herb search results so exact/prefix name matches surface first across
 * both English and French herb names (with accents and elided articles folded).
 */
export function rankHerbResults<
  T extends { name: string; translations?: unknown },
>(results: T[], term: string): T[] {
  const tokens = splitSearchTokens(term);
  const norm = normalizeMatchText(tokens.join(" ")) || normalizeMatchText(term);
  if (!norm) return results;

  const candidateRank = (candidate: string | null | undefined): number => {
    const n = normalizeMatchText(candidate || "");
    if (!n) return 3;
    if (n === norm) return 0;
    if (n.startsWith(norm)) return 1;
    if (n.includes(norm)) return 2;
    return 3;
  };

  const rowRank = (row: T): number =>
    Math.min(
      candidateRank(row.name),
      candidateRank(extractFrenchHerbName(row.translations))
    );

  return [...results].sort((a, b) => rowRank(a) - rowRank(b));
}
