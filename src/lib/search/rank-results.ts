/**
 * Rank herb search results so exact/prefix name matches surface first.
 * Symptom matches (evidence-sorted) previously always outranked text
 * matches, so typing an exact herb name like "Turmeric" surfaced obscure
 * variants while the exact herb sat below the fold. Stable sort preserves
 * the existing evidence/DB order within each rank.
 */
export function rankHerbResults<T extends { name: string }>(
  results: T[],
  term: string
): T[] {
  const norm = term.trim().toLowerCase();
  if (!norm) return results;
  const nameRank = (name: string): number => {
    const n = (name || "").toLowerCase();
    if (n === norm) return 0;
    if (n.startsWith(norm)) return 1;
    if (n.includes(norm)) return 2;
    return 3;
  };
  return [...results].sort((a, b) => nameRank(a.name) - nameRank(b.name));
}
