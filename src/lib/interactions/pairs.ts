import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { drugSlug } from "./pair-url";

export type InteractionSeverity =
  "mild" | "moderate" | "severe" | "contraindicated";

export interface InteractionPair {
  id: string;
  herbSlug: string;
  herbName: string;
  herbScientificName: string;
  drugName: string;
  drugSlug: string;
  severity: InteractionSeverity;
  description: string;
  mechanism: string | null;
  evidenceLevel: string | null;
  source: string | null;
  sourceUrl: string | null;
  updatedAt: string;
  /** French translation present (translations->fr), for sitemap gating. */
  hasFr: boolean;
}

interface PairRow {
  id: string;
  drug_name: string;
  severity: InteractionSeverity;
  description: string;
  mechanism: string | null;
  evidence_level: string | null;
  source: string | null;
  source_url: string | null;
  updated_at: string;
  translations: Record<string, unknown> | null;
  herbs: { slug: string; name: string; scientific_name: string } | null;
}

function toPair(row: PairRow): InteractionPair | null {
  if (!row.herbs?.slug) return null;
  const t = row.translations;
  return {
    id: row.id,
    herbSlug: row.herbs.slug,
    herbName: row.herbs.name,
    herbScientificName: row.herbs.scientific_name,
    drugName: row.drug_name,
    drugSlug: drugSlug(row.drug_name),
    severity: row.severity,
    description: row.description,
    mechanism: row.mechanism,
    evidenceLevel: row.evidence_level,
    source: row.source,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
    hasFr: !!t && typeof t === "object" && "fr" in t && t.fr != null,
  };
}

const PAIR_SELECT =
  "id,drug_name,severity,description,mechanism,evidence_level,source,source_url,updated_at,translations,herbs!inner(slug,name,scientific_name,is_published)";

/**
 * All curated herb↔drug pairs (published herbs only). Single source of truth
 * for the pair route's generateStaticParams and the sitemap.
 */
export async function getInteractionPairs(): Promise<InteractionPair[]> {
  const supabase = getAnonClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.is_published", true)
      .order("drug_name", { ascending: true })
      .limit(5000);
    if (error || !data) {
      if (error)
        logger.error("interactions_get_pairs_failed", {
          error: error.message,
        });
      return [];
    }
    const pairs: InteractionPair[] = [];
    for (const row of data as unknown as PairRow[]) {
      const pair = toPair(row);
      if (pair) pairs.push(pair);
    }
    return pairs;
  } catch (error) {
    logger.error("interactions.getPairs_failed", { error: String(error) });
    return [];
  }
}

/**
 * One pair by URL slugs. Drug lookup matches the slugified generic name
 * (see drugSlug) against the herb's rows.
 */
export async function getInteractionPair(
  herbSlug: string,
  drug: string
): Promise<InteractionPair | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.slug", herbSlug)
      .eq("herbs.is_published", true)
      .limit(100);
    if (error || !data) return null;
    for (const row of data as unknown as PairRow[]) {
      const pair = toPair(row);
      if (pair && pair.drugSlug === drug) return pair;
    }
    return null;
  } catch (error) {
    logger.error("interactions.getPair_failed", {
      herbSlug,
      error: String(error),
    });
    return null;
  }
}

/**
 * Related pairs for cross-linking: other drugs for the same herb, and other
 * herbs for the same drug (matched on slugified generic name).
 */
export async function getRelatedPairs(pair: InteractionPair): Promise<{
  sameHerb: InteractionPair[];
  sameDrug: InteractionPair[];
}> {
  const supabase = getAnonClient();
  if (!supabase) return { sameHerb: [], sameDrug: [] };
  try {
    const [{ data: herbRows }, { data: drugRows }] = await Promise.all([
      supabase
        .from("drug_interactions")
        .select(PAIR_SELECT)
        .eq("herbs.slug", pair.herbSlug)
        .eq("herbs.is_published", true)
        .neq("id", pair.id)
        .limit(20),
      supabase
        .from("drug_interactions")
        .select(PAIR_SELECT)
        .eq("herbs.is_published", true)
        .neq("id", pair.id)
        .limit(500),
    ]);
    const sameHerb: InteractionPair[] = [];
    for (const row of (herbRows ?? []) as unknown as PairRow[]) {
      const p = toPair(row);
      if (p) sameHerb.push(p);
    }
    // Same drug = same slugified generic name, different herb.
    const sameDrug: InteractionPair[] = [];
    for (const row of (drugRows ?? []) as unknown as PairRow[]) {
      const p = toPair(row);
      if (p && p.drugSlug === pair.drugSlug && p.herbSlug !== pair.herbSlug)
        sameDrug.push(p);
    }
    return { sameHerb: sameHerb.slice(0, 8), sameDrug: sameDrug.slice(0, 8) };
  } catch (error) {
    logger.error("interactions.getRelated_failed", {
      id: pair.id,
      error: String(error),
    });
    return { sameHerb: [], sameDrug: [] };
  }
}
