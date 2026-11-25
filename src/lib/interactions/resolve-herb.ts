import { getAnonClient } from "@/lib/supabase/anonymous";
import { InteractionDataUnavailableError } from "@/lib/interactions/errors";
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
 *
 * Throws `InteractionDataUnavailableError` if the database client is missing
 * or any lookup query fails — callers must never misreport a DB failure as
 * "herb not found".
 */
export async function resolveHerb(term: string): Promise<HerbCandidate | null> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new InteractionDataUnavailableError("Supabase client unavailable");
  }

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
  let preciseResponse: {
    data: Record<string, unknown>[] | null;
    error: unknown;
  };
  let anchorResponse: {
    data: Record<string, unknown>[] | null;
    error: unknown;
  };
  let broadResponse: { data: Record<string, unknown>[] | null; error: unknown };
  try {
    [preciseResponse, anchorResponse, broadResponse] = await Promise.all([
      preciseFilter
        ? supabase
            .from("herbs_public" as never)
            .select(columns)
            .eq("is_published", true)
            .or(preciseFilter)
            .limit(30)
        : empty,
      anchorFilter
        ? supabase
            .from("herbs_public" as never)
            .select(columns)
            .eq("is_published", true)
            .or(anchorFilter)
            .limit(30)
        : empty,
      broadFilter
        ? supabase
            .from("herbs_public" as never)
            .select(columns)
            .eq("is_published", true)
            .or(broadFilter)
            .limit(30)
        : empty,
    ]);
  } catch (err) {
    throw new InteractionDataUnavailableError(
      err instanceof Error ? err.message : "Herb resolution query failed"
    );
  }

  if (preciseResponse.error || anchorResponse.error || broadResponse.error) {
    throw new InteractionDataUnavailableError(
      "Herb resolution query returned an error"
    );
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
    const slug = String(row.slug ?? "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    candidates.push({
      slug,
      name: String(row.name ?? ""),
      scientific_name: String(row.scientific_name ?? ""),
      frName: extractFrenchHerbName(
        (row.translations as Record<string, unknown> | null) ?? null
      ),
    });
  }
  return rankHerbMatches(candidates, term) ?? null;
}
