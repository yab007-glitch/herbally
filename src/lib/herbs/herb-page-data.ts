import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { herbUnavailable } from "@/lib/herbs/resolve-herb";
import { cleanFaqText } from "@/lib/herbs/clean-faq";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import type { LinkHerb } from "@/lib/data/internal-links";
import type { RegulatoryEvidence } from "@/components/herbs/regulatory-evidence";
import type { ActionResponse, HerbWithInteractions } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { logger } from "@/lib/utils/logger";

export const HERB_PAGE_TTL = 259200;
export const PRERENDER_HERB_LIMIT = 0;

export type MonographSourceRow = {
  source: string;
  licence: string | null;
  attribution: string | null;
  url: string | null;
  claims: unknown;
  safety: unknown;
  doses: unknown;
  monograph_date: string | null;
};

export type HerbPageBundle = {
  herb: Record<string, unknown> | null;
  regulatory: RegulatoryEvidence | null;
  monograph: Record<string, unknown> | null;
  pubmed: Record<string, unknown> | null;
  popularity: { views?: number | null } | null;
  sources: MonographSourceRow[];
  faqs: Array<Record<string, unknown>>;
  related: Array<{ name: string; slug: string; scientific_name: string }>;
  neighbours?: { prev: LinkHerb | null; next: LinkHerb | null };
  symptom_peers?: LinkHerb[];
};

export interface CitationData {
  source: string;
  title?: string;
  url?: string;
  year?: number;
  pmid?: string;
}

export async function fetchHerb(
  slug: string,
  locale: Locale
): Promise<ActionResponse<HerbWithInteractions>> {
  const result = await getHerbBySlug(slug, { locale, skipCookies: true });
  if (!result.success && result.reason === "unavailable") {
    herbUnavailable(result.error);
  }
  return result;
}

export const loadHerb = cache((slug: string, locale: Locale) =>
  fetchHerb(slug, locale)
);

async function fetchHerbPageBundle(
  slug: string
): Promise<HerbPageBundle | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc("herb_page_bundle", { p_slug: slug });
  if (error) {
    throw new Error(error.message ?? "herb_page_bundle failed");
  }
  return (data as HerbPageBundle | null) ?? null;
}

export const loadHerbPageBundle = cache(
  async (slug: string): Promise<HerbPageBundle | null> => {
    try {
      return await unstable_cache(
        fetchHerbPageBundle,
        ["herb-page-bundle-v7"],
        {
          revalidate: HERB_PAGE_TTL,
          tags: ["herb-page-bundle", `herb-page-bundle-${slug}`],
        }
      )(slug);
    } catch (error) {
      logger.warn("herb_page_bundle failed", { slug, error: String(error) });
      return null;
    }
  }
);

export const loadRegulatoryEvidence = cache(
  async (slug: string): Promise<RegulatoryEvidence | null> => {
    return await unstable_cache(
      async (s: string) => {
        const bundle = await loadHerbPageBundle(s);
        return (bundle?.regulatory as RegulatoryEvidence | null) ?? null;
      },
      ["herb-regulatory-evidence"],
      {
        revalidate: HERB_PAGE_TTL,
        tags: ["herb-regulatory-evidence", `herb-regulatory-evidence-${slug}`],
      }
    )(slug);
  }
);

export function loadSourcesCached(slug: string): Promise<MonographSourceRow[]> {
  return unstable_cache(
    async (herbSlug: string) => {
      const b = await loadHerbPageBundle(herbSlug);
      if (b && Array.isArray(b.sources)) {
        return b.sources;
      }
      const supabase = getAnonClient();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("herb_monograph_sources" as never)
        .select(
          "source, licence, attribution, url, claims, safety, doses, monograph_date"
        )
        .eq("herb_slug", herbSlug)
        .order("source", { ascending: true });
      if (error) return [];
      return (data ?? []) as unknown as MonographSourceRow[];
    },
    [`sources-v4-${slug}`],
    { revalidate: HERB_PAGE_TTL, tags: [`sources-${slug}`] }
  )(slug);
}

export function loadMonographCached(slug: string) {
  return unstable_cache(
    async (herbSlug: string) => {
      const bundle = await loadHerbPageBundle(herbSlug);
      if (!bundle?.monograph) return null;
      const m = bundle.monograph as Record<string, unknown>;
      return {
        summary: m.summary,
        mechanism: m.mechanism,
        claims: m.claims,
        safety_notes: m.safety_notes,
        drug_interactions: m.drug_interactions,
        pregnancy_category: m.pregnancy_category,
        key_citations: m.key_citations,
        status: m.status,
        generation_method: m.generation_method,
        reviewed_by: m.reviewed_by,
        provenance: m.provenance,
      };
    },
    [`monograph-v2-${slug}`],
    { revalidate: HERB_PAGE_TTL, tags: [`monograph-${slug}`] }
  )(slug);
}

