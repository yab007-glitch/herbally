/**
 * Rank the union of symptom-keyword matches and name/description matches
 * for the /herbs list search.
 *
 * Previously getHerbs was keyword-first: whenever any symptom-keyword
 * match existed, the name/description fallback never ran, so an exact
 * herb name could be hidden by unrelated keyword matches. The search API
 * already unions both kinds of matches; this helper gives the list page
 * the same union, with a deterministic order:
 *   1. exact name matches (case-insensitive) first;
 *   2. remaining matches in the caller's sort order — strongest evidence
 *      first when sort is "evidence" (or the keyword default), name A-Z
 *      when sort is "name";
 *   3. de-duplicated by id, first occurrence wins.
 *
 * Pure function — no Supabase access — so it is unit-testable without
 * mocking the database client.
 */

export interface KeywordHerbMatch {
  id: string;
  name: string;
  evidence_level: string | null;
}

export interface NameHerbMatch {
  id: string;
  name: string;
}

const EVIDENCE_ORDER: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  trad: 4,
};

function evidenceRank(level: string | null): number {
  return EVIDENCE_ORDER[level ?? "C"] ?? 2;
}

export function rankHerbSearchResults({
  query,
  keywordMatches,
  nameMatches,
  sort,
}: {
  query: string;
  keywordMatches: KeywordHerbMatch[];
  nameMatches: NameHerbMatch[];
  sort: "name" | "evidence";
}): string[] {
  const norm = query.trim().toLowerCase();
  if (!norm) return [];

  const byId = new Map<
    string,
    { id: string; name: string; evidence: string | null }
  >();
  for (const herb of keywordMatches) {
    if (!byId.has(herb.id)) {
      byId.set(herb.id, {
        id: herb.id,
        name: herb.name,
        evidence: herb.evidence_level,
      });
    }
  }
  for (const herb of nameMatches) {
    if (!byId.has(herb.id)) {
      byId.set(herb.id, { id: herb.id, name: herb.name, evidence: null });
    }
  }

  const keywordIds = new Set(keywordMatches.map((h) => h.id));
  const exact = [...byId.values()]
    .filter((h) => h.name.toLowerCase() === norm)
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactIds = new Set(exact.map((h) => h.id));

  const rest = [...byId.values()].filter((h) => !exactIds.has(h.id));
  if (sort === "name") {
    rest.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const keywordRest = rest
      .filter((h) => keywordIds.has(h.id))
      .sort((a, b) => evidenceRank(a.evidence) - evidenceRank(b.evidence));
    const nameRest = rest
      .filter((h) => !keywordIds.has(h.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    rest.splice(0, rest.length, ...keywordRest, ...nameRest);
  }

  return [...exact, ...rest].map((h) => h.id);
}
