import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { herbUnavailable } from "@/lib/herbs/resolve-herb";
import { cleanFaqQuestion, cleanFaqText } from "@/lib/herbs/clean-faq";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import type { LinkHerb } from "@/lib/data/internal-links";
import type { RegulatoryEvidence } from "@/components/herbs/regulatory-evidence";
import { shouldSuppressPublicAdultDose } from "@/lib/data/dangerous-herbs";
import {
  filterAdultDoses,
  isPediatricOnlyOrTaggedDose,
  sanitizeFaqQuestionText,
  stripPediatricDosageSentences,
} from "@/lib/herbs/regulatory-evidence";
import { redactPublicHerbFields } from "@/lib/utils/localize-herb";
import type { ActionResponse, Herb, HerbWithInteractions } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { logger } from "@/lib/utils/logger";

export const HERB_PAGE_TTL = 259200;
export const PRERENDER_HERB_LIMIT = 0;

export const FAQ_FALLBACK_QUESTION_EN = "Safety information";
export const FAQ_FALLBACK_QUESTION_FR = "Information de sécurité";

const PUBMED_PEDIATRIC_TOKEN_RE =
  /\b(?:pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(?:ren|hood)?|infants?|minors?|enfants?|nourrissons?)\b/i;
const PUBMED_DOSE_OR_USE_TOKEN_RE =
  /\b(?:doses?|dosages?|dosing|uses?|usage|administration|posolog(?:y|ie)?)\b/i;
const PUBMED_FLAT_PEDIATRIC_KEY_RE =
  /^(?:(?:pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(?:ren)?|infants?|minors?|enfants?|nourrissons?)(?:doses?|dosages?|dosing|uses?|usage|administration|posolog(?:y|ie)?)|(?:doses?|dosages?|dosing|uses?|usage|administration|posolog(?:y|ie)?)(?:in|for|of|to)?(?:pediatrics?|paediatrics?|p[eé]diatriques?|paed|child(?:ren)?|infants?|minors?|enfants?|nourrissons?))$/i;

export function isPubmedPediatricKey(key: string): boolean {
  const norm = key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return (
    (PUBMED_PEDIATRIC_TOKEN_RE.test(norm) &&
      PUBMED_DOSE_OR_USE_TOKEN_RE.test(norm)) ||
    PUBMED_FLAT_PEDIATRIC_KEY_RE.test(key)
  );
}

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

function sanitizeMonographDoseList(
  doses: unknown,
  suppressAll: boolean
): unknown {
  if (suppressAll) return [];
  if (!Array.isArray(doses)) return doses;
  return doses
    .map((entry) => {
      if (typeof entry === "string") {
        if (isPediatricOnlyOrTaggedDose({ text: entry })) {
          return stripPediatricDosageSentences(entry) || null;
        }
        return stripPediatricDosageSentences(entry) || null;
      }
      if (entry && typeof entry === "object") {
        const rec = entry as {
          text?: string | null;
          population?: string | null;
          age_minimum?: number | null;
        };
        const [cleaned] = filterAdultDoses([rec]);
        return cleaned ?? null;
      }
      return entry;
    })
    .filter((item) => item !== null && item !== "");
}

function sanitizeTextEntries(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items
    .map((entry) => {
      if (typeof entry === "string") {
        return stripPediatricDosageSentences(entry) || null;
      }
      if (entry && typeof entry === "object") {
        const obj = { ...(entry as Record<string, unknown>) };
        for (const key of [
          "text",
          "claim",
          "description",
          "note",
          "dose",
          "safety",
          "risk",
          "purpose",
          "indication",
          "value",
          "detail",
          "details",
          "interaction",
          "mechanism",
          "management",
          "recommendation",
          "finding",
          "summary",
          "condition",
        ]) {
          if (typeof obj[key] === "string") {
            obj[key] = stripPediatricDosageSentences(obj[key] as string);
          }
        }
        return obj;
      }
      return entry;
    })
    .filter((item) => item !== null && item !== "");
}

function sanitizeRegulatoryBlock<
  T extends {
    herb_slug?: string;
    purposes?: string[];
    doses?: Array<{
      text: string;
      population?: string | null;
      age_minimum?: number | null;
    }>;
    risks?: string[];
  },
