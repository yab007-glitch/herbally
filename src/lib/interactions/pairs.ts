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
  herbs: {
    slug: string;
    name: string;
    scientific_name: string;
    translations: Record<string, unknown> | null;
  } | null;
}

interface InteractionFr {
  description?: string;
  mechanism?: string;
}

interface HerbFr {
  name?: string;
}

function frOf(
  translations: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!translations || typeof translations !== "object") return null;
  const fr = translations.fr;
  return fr && typeof fr === "object" ? (fr as Record<string, unknown>) : null;
}

function toPair(row: PairRow, locale: string = "en"): InteractionPair | null {
  if (!row.herbs?.slug) return null;
  const t = row.translations;
  // Drug slugs ALWAYS derive from the English generic name so EN and FR
  // share one canonical URL (verified collision-free on the EN corpus).
  const drugSlugValue = drugSlug(row.drug_name);
  let herbName = row.herbs.name;
  let description = row.description;
  let mechanism = row.mechanism;
  if (locale === "fr") {
    const frIx = frOf(t) as InteractionFr | null;
    if (frIx?.description) description = frIx.description;
    if (frIx?.mechanism !== undefined && frIx.mechanism !== null)
      mechanism = frIx.mechanism;
    const frHerb = frOf(row.herbs.translations) as HerbFr | null;
    if (frHerb?.name) herbName = frHerb.name;
  }
  const hasFr =
    !!frOf(t) && typeof (frOf(t) as InteractionFr)?.description === "string";
  return {
    id: row.id,
    herbSlug: row.herbs.slug,
    herbName,
    herbScientificName: row.herbs.scientific_name,
    drugName: row.drug_name,
    drugSlug: drugSlugValue,
    severity: row.severity,
    description,
    mechanism,
    evidenceLevel: row.evidence_level,
    source: row.source,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
    hasFr,
  };
}

const PAIR_SELECT =
  "id,drug_name,severity,description,mechanism,evidence_level,source,source_url,updated_at,translations,herbs!inner(slug,name,scientific_name,is_published,translations)";

// Static generation must never hang the whole build on a slow database —
// abort stalled queries and degrade to []/null (pages render on demand,
// sitemap emits static entries). 15s is generous for indexed lookups.
const QUERY_TIMEOUT_MS = 15_000;

function querySignal(): AbortSignal {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS);
}

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
      .limit(5000)
      .abortSignal(querySignal());
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
 * (see drugSlug) against the herb's rows. Pass the page locale for
 * translated content; URL slugs always resolve on English names.
 */
export async function getInteractionPair(
  herbSlug: string,
  drug: string,
  locale: string = "en"
): Promise<InteractionPair | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.slug", herbSlug)
      .eq("herbs.is_published", true)
      .limit(100)
      .abortSignal(querySignal());
    if (error || !data) return null;
    for (const row of data as unknown as PairRow[]) {
      const pair = toPair(row, locale);
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
export async function getRelatedPairs(
  pair: InteractionPair,
  locale: string = "en"
): Promise<{
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
        .limit(20)
        .abortSignal(querySignal()),
      supabase
        .from("drug_interactions")
        .select(PAIR_SELECT)
        .eq("herbs.is_published", true)
        .neq("id", pair.id)
        .limit(500)
        .abortSignal(querySignal()),
    ]);
    const sameHerb: InteractionPair[] = [];
    for (const row of (herbRows ?? []) as unknown as PairRow[]) {
      const p = toPair(row, locale);
      if (p) sameHerb.push(p);
    }
    // Same drug = same slugified generic name, different herb.
    const sameDrug: InteractionPair[] = [];
    for (const row of (drugRows ?? []) as unknown as PairRow[]) {
      const p = toPair(row, locale);
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
