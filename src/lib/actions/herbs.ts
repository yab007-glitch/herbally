"use server";

import { createClient } from "@/lib/supabase/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { cookies } from "next/headers";
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
import { logger } from "@/lib/utils/logger";

async function getLocale(): Promise<string> {
  try {
    const store = await cookies();
    return store.get("herbally-locale")?.value === "fr" ? "fr" : "en";
  } catch (error) {
    logger.error("herbs_get_locale_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
    return "en";
  }
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
      .order("name", { ascending: true })
      .range(from, to);

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

    const { data, count, error } = await query;

    if (error) {
      logger.error("herbs_get_herbs_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
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
    console.error("[herbs.getHerbs]", error);
    return { success: false, error: "Failed to fetch herbs" };
  }
}

export async function getHerbBySlug(
  slug: string,
  opts?: { locale?: string; skipCookies?: boolean }
): Promise<ActionResponse<HerbWithInteractions>> {
  try {
    const supabase = opts?.skipCookies
      ? getAnonClient()
      : await createClient();

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
      logger.error("herbs_get_herb_by_slug_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
      return { success: false, error: error.message };
    }

    const locale = opts?.locale ?? (opts?.skipCookies ? "en" : await getLocale());
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
    console.error("[herbs.getHerbBySlug]", error);
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
      logger.error("herbs_get_categories_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
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
    console.error("[herbs.getHerbCategories]", error);
    return { success: false, error: "Failed to fetch categories" };
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
      logger.error("herbs_get_symptom_counts_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
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
    console.error("[herbs.getSymptomCounts]", error);
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
      return { success: true, data: sorted as Herb[] };
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
      logger.error("herbs_search_failed", { error: error instanceof Error ? error.message : JSON.stringify(error) });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map((h) => localizeHerb(h as Herb, locale)) as Herb[],
    };
  } catch (error) {
    console.error("[herbs.searchHerbs]", error);
    return { success: false, error: "Failed to search herbs" };
  }
}