>(reg: T, parentSlug: string): T {
  const slug = reg.herb_slug ?? parentSlug;
  const suppressAll = slug ? shouldSuppressPublicAdultDose(slug) : false;
  const sanitizedRisks = Array.isArray(reg.risks)
    ? (sanitizeTextEntries(reg.risks) as string[])
    : reg.risks;
  if (suppressAll) {
    return {
      ...reg,
      purposes: [],
      doses: [],
      ...(sanitizedRisks !== undefined ? { risks: sanitizedRisks } : {}),
    };
  }
  return {
    ...reg,
    ...(Array.isArray(reg.purposes)
      ? { purposes: sanitizeTextEntries(reg.purposes) as string[] }
      : {}),
    ...(sanitizedRisks !== undefined ? { risks: sanitizedRisks } : {}),
    doses: filterAdultDoses(reg.doses ?? []),
  };
}

/**
 * Redacts quarantined pediatric dosing fields/sentences and dangerous-herb
 * doses across every section of an `herb_page_bundle` payload (both cached
 * DB JSONB shape and hydrated view shapes).
 */
export function sanitizeHerbPageBundle<
  T extends Record<string, unknown> | HerbPageBundle | null,
>(bundle: T): T {
  if (!bundle || typeof bundle !== "object") return bundle;
  const record = bundle as Record<string, unknown>;
  const rawHerb =
    record.herb && typeof record.herb === "object"
      ? redactPublicHerbFields(record.herb as Herb)
      : null;
  const herbSlug =
    rawHerb && typeof rawHerb.slug === "string" ? rawHerb.slug : "";
  const suppressMain = herbSlug
    ? shouldSuppressPublicAdultDose(herbSlug)
    : false;

  const sanitizeRelatedArray = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item) =>
          item && typeof item === "object"
            ? "dosage_adult" in item || "dosage_child" in item
              ? redactPublicHerbFields(item as Herb)
              : item
            : item
        )
      : items;

  const sanitizeSourcesArray = (sources: unknown) =>
    Array.isArray(sources)
      ? sources.map((s) => {
          if (!s || typeof s !== "object") return s;
          const src = s as Record<string, unknown>;
          const srcSlug =
            typeof src.herb_slug === "string" ? src.herb_slug : herbSlug;
          const suppressSource = srcSlug
            ? shouldSuppressPublicAdultDose(srcSlug)
            : false;
          return {
            ...src,
            claims: suppressSource ? [] : sanitizeTextEntries(src.claims),
            safety: sanitizeTextEntries(src.safety),
            doses: sanitizeMonographDoseList(src.doses, suppressSource),
          };
        })
      : sources;

  const PUBMED_DOSE_KEY_RE =
    /^(?:dosage_?and_?administration|dosage|dose|doses|dosing|recommended_?dosage|adult_?dosage|administration|posology|posologie)$/i;

  const sanitizePubmedValue = (val: unknown, isDoseKey = false): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      if (isDoseKey && suppressMain) return null;
      return stripPediatricDosageSentences(val) || null;
    }
    if (Array.isArray(val)) {
      if (isDoseKey && suppressMain) return [];
      const baseList = isDoseKey
        ? (sanitizeMonographDoseList(val, false) as unknown[])
        : val;
      return baseList
        .map((item) => sanitizePubmedValue(item, false))
        .filter((item) => item !== null && item !== "");
    }
    if (typeof val === "object") {
      return sanitizePubmedSheetObj(val as Record<string, unknown>);
    }
    return val;
  };

  const sanitizePubmedSheetObj = (
    rawObj: Record<string, unknown>
  ): Record<string, unknown> => {
    const outObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawObj)) {
      if (isPubmedPediatricKey(key)) {
        continue;
      }
      const isDoseKey = PUBMED_DOSE_KEY_RE.test(key);
      if (isDoseKey && suppressMain) {
        outObj[key] = Array.isArray(value) ? [] : null;
        continue;
      }
      const cleaned = sanitizePubmedValue(value, isDoseKey);
      if (typeof value === "string" && cleaned === null && !isDoseKey) {
        continue;
      }
      outObj[key] = cleaned;
    }
    return outObj;
  };

  const sanitizePubmedBlock = (pm: unknown) => {
    if (!pm || typeof pm !== "object") return pm;
    const obj = pm as Record<string, unknown>;
    const content = obj.content;
    if (content && typeof content === "object") {
      return {
        ...obj,
        content: sanitizePubmedSheetObj(content as Record<string, unknown>),
      };
    }
    return obj;
  };

  const out: Record<string, unknown> = {
    ...record,
    herb: rawHerb,
  };

  if ("related" in record) out.related = sanitizeRelatedArray(record.related);
  if ("relatedHerbs" in record)
    out.relatedHerbs = sanitizeRelatedArray(record.relatedHerbs);

  if (record.regulatory && typeof record.regulatory === "object") {
    out.regulatory = sanitizeRegulatoryBlock(
      record.regulatory as RegulatoryEvidence,
      herbSlug
    );
  }
  if (Array.isArray(record.regulatoryEvidence)) {
    out.regulatoryEvidence = record.regulatoryEvidence.map((r) =>
      r && typeof r === "object"
        ? sanitizeRegulatoryBlock(r as RegulatoryEvidence, herbSlug)
        : r
    );
  }

  if ("sources" in record) out.sources = sanitizeSourcesArray(record.sources);
  if ("monographSources" in record)
    out.monographSources = sanitizeSourcesArray(record.monographSources);

  if ("pubmed" in record) out.pubmed = sanitizePubmedBlock(record.pubmed);
  if ("pubmedMonograph" in record)
    out.pubmedMonograph = sanitizePubmedBlock(record.pubmedMonograph);

  if (Array.isArray(record.faqs)) {
    out.faqs = record.faqs
      .map((faq) => {
        if (!faq || typeof faq !== "object") return faq;
        const f = { ...(faq as Record<string, unknown>) };
        let cleanedQuestion =
          typeof f.question === "string"
            ? sanitizeFaqQuestionText(f.question)
            : "";
        const cleanedAnswer =
          typeof f.answer === "string"
            ? stripPediatricDosageSentences(f.answer)
            : "";

        let cleanedFrAnswer = "";
        if (f.translations && typeof f.translations === "object") {
          const trans = { ...(f.translations as Record<string, unknown>) };
          if (trans.fr && typeof trans.fr === "object") {
            const frObj = { ...(trans.fr as Record<string, unknown>) };
            const cleanedFrQuestion =
              typeof frObj.question === "string"
                ? sanitizeFaqQuestionText(frObj.question)
                : "";
            cleanedFrAnswer =
              typeof frObj.answer === "string"
                ? stripPediatricDosageSentences(frObj.answer)
                : "";
            if (!cleanedFrAnswer) {
              frObj.question = "";
              frObj.answer = "";
            } else {
              frObj.question = cleanedFrQuestion || FAQ_FALLBACK_QUESTION_FR;
              frObj.answer = cleanedFrAnswer;
            }
            trans.fr = frObj;
          }
          f.translations = trans;
        }

        if (!cleanedAnswer && !cleanedFrAnswer) {
          return null;
        }

        if (!cleanedAnswer || !cleanedQuestion) {
          cleanedQuestion = FAQ_FALLBACK_QUESTION_EN;
        }
        f.question = cleanedQuestion;
        f.answer = cleanedAnswer;

        return f;
      })
      .filter((faq) => faq !== null);
  }

  if (record.monograph && typeof record.monograph === "object") {
    const m = { ...(record.monograph as Record<string, unknown>) };
    if (typeof m.summary === "string") {
      m.summary = stripPediatricDosageSentences(m.summary);
    }
    if (typeof m.mechanism === "string") {
      m.mechanism = stripPediatricDosageSentences(m.mechanism);
    }
    if ("safety_notes" in m) {
      m.safety_notes = sanitizeTextEntries(m.safety_notes);
    }
    if ("safetyNotes" in m) {
      m.safetyNotes = sanitizeTextEntries(m.safetyNotes);
    }
    if ("claims" in m) {
      m.claims = sanitizeTextEntries(m.claims);
    }
    if ("drug_interactions" in m) {
      m.drug_interactions = sanitizeTextEntries(m.drug_interactions);
    }
    if ("drugInteractions" in m) {
      m.drugInteractions = sanitizeTextEntries(m.drugInteractions);
    }
    out.monograph = m;
  }

  if (
    record.localizedDescriptions &&
    typeof record.localizedDescriptions === "object"
  ) {
    const descEntries = Object.entries(
      record.localizedDescriptions as Record<string, unknown>
    ).map(([k, v]) => [
      k,
      typeof v === "string" ? stripPediatricDosageSentences(v) : v,
    ]);
    out.localizedDescriptions = Object.fromEntries(descEntries);
  }

  return out as T;
}

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
  return sanitizeHerbPageBundle((data as HerbPageBundle | null) ?? null);
}

