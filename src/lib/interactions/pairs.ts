import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import {
  InteractionDataUnavailableError,
  InteractionUrlCollisionError,
} from "./errors";
import { drugSlug, EDITORIAL_PAIR_CANONICAL_DRUG } from "./pair-url";

export type InteractionSeverity =
  "mild" | "moderate" | "severe" | "contraindicated";

export interface InteractionPair {
  id: string;
  herbSlug: string;
  herbName: string;
  herbScientificName: string;
  drugName: string;
  /** Localized display name when `locale !== "en"`, falling back to `drugName`. */
  localizedDrugName?: string;
  drugSlug: string;
  severity: InteractionSeverity;
  description: string;
  mechanism: string | null;
  evidenceLevel: string | null;
  source: string | null;
  sourceUrl: string | null;
  /** What the cited paper actually reported, when it qualifies the severity. */
  evidenceNote: string | null;
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
  evidence_note?: string | null;
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
  drug_name?: string;
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
  let localizedDrugName = row.drug_name;
  let description = row.description;
  let mechanism = row.mechanism;
  if (locale === "fr") {
    const frIx = frOf(t) as InteractionFr | null;
    if (frIx?.drug_name) localizedDrugName = frIx.drug_name;
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
    localizedDrugName,
    drugSlug: drugSlugValue,
    severity: row.severity,
    description,
    mechanism,
    evidenceLevel: row.evidence_level,
    source: row.source,
    sourceUrl: row.source_url,
    evidenceNote: row.evidence_note ?? null,
    updatedAt: row.updated_at,
    hasFr,
  };
}

const PAIR_SELECT =
  "id,drug_name,severity,description,mechanism,evidence_level,source,source_url,evidence_note,updated_at,translations,herbs!inner(slug,name,scientific_name,is_published,translations)";

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
export async function getInteractionPairs(
  locale: string = "en"
): Promise<InteractionPair[]> {
  const supabase = getAnonClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.is_published", true)
      .order("drug_name", { ascending: true })
      .order("id", { ascending: true })
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
      const pair = toPair(row, locale);
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
 *
 * Throws `InteractionDataUnavailableError` when the database cannot be read,
 * and `InteractionUrlCollisionError` when multiple rows share the same
 * `(herbSlug, drugSlug)` without an explicit editorial override.
 */
export async function getInteractionPair(
  herbSlug: string,
  drug: string,
  locale: string = "en"
): Promise<InteractionPair | null> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new InteractionDataUnavailableError("Supabase client unavailable");
  }
  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const res = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.slug", herbSlug)
      .eq("herbs.is_published", true)
      .order("drug_name", { ascending: true })
      .order("id", { ascending: true })
      .limit(100)
      .abortSignal(querySignal());
    data = res.data;
    error = res.error;
  } catch (err) {
    logger.error("interactions.getPair_failed", {
      herbSlug,
      error: String(err),
    });
    throw new InteractionDataUnavailableError(
      err instanceof Error ? err.message : "Failed to load interaction pair"
    );
  }
  if (error || !Array.isArray(data)) {
    logger.error("interactions.getPair_query_error", {
      herbSlug,
      error: error?.message ?? "No data returned",
    });
    throw new InteractionDataUnavailableError(
      error?.message ?? "Failed to load interaction pair"
    );
  }

  const matches: InteractionPair[] = [];
  for (const row of data as unknown as PairRow[]) {
    const pair = toPair(row, locale);
    if (pair && pair.drugSlug === drug) matches.push(pair);
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const editorialDrug = EDITORIAL_PAIR_CANONICAL_DRUG[`${herbSlug}/${drug}`];
  if (editorialDrug) {
    const chosen = matches.find((m) => m.drugName === editorialDrug);
    if (chosen) return chosen;
  }

  logger.error("interactions_pair_url_collision", {
    herbSlug,
    drugSlug: drug,
    rowIds: matches.map((m) => m.id),
    drugNames: matches.map((m) => m.drugName),
    severities: matches.map((m) => m.severity),
  });
  throw new InteractionUrlCollisionError(herbSlug, drug, matches);
}

/**
 * All curated pairs for one herb, for the homepage checker.
 * The checker matches the user's free-text medication against these
 * rows (see lib/interactions/check.ts) instead of jumping straight
 * to the AI chat, so a known pair is answered from the database first.
 *
 * Throws `InteractionDataUnavailableError` when the database cannot be read.
 */
export async function getHerbPairs(
  herbSlug: string,
  locale: string = "en"
): Promise<InteractionPair[]> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new InteractionDataUnavailableError("Supabase client unavailable");
  }
  try {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select(PAIR_SELECT)
      .eq("herbs.slug", herbSlug)
      .eq("herbs.is_published", true)
      .order("drug_name", { ascending: true })
      .order("id", { ascending: true })
      .limit(100)
      .abortSignal(querySignal());
    if (error || !data) {
      logger.error("interactions.getHerbPairs_query_error", {
        herbSlug,
        error: error?.message ?? "No data returned",
      });
      throw new InteractionDataUnavailableError(
        error?.message ?? "Failed to load herb interaction pairs"
      );
    }
    const pairs: InteractionPair[] = [];
    for (const row of data as unknown as PairRow[]) {
      const pair = toPair(row, locale);
      if (pair) pairs.push(pair);
    }
    return pairs;
  } catch (error) {
    if (error instanceof InteractionDataUnavailableError) throw error;
    logger.error("interactions.getHerbPairs_failed", {
      herbSlug,
      error: String(error),
    });
    throw new InteractionDataUnavailableError(
      error instanceof Error
        ? error.message
        : "Failed to load herb interaction pairs"
    );
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
    const drugPrefix = pair.drugName.split(" (")[0].trim();
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
        .ilike("drug_name", `${drugPrefix}%`)
        .neq("id", pair.id)
        .limit(50)
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