export function loadPubmedSheetCached(slug: string) {
  return unstable_cache(
    async (herbSlug: string) => {
      const bundle = await loadHerbPageBundle(herbSlug);
      if (!bundle?.pubmed) return null;
      const p = bundle.pubmed as Record<string, unknown>;
      return {
        content: (p.content as string | null) ?? null,
        citations: (p.citations as unknown[] | null) ?? null,
        pmids: (p.pmids as string[] | null) ?? null,
        article_count: (p.article_count as number | null) ?? 0,
        model: (p.model as string | null) ?? null,
        status: (p.status as string | null) ?? null,
      };
    },
    [`pubmed-sheet-${slug}`],
    { revalidate: 3600, tags: [`pubmed-sheet-${slug}`] }
  )(slug);
}

export function loadFaqsCached(slug: string, locale: string) {
  return unstable_cache(
    async (herbSlug: string, faqLocale: string) => {
      const bundle = await loadHerbPageBundle(herbSlug);
      const data = bundle?.faqs ?? [];
      const rows = (data || []) as unknown as Array<{
        question: string;
        answer: string;
        category?: string;
        translations?: {
          fr?: { question?: string; answer?: string };
        } | null;
      }>;
      const clean = (list: typeof rows) =>
        list.map((r) => ({ ...r, answer: cleanFaqText(r.answer) }));

      if (faqLocale !== "fr") return clean(rows);
      return clean(
        rows
          .filter(
            (r) => r.translations?.fr?.question && r.translations?.fr?.answer
          )
          .map((r) => ({
            ...r,
            question: r.translations!.fr!.question!,
            answer: r.translations!.fr!.answer!,
          }))
      );
    },
    [`herb-faqs-v5-${slug}`],
    { revalidate: HERB_PAGE_TTL, tags: [`herb-faqs-${slug}`] }
  )(slug, locale);
}

export function loadRelatedHerbs(
  slug: string,
  categoryId: string | null,
  curatedSlugs: string[]
) {
  return unstable_cache(
    async (herbSlug: string, catId: string | null, curated: string[]) => {
      const b = await loadHerbPageBundle(herbSlug);
      if (b?.related?.length) {
        if (curated.length) {
          const bySlug = new Map(b.related.map((r) => [r.slug, r]));
          const ordered = curated
            .map((s) => bySlug.get(s))
            .filter(
              (
                r
              ): r is { name: string; slug: string; scientific_name: string } =>
                Boolean(r)
            );
          if (ordered.length) return ordered;
        }
        return b.related.slice(0, 3);
      }
      if (b && b.neighbours !== undefined) {
        return [];
      }
      const supabaseClient = getAnonClient();
      if (!supabaseClient) return [];
      let relatedQuery = supabaseClient
        .from("herbs")
        .select(
          "name, slug, scientific_name, symptom_keywords, traditional_uses"
        )
        .eq("is_published", true)
        .limit(24);
      if (catId) {
        relatedQuery = relatedQuery.eq("category_id", catId);
      }
      const { data: categoryHerbs } = await relatedQuery;
      if (!categoryHerbs) return [];
      return getComparisonHerbs(herbSlug, categoryHerbs, 3);
    },
    [`related-herbs-v3-${slug}`],
    { revalidate: HERB_PAGE_TTL, tags: [`related-herbs-${slug}`] }
  )(slug, categoryId, curatedSlugs);
}

export function getEvidenceLevel(
  level: string | null | undefined
): "A" | "B" | "C" | "D" | "trad" {
  if (level && ["A", "B", "C", "D", "trad"].includes(level)) {
    return level as "A" | "B" | "C" | "D" | "trad";
  }
  return "trad";
}

export function formatCitations(
  citations: CitationData[] | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
): CitationData[] {
  if (!citations || citations.length === 0) {
    return [
      {
        source: t("herbDetailContent.sources.nccih"),
        title: t("seo.nccihSource"),
        url: "https://www.nccih.nih.gov/health/herbsataglance",
      },
    ];
  }
  return citations;
}

/** Pick the latest non-future timestamp between `updated_at` and `last_reviewed`. */
export function computeLatestModified(
  updatedAt?: string | null,
  lastReviewed?: string | null
): string | null {
  const candidates = [updatedAt, lastReviewed]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((raw) => ({ raw, ms: Date.parse(raw) }))
    .filter((item) => !Number.isNaN(item.ms) && item.ms <= Date.now());
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.ms - a.ms);
  return candidates[0].raw;
}