export const loadHerbPageBundle = cache(
  async (slug: string): Promise<HerbPageBundle | null> => {
    try {
      const bundle = await unstable_cache(
        fetchHerbPageBundle,
        ["herb-page-bundle-v11"],
        {
          revalidate: HERB_PAGE_TTL,
          tags: ["herb-page-bundle", `herb-page-bundle-${slug}`],
        }
      )(slug);
      return sanitizeHerbPageBundle(bundle);
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
      ["herb-regulatory-evidence-v3"],
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
        .from("herb_monograph_sources_public" as never)
        .select(
          "source, licence, attribution, url, claims, safety, doses, monograph_date"
        )
        .eq("herb_slug", herbSlug)
        .order("source", { ascending: true });
      if (error) return [];
      const sanitized = sanitizeHerbPageBundle({
        herb: { slug: herbSlug } as unknown as Herb,
        sources: data ?? [],
      });
      return ((sanitized?.sources as MonographSourceRow[]) ??
        []) as MonographSourceRow[];
    },
    [`sources-v6-${slug}`],
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
    [`monograph-v5-${slug}`],
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
    [`pubmed-sheet-v5-${slug}`],
    { revalidate: 3600, tags: [`pubmed-sheet-${slug}`] }
  )(slug);
}

export type PublicFaqRow = {
  question?: string | null;
  answer?: string | null;
  category?: string;
  translations?: {
    fr?: { question?: string | null; answer?: string | null };
  } | null;
};

