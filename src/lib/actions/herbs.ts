"use server";

import { createClient } from "@/lib/supabase/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import {
  localizeHerb,
  localizeInteraction,
  localizeCategoryName,
} from "@/lib/utils/localize-herb";
import { expandQueryToKeywords } from "@/lib/data/synonym-map";
import type {
  ActionResponse,
  Herb,
  HerbWithCategory,
  HerbWithInteractions,
  HerbCategory,
} from "@/lib/types";

/**
 * Read the locale from the x-locale request header (set by the proxy from
 * the URL). This is the single source of truth — the cookie can drift from
 * the URL, causing French-URL visitors to get English herb data.
 */
async function getLocale(): Promise<string> {
  return getLocaleFromRequest();
}

const ITEMS_PER_PAGE = 20;
const MAX_QUERY_LENGTH = 200;

export async function getHerbs(params: {
  query?: string;
  category?: string;
  pregnancySafe?: boolean;
  nursingSafe?: boolean;
  page?: number;
}): Promise<ActionResponse<{ herbs: HerbWithCategory[]; total: number }>> {
  try {
    const supabase = await createClient();
    const page = params.page || 1;
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from("herbs")
      .select("*, herb_categories(*)", { count: "exact" })
      .eq("is_published", true)
      .range(from, to);

    // When keyword matches are found we order by evidence level (A→B→C→D→trad)
    // instead of name, so the strongest-evidence herbs surface first. The flag
    // is applied AFTER filters below (Supabase accumulates all modifiers into
    // one query, so call order doesn't affect the final SQL).
    let orderByEvidence = false;

    if (params.query) {
      const q = params.query.trim().slice(0, MAX_QUERY_LENGTH);
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const expandedKeywords = expandQueryToKeywords(q);

        const { data: keywordResults } = await supabase
          .from("herbs")
          .select("id, evidence_level")
          .eq("is_published", true)
          .overlaps("symptom_keywords", expandedKeywords)
          .limit(500);

        let matchedIds: string[] = (keywordResults || []).map(
          (h: { id: string }) => h.id
        );
        if (matchedIds.length > 0) {
          const evidenceOrder: Record<string, number> = {
            A: 0,
            B: 1,
            C: 2,
            D: 3,
            trad: 4,
          };
          const sortedResults = (keywordResults || []).sort(
            (
              a: { evidence_level: string | null },
              b: { evidence_level: string | null }
            ) => {
              const ea = evidenceOrder[a.evidence_level || "C"] ?? 2;
              const eb = evidenceOrder[b.evidence_level || "C"] ?? 2;
              return ea - eb;
            }
          );
          matchedIds = sortedResults.map((h: { id: string }) => h.id);
          query = query.in("id", matchedIds);
          orderByEvidence = true;
        } else {
          const conditions = words
            .flatMap((w) => [
              `name.ilike.%${w}%`,
              `scientific_name.ilike.%${w}%`,
              `description.ilike.%${w}%`,
            ])
            .join(",");
          query = query.or(conditions);
        }
      }
    }

    if (params.category) {
      const { data: cat } = await supabase
        .from("herb_categories")
        .select("id")
        .eq("slug", params.category)
        .single();
      if (cat) {
        query = query.eq("category_id", cat.id);
      }
    }

    if (params.pregnancySafe) {
      query = query.eq("pregnancy_safe", true);
    }

    if (params.nursingSafe) {
      query = query.eq("nursing_safe", true);
    }

    // Apply ordering now that all filters are known. evidence_level asc gives
    // A,B,C,D,trad (uppercase before lowercase) — the desired evidence rank.
    query = query.order(orderByEvidence ? "evidence_level" : "name", {
      ascending: true,
    });

    const { data, count, error } = await query;

    if (error) {
      logger.error("herbs_get_herbs_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    const locale = await getLocale();
    const localizedHerbs = (data || []).map((h) =>
      localizeHerb(h as HerbWithCategory, locale)
    );
    return {
      success: true,
      data: {
        herbs: localizedHerbs as HerbWithCategory[],
        total: count || 0,
      },
    };
  } catch (error) {
    logger.error("herbs.getHerbs_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch herbs" };
  }
}

export async function getHerbBySlug(
  slug: string,
  opts?: { locale?: string; skipCookies?: boolean }
): Promise<ActionResponse<HerbWithInteractions>> {
  try {
    const supabase = opts?.skipCookies ? getAnonClient() : await createClient();

    if (!supabase) {
      return { success: false, error: "Supabase client not configured" };
    }

    const { data, error } = await supabase
      .from("herbs")
      .select("*, herb_categories(*), drug_interactions(*)")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (error) {
      // PGRST116 (0 rows) means the slug simply doesn't exist (or isn't
      // published). That's an expected "not found" -> the caller renders a
      // 404 via notFound(). Only log genuine server/DB errors, not misses,
      // so build-time prerendering of a stale slug doesn't spam error logs.
      const code = (error as { code?: string }).code;
      const isNotFound =
        code === "PGRST116" || /0 rows|contains 0 rows/i.test(error.message);
      if (!isNotFound) {
        logger.error("herbs_get_herb_by_slug_failed", {
          error: error instanceof Error ? error.message : JSON.stringify(error),
        });
      }
      return {
        success: false,
        error: isNotFound ? "Herb not found" : error.message,
      };
    }

    const locale =
      opts?.locale ?? (opts?.skipCookies ? "en" : await getLocale());
    const herb = localizeHerb(data as HerbWithInteractions, locale);
    const interactions = (herb.drug_interactions || []).map((ix) =>
      localizeInteraction(ix, locale)
    );
    return {
      success: true,
      data: {
        ...herb,
        drug_interactions: interactions,
      } as HerbWithInteractions,
    };
  } catch (error) {
    logger.error("herbs.getHerbBySlug_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch herb" };
  }
}

export async function getHerbCategories() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("herb_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error("herbs_get_categories_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    const locale = await getLocale();
    const localized = (data || []).map((cat) => ({
      ...cat,
      name: localizeCategoryName(
        cat as HerbCategory & { name_fr?: string | null },
        locale
      ),
    }));
    return { success: true, data: localized };
  } catch (error) {
    logger.error("herbs.getHerbCategories_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch categories" };
  }
}

