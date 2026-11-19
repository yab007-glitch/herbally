import { getAnonClient } from "@/lib/supabase/anonymous";
import { rankHerbMatches } from "@/lib/interactions/rank-herb-match";
import {
  buildHerbNameAnchorFilter,
  buildHerbPreciseNameFilter,
  buildHerbTextOrFilter,
} from "@/lib/search/normalize-query";
import { extractFrenchHerbName } from "@/lib/utils/localize-herb";

export interface HerbCandidate {
  slug: string;
  name: string;
  scientific_name: string;
  frName?: string | null;
}

/**
 * Resolve a free-text herb name (English, scientific, or French) to a
 * published herb row without inventing matches.
 */
export async function resolveHerb(term: string): Promise<HerbCandidate | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  const preciseFilter = buildHerbPreciseNameFilter(term, { maxTokens: 5 });
  const anchorFilter = buildHerbNameAnchorFilter(term, { maxTokens: 5 });
  const broadFilter = buildHerbTextOrFilter(term, {
    includeDescription: false,
    maxTokens: 5,
    minTokenLength: 3,
  });
  if (!preciseFilter && !anchorFilter && !broadFilter) return null;

  const columns = "slug,name,scientific_name,translations";
  const empty = Promise.resolve({ data: [], error: null });
  const [preciseResponse, anchorResponse, broadResponse] = await Promise.all([
    preciseFilter
      ? supabase
          .from("herbs")
          .select(columns)
          .eq("is_published", true)
          .or(preciseFilter)
          .limit(30)
      : empty,
    anchorFilter
      ? supabase
          .from("herbs")
          .select(columns)
          .eq("is_published", true)
          .or(anchorFilter)
          .limit(30)
      : empty,
    broadFilter
      ? supabase
          .from("herbs")
          .select(columns)
          .eq("is_published", true)
          .or(broadFilter)
          .limit(30)
      : empty,
  ]);

  if (preciseResponse.error && anchorResponse.error && broadResponse.error) {
    return null;
  }

  const rows = [
    ...(preciseResponse.data ?? []),
    ...(anchorResponse.data ?? []),
    ...(broadResponse.data ?? []),
  ];
  if (rows.length === 0) return null;

  const seen = new Set<string>();
  const candidates: HerbCandidate[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    candidates.push({
      slug: row.slug,
      name: row.name,
      scientific_name: row.scientific_name,
      frName: extractFrenchHerbName(row.translations),
    });
  }
  return rankHerbMatches(candidates, term) ?? null;
}
