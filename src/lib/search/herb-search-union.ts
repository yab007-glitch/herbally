import { normalizeMatchText } from "@/lib/search/normalize-query";
import { rankHerbResults } from "@/lib/search/rank-results";
import { evidenceRank } from "@/lib/search/symptom-results";
import { extractFrenchHerbName } from "@/lib/utils/localize-herb";

/**
 * Rank the union of symptom-keyword matches and name/description matches
 * for the /herbs list search.
 */

export interface KeywordHerbMatch {
  id: string;
  name: string;
  evidence_level: string | null;
  translations?: unknown;
}

export interface NameHerbMatch {
  id: string;
  name: string;
  translations?: unknown;
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
  const norm = normalizeMatchText(query);
  if (!norm) return [];

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      frName: string | null;
      evidence: string | null;
    }
  >();
  for (const herb of keywordMatches) {
    if (!byId.has(herb.id)) {
      byId.set(herb.id, {
        id: herb.id,
        name: herb.name,
        frName: extractFrenchHerbName(herb.translations),
        evidence: herb.evidence_level,
      });
    }
  }
  for (const herb of nameMatches) {
    if (!byId.has(herb.id)) {
      byId.set(herb.id, {
        id: herb.id,
        name: herb.name,
        frName: extractFrenchHerbName(herb.translations),
        evidence: null,
      });
    }
  }

  const keywordIds = new Set(keywordMatches.map((h) => h.id));
  const exact = [...byId.values()]
    .filter(
      (h) =>
        normalizeMatchText(h.name) === norm ||
        (h.frName ? normalizeMatchText(h.frName) === norm : false)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactIds = new Set(exact.map((h) => h.id));

  const rest = [...byId.values()].filter((h) => !exactIds.has(h.id));
  if (sort === "name") {
    rest.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const keywordRest = rest
      .filter((h) => keywordIds.has(h.id))
      .sort((a, b) => evidenceRank(a.evidence) - evidenceRank(b.evidence));
    const nameRest = rankHerbResults(
      rest
        .filter((h) => !keywordIds.has(h.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
      query
    );
    rest.splice(0, rest.length, ...keywordRest, ...nameRest);
  }

  return [...exact, ...rest].map((h) => h.id);
}