/**
 * Deterministic "herb of the day" — picks a stable herb for the current UTC
 * date so every visitor sees the same pick on a given day and it rotates daily.
 * Index = day-of-year modulo the published-herb count, fetched at a fixed
 * `.order("name")` offset so the index is stable. Replaces the old client-side
 * localStorage approach where the banner was never populated and never showed.
 */
export async function getDailyHerb(): Promise<
  ActionResponse<{ slug: string; name: string; benefit: string }>
> {
  try {
    const supabase = await createClient();

    const { count } = await supabase
      .from("herbs")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);

    if (!count || count === 0) {
      return { success: false, error: "No herbs available" };
    }

    const now = new Date();
    const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        startOfYear) /
        86_400_000
    );
    const index = dayOfYear % count;

    const { data, error } = await supabase
      .from("herbs")
      .select("slug, name, description, traditional_uses")
      .eq("is_published", true)
      .order("name", { ascending: true })
      .range(index, index)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      logger.error("herbs_get_daily_herb_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: "Failed to fetch daily herb" };
    }

    const locale = await getLocale();
    const localized = localizeHerb(data as Herb, locale);
    const uses = localized.traditional_uses ?? [];
    const benefit =
      uses[0] ||
      (localized.description
        ? localized.description.split(/(?<=[.!?])\s/)[0]
        : localized.name);

    return {
      success: true,
      data: {
        slug: localized.slug,
        name: localized.name,
        benefit: benefit.slice(0, 120),
      },
    };
  } catch (error) {
    logger.error("herbs.getDailyHerb_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch daily herb" };
  }
}

/**
 * Get herb counts for multiple symptoms in a single batched query.
 * Avoids N+1 by combining all symptom searches into one ILIKE query.
 */
export async function getSymptomCounts(
  symptoms: string[]
): Promise<ActionResponse<Record<string, number>>> {
  try {
    const supabase = await createClient();
    const counts: Record<string, number> = {};

    // Build a single OR condition for all symptoms
    const conditions = symptoms
      .map((s) => `name.ilike.%${s}%,description.ilike.%${s}%`)
      .join(",");

    const { data, error } = await supabase
      .from("herbs")
      .select("name, description")
      .eq("is_published", true)
      .or(conditions)
      .limit(1000);

    if (error) {
      logger.error("herbs_get_symptom_counts_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    // Count matches per symptom from the single result set
    for (const symptom of symptoms) {
      const lower = symptom.toLowerCase();
      counts[symptom] =
        data?.filter(
          (h) =>
            h.name?.toLowerCase().includes(lower) ||
            h.description?.toLowerCase().includes(lower)
        ).length ?? 0;
    }

    return { success: true, data: counts };
  } catch (error) {
    logger.error("herbs.getSymptomCounts_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch symptom counts" };
  }
}

export async function searchHerbs(
  term: string
): Promise<ActionResponse<Herb[]>> {
  try {
    const supabase = await createClient();
    const safeTerm = term.trim().slice(0, MAX_QUERY_LENGTH);

    const expandedKeywords = expandQueryToKeywords(safeTerm);
    const { data: keywordResults } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level")
      .eq("is_published", true)
      .overlaps("symptom_keywords", expandedKeywords)
      .limit(10);

    const locale = await getLocale();
    if (keywordResults && keywordResults.length > 0) {
      const evidenceOrder: Record<string, number> = {
        A: 0,
        B: 1,
        C: 2,
        D: 3,
        trad: 4,
      };
      const sorted = keywordResults.sort(
        (
          a: { evidence_level: string | null },
          b: { evidence_level: string | null }
        ) => {
          const ea = evidenceOrder[a.evidence_level || "C"] ?? 2;
          const eb = evidenceOrder[b.evidence_level || "C"] ?? 2;
          return ea - eb;
        }
      );
      // Localize keyword hits too — previously this branch returned raw rows
      // and skipped localizeHerb, so FR users saw English names in results.
      return {
        success: true,
        data: sorted.map((h) => localizeHerb(h as Herb, locale)) as Herb[],
      };
    }

    const { data, error } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, translations")
      .eq("is_published", true)
      .or(
        `name.ilike.%${safeTerm}%,scientific_name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`
      )
      .limit(10);

    if (error) {
      logger.error("herbs_search_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map((h) => localizeHerb(h as Herb, locale)) as Herb[],
    };
  } catch (error) {
    logger.error("herbs.searchHerbs_failed", { error: String(error) });
    return { success: false, error: "Failed to search herbs" };
  }
}