export function normalizePublicFaqs<T extends PublicFaqRow>(
  rows: T[],
  faqLocale: string
): Array<T & { question: string; answer: string }> {
  const fallbackQuestion =
    faqLocale === "fr" ? FAQ_FALLBACK_QUESTION_FR : FAQ_FALLBACK_QUESTION_EN;
  const clean = (list: Array<T & { question: string; answer: string }>) =>
    list
      .map((r) => {
        const rawQuestion = r.question;
        const cleanedAnswer = cleanFaqText(r.answer);
        if (cleanedAnswer.length === 0) {
          return null;
        }
        const cleanedQuestion =
          cleanFaqQuestion(rawQuestion) || fallbackQuestion;
        let sanitizedTranslations = r.translations;
        if (r.translations?.fr) {
          const rawFrQ = r.translations.fr.question ?? "";
          const cleanedFrA = cleanFaqText(r.translations.fr.answer ?? "");
          if (cleanedFrA.length === 0) {
            sanitizedTranslations = {
              ...r.translations,
              fr: { question: "", answer: "" },
            };
          } else {
            const cleanedFrQ =
              cleanFaqQuestion(rawFrQ) || FAQ_FALLBACK_QUESTION_FR;
            sanitizedTranslations = {
              ...r.translations,
              fr: { question: cleanedFrQ, answer: cleanedFrA },
            };
          }
        }
        return {
          ...r,
          question: cleanedQuestion,
          answer: cleanedAnswer,
          ...(sanitizedTranslations !== undefined
            ? { translations: sanitizedTranslations }
            : {}),
        };
      })
      .filter(
        (r): r is T & { question: string; answer: string } =>
          r !== null && r.question.length > 0 && r.answer.length > 0
      );

  if (faqLocale !== "fr") {
    return clean(
      rows
        .filter(
          (r) => typeof r.answer === "string" && r.answer.trim().length > 0
        )
        .map((r) => ({
          ...r,
          question: typeof r.question === "string" ? r.question : "",
          answer: r.answer!,
        }))
    );
  }
  return clean(
    rows
      .filter(
        (r) =>
          typeof r.translations?.fr?.answer === "string" &&
          r.translations.fr.answer.trim().length > 0
      )
      .map((r) => ({
        ...r,
        question:
          typeof r.translations?.fr?.question === "string"
            ? r.translations.fr.question
            : "",
        answer: r.translations!.fr!.answer!,
      }))
  );
}

export function loadFaqsCached(slug: string, locale: string) {
  return unstable_cache(
    async (herbSlug: string, faqLocale: string) => {
      const bundle = await loadHerbPageBundle(herbSlug);
      const data = bundle?.faqs ?? [];
      const rows = (data || []) as unknown as PublicFaqRow[];
      return normalizePublicFaqs(rows, faqLocale);
    },
    [`herb-faqs-v9-${slug}`],
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
        .from("herbs_public" as never)
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
    [`related-herbs-v4-${slug}`],
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
  _t?: (key: string, params?: Record<string, string | number>) => string
): CitationData[] {
  if (!citations || citations.length === 0) {
    return [];
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
