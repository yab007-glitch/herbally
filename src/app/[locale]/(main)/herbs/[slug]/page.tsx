import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ShareButtons } from "@/components/shared/share-buttons";
import { HerbSchema } from "@/components/seo/herb-schema";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";
import { HerbFaqSection } from "@/components/herbs/herb-faq-section";
import { ChipLegend } from "@/components/herbs/chip-legend";
import { AuthorByline } from "@/components/herbs/author-byline";
import { HerbPhoto } from "@/components/herbs/herb-photo";
import { InternalLinkRail } from "@/components/herbs/internal-link-rail";
import { NewsletterSignup } from "@/components/marketing/newsletter-signup";
import {
  getAlphabeticalNeighbours,
  getSymptomPeers,
} from "@/lib/data/internal-links";
import { CitationsList, SourceAttribution } from "@/components/herbs/citations";
import { generateMonograph } from "@/lib/data/generate-monograph";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import { siteUrl } from "@/lib/seo/site-url";
import { truncateDescription } from "@/lib/seo/truncate-description";
import { hasDistinctCommonName } from "@/lib/seo/herb-naming";
import { addLocalePrefix } from "@/lib/i18n/routing";
import type { Monograph } from "@/lib/data/monographs";
import { parseProvenance, isVerified } from "@/lib/types/provenance";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { herbUnavailable, resolveHerbOr404 } from "@/lib/herbs/resolve-herb";
import type { ActionResponse, HerbWithInteractions } from "@/lib/types";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { type Locale } from "@/lib/i18n/config";

import { HerbHeroV2 } from "@/components/herbs/herb-hero-v2";
import { DangerousHerbBanner } from "@/components/herbs/dangerous-herb-banner";
import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import { HerbOverviewPanel } from "@/components/herbs/herb-overview-panel";
import { HerbUsesPanel } from "@/components/herbs/herb-uses-panel";
import { HerbSciencePanel } from "@/components/herbs/herb-science-panel";
import { HerbDosagePanel } from "@/components/herbs/herb-dosage-panel";
import { HerbSafetyPanel } from "@/components/herbs/herb-safety-panel";
import { InteractionsTable } from "@/components/herbs/interactions-table";
import { AdSlot } from "@/components/ads/ad-slot";
import { UserInteractionAlert } from "@/components/herbs/user-interaction-alert";
import { ViewTracker } from "@/components/herbs/view-tracker";
import { GovSources } from "@/components/herbs/gov-sources";
import { GovSourcedBanner } from "@/components/herbs/gov-sourced-banner";
import { PubmedMonographSheet } from "@/components/herbs/pubmed-monograph-sheet";
import type {
  SheetContent,
  Citation,
} from "@/components/herbs/pubmed-monograph-sheet";
import { hasManualMonograph } from "@/lib/data/monographs";
import { getReviewer } from "@/lib/data/reviewers";

// ISR. This route was force-dynamic because the locale used to come from
// headers(): the root layout's `headers()` call threw during on-demand static
// generation, which is what turned unlisted slugs into 500s on 2026-10-08.
// The locale is now a root param and no page-level code reads a request API,
// so on-demand generation is safe. Revalidate aligns with the unstable_cache
// TTLs below (24 h).
export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

/**
 * How many herb pages to pre-render at build time.
 *
 * Kept at zero deliberately: the build runs against the same 0.5 GB Supabase
 * instance that serves production, so prerendering every herb would trade a
 * runtime problem for a build-time one. `dynamicParams` defaults to true and
 * revalidate is set above, so any published slug outside this set is generated
 * on demand and cached. Raise this in a follow-up while watching build time
 * and DB load.
 */
const PRERENDER_HERB_LIMIT = 0;

/**
 * Request-scoped memo around the herb fetch.
 *
 * generateMetadata and the page component both need this row, with identical
 * arguments. They used to hit the database twice per render — and the heavier
 * of the two is a `select *` with two nested embeds. Every cold render paid
 * that twice, and a prerender is always a cold render. React's cache dedupes
 * the pair within one render pass; unstable_cache below still handles reuse
 * across requests, and the per-slug tags still drive on-demand revalidation.
 */
async function fetchHerb(
  slug: string,
  locale: Locale
): Promise<ActionResponse<HerbWithInteractions>> {
  const result = await getHerbBySlug(slug, { locale, skipCookies: true });
  // A failed query must never be cached. unstable_cache below would otherwise
  // persist the failure for 24 h and ISR would re-serve it as a prerendered
  // 404. Throwing aborts the cache write, so the route returns a retryable 500
  // and the next request retries the database.
  if (!result.success && result.reason === "unavailable") {
    herbUnavailable(result.error);
  }
  return result;
}

const loadHerb = cache((slug: string, locale: Locale) =>
  fetchHerb(slug, locale)
);

export async function generateStaticParams() {
  // Return before querying: a limit of zero should cost zero database work, and
  // this build runs against the same 0.5 GB instance that serves production.
  if (PRERENDER_HERB_LIMIT === 0) return [];

  const supabase = getAnonClient();
  if (!supabase) {
    logger.warn("generateStaticParams: Supabase not available at build time");
    return [];
  }

  const { data: herbs } = await supabase
    .from("herb_popularity")
    .select("slug")
    .order("views", { ascending: false })
    .limit(PRERENDER_HERB_LIMIT);

  return (herbs ?? []).map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metaLocale = await getLocale();

  const getHerbMetaCached = unstable_cache(
    async (herbSlug: string, locale: string) => {
      return loadHerb(herbSlug, locale as Locale);
    },
    ["herb-meta-" + slug],
    { revalidate: 86400, tags: ["herb-meta-" + slug] }
  );

  const result = await getHerbMetaCached(slug, metaLocale);
  // Only a genuine miss becomes "Herb Not Found" metadata. A failed query is
  // not evidence the herb doesn't exist: propagate it so the route renders a
  // retryable 500 rather than teaching crawlers a 404.
  if (!result.success || !result.data) {
    if (!result.success && result.reason === "unavailable") {
      herbUnavailable(result.error);
    }
    // The page body turns this into a 404 (see resolveHerbOr404 below). There
    // is no loading.tsx above this route precisely so that the status can still
    // be set to 404; a Suspense fallback would flush a 200 shell first.
    return { title: "Herb Not Found | HerbAlly", robots: { index: false } };
  }
  const herb = result.data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const keywords = [
    herb.name,
    herb.scientific_name,
    ...(herb.common_names || []),
    ...(herb.traditional_uses || []).slice(0, 5),
    ...(herb.active_compounds || []).slice(0, 5),
    "medicinal herb",
    "herbal remedy",
    "natural medicine",
  ].filter(Boolean);

  // Title and description come from the `herbMeta` dictionary so a French page
  // does not ship an English snippet. Hardcoding them meant all 2,700 /fr/herbs
  // pages read "…: Benefits, Dosage, Safety & Evidence" and described the herb
  // as "What is Curcuma in English (…)" — a page written for French queries
  // that told the reader the answer was in English.
  const herbT = await getTranslations({
    locale: metaLocale,
    namespace: "herbMeta",
  });
  const commonNames = (herb.common_names || []).slice(0, 3).join(", ");
  // {uses} used to be spliced into the meta description, but those values are
  // clauses ("In Ayurvedic medicine, traditional…"), so every one of the 2,700
  // pages read "Uses for In Ayurvedic medicine, traditional…". The
  // descriptions now describe the page instead of quoting a clause.
  const title = hasDistinctCommonName(herb)
    ? herbT("title", {
        name: herb.name,
        scientific: herb.scientific_name,
      })
    : herbT("titleBinomial", { scientific: herb.scientific_name });
  const description = truncateDescription(
    commonNames
      ? herbT("descWithNames", {
          name: herb.name,
          common: commonNames,
        })
      : herb.description
        ? herbT("descFromBody", { body: herb.description.slice(0, 120) })
        : herbT("descFallback", {
            name: herb.name,
            scientific: herb.scientific_name,
          })
  );

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical:
        metaLocale === "fr"
          ? `${baseUrl}/fr/herbs/${slug}`
          : `${baseUrl}/herbs/${slug}`,
      languages: {
        en: `${baseUrl}/herbs/${slug}`,
        fr: `${baseUrl}/fr/herbs/${slug}`,
        "x-default": `${baseUrl}/herbs/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url:
        metaLocale === "fr"
          ? `${baseUrl}/fr/herbs/${slug}`
          : `${baseUrl}/herbs/${slug}`,
      type: "article",
      siteName: "HerbAlly",
      locale: metaLocale === "fr" ? "fr_FR" : "en_US",
      images: [`${baseUrl}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/twitter-image`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

function getEvidenceLevel(
  level: string | null | undefined
): "A" | "B" | "C" | "D" | "trad" {
  if (level && ["A", "B", "C", "D", "trad"].includes(level))
    return level as "A" | "B" | "C" | "D" | "trad";
  // Default to "trad" (Traditional Use) rather than "C" (Limited Evidence).
  // Most unverified herbs have no clinical evidence data — presenting them
  // as "C - Traditional/preclinical" overstates the evidence basis. "trad"
  // is honest: it says "used traditionally, science may be limited."
  return "trad";
}

interface CitationData {
  source: string;
  title?: string;
  url?: string;
  year?: number;
  pmid?: string;
}

function formatCitations(
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

export default async function HerbDetailPage({ params }: Props) {
  const { slug } = await params;
  const pageLocale = await getLocale();

  const getHerbCached = unstable_cache(
    async (herbSlug: string, locale: Locale) => {
      return loadHerb(herbSlug, locale);
    },
    ["herb-" + slug],
    { revalidate: 86400, tags: ["herb-" + slug] }
  );

  const result = await getHerbCached(slug, pageLocale as Locale);

  const herb = resolveHerbOr404(result);

  // View tracking runs from a client beacon (ViewTracker) instead of a
  // server-side `after()` hook. The old hook fired once per dynamic render —
  // including crawlers, prefetches and repeat views — and drove ~79k UPDATEs
  // against a Nano instance's Disk IO budget. The beacon dedupes per
  // visitor/slug/day and writes through a slug-addressed RPC.

  // Define cached fetcher
  const getMonographCached = unstable_cache(
    async (herbSlug: string) => {
      const supabase = getAnonClient();
      if (!supabase) return null;
      const { data: dbMonograph } = await supabase
        .from("herb_monographs")
        .select(
          "summary, mechanism, claims, safety_notes, drug_interactions, pregnancy_category, key_citations, status"
        )
        .eq("herb_slug", herbSlug)
        .eq("status", "published")
        .single();
      return dbMonograph;
    },
    [`monograph-${slug}`],
    { revalidate: 86400, tags: [`monograph-${slug}`] }
  );

  // PubMed-compiled information sheet (for herbs with no hand-written
  // monograph). Cached like the monograph; anon-readable via RLS.
  const getPubmedSheetCached = unstable_cache(
    async (herbSlug: string) => {
      const supabase = getAnonClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from("herb_pubmed_monographs")
        .select("content, citations, pmids, article_count, model, status")
        .eq("slug", herbSlug)
        .single();
      return data;
    },
    [`pubmed-sheet-${slug}`],
    // 1h revalidate so newly-written PubMed sheets appear without waiting the
    // full day; on-demand revalidation (/api/revalidate-pubmed-sheet) makes a
    // freshly compiled sheet appear instantly.
    { revalidate: 3600, tags: [`pubmed-sheet-${slug}`] }
  );

  // Independent reads — firing them together removes a serial round trip from
  // every cold render (i.e. from every prerender and every ISR regeneration).
  const [dbMonograph, pubmedSheet] = await Promise.all([
    getMonographCached(slug),
    getPubmedSheetCached(slug),
  ]);

  // Parse provenance to determine if this herb's content has been verified
  const provenance = parseProvenance(
    herb.provenance as Record<string, unknown> | null
  );
  // Only manually reviewed or primary-source-backed herbs have verified
  // mechanism text. Both "unverified" (no sources, no citations) and
  // "ai_summarized" (has PubMed citations but no authoritative monograph
  // match) have AI-generated mechanism text that was never checked against
  // primary literature.
  const isNotManuallyVerified =
    provenance.verification_method === "unverified" ||
    provenance.verification_method === "ai_summarized";

  let monograph: Monograph | null = null;
  // Option B: only herbs with a hand-written (human-authored) monograph show
  // the rich narrative. Every other herb renders the government-sourced view
  // (government sources + PubMed citations) instead of AI-generated text.
  const isManualMonograph = hasManualMonograph(slug);
  // Effective human-review status for this render. The hero badge and the
  // "Reviewed by" attribution below must agree with what is actually shown:
  // an unreviewed PubMed sheet vetoes a "Verified" claim from the herb row,
  // and an unverified entry must not borrow the editorial-team fallback as
  // its reviewer. No production data is changed — this is a rendering gate.
  const sheetNotReviewed =
    !isManualMonograph &&
    !!pubmedSheet?.content &&
    pubmedSheet.status !== "reviewed";
  const humanReviewed = isVerified(provenance) && !sheetNotReviewed;
  if (dbMonograph) {
    // Option B: the rich narrative is only RENDERED for herbs with a
    // hand-written monograph (see the tabs gate). The monograph object is
    // still built so references/SEO metadata stay consistent.
    monograph = {
      slug,
      summary: dbMonograph.summary,
      mechanism: dbMonograph.mechanism,
      claims: dbMonograph.claims as Monograph["claims"],
      safetyNotes: dbMonograph.safety_notes as Monograph["safetyNotes"],
      drugInteractions:
        dbMonograph.drug_interactions as Monograph["drugInteractions"],
      pregnancyCategory:
        dbMonograph.pregnancy_category as Monograph["pregnancyCategory"],
      keyCitations: dbMonograph.key_citations as Monograph["keyCitations"],
    };

    // For herbs without manual verification, override the fabricated
    // mechanism text with an honest disclosure. The stored DB monographs
    // were AI-generated with specific molecular pathway claims (e.g.
    // "modulates NF-κB, COX-2") that were never verified against primary
    // literature. Don't present them as fact.
    if (isNotManuallyVerified && monograph.mechanism) {
      monograph.mechanism = `The specific molecular targets and pharmacokinetic pathways by which the active compounds of ${herb.name} exert their reported effects have not been verified against primary literature for this entry. This monograph was generated by AI and has not yet been reviewed against authoritative sources. Consult PubMed or a qualified pharmacognosist for evidence-based mechanism data.`;
    }
    // Also override the summary if it contains specific clinical claims
    // that weren't verified
    if (isNotManuallyVerified && monograph.summary) {
      // Only prepend the disclaimer if the summary doesn't already mention it
      if (
        !/not been verified/i.test(monograph.summary) &&
        !/AI-generated/i.test(monograph.summary)
      ) {
        monograph.summary = `${monograph.summary} (This summary was AI-generated and has not been verified against primary sources.)`;
      }
    }
  }

  if (!monograph) {
    monograph = generateMonograph({
      ...herb,
      citations: herb.citations as unknown[] | null | undefined,
    });
  }

  const interactions = (herb.drug_interactions ||
    []) as import("@/components/herbs/interactions-table").Interaction[];

  // Fetch pre-generated FAQs for Featured Snippet optimization.
  // Overlays translations.fr (question/answer) on French pages; falls back
  // to English per-field so partially translated rows never blank out.
  // Locale is a parameter (not a closure over the later `locale` const) and
  // part of the cache key so EN/FR entries can't poison each other.
  const getFaqsCached = unstable_cache(
    async (herbId: string, faqLocale: string) => {
      const supabase = getAnonClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from("herb_faqs")
        .select("question, answer, category, translations")
        .eq("herb_id", herbId)
        .order("sort_order", { ascending: true })
        .limit(6);
      const rows = (data || []) as unknown as Array<{
        question: string;
        answer: string;
        category?: string;
        translations?: {
          fr?: { question?: string; answer?: string };
        } | null;
      }>;
      if (faqLocale !== "fr") return rows;
      return rows.map((r) => ({
        ...r,
        question: r.translations?.fr?.question || r.question,
        answer: r.translations?.fr?.answer || r.answer,
      }));
    },
    [`herb-faqs-${slug}`],
    { revalidate: 86400, tags: [`herb-faqs-${slug}`] }
  );

  const preGeneratedFaqs = await getFaqsCached(herb.id, await getLocale());

  const severityCounts = {
    contraindicated: interactions.filter(
      (i) => i.severity === "contraindicated"
    ).length,
    severe: interactions.filter((i) => i.severity === "severe").length,
    moderate: interactions.filter((i) => i.severity === "moderate").length,
    mild: interactions.filter((i) => i.severity === "mild").length,
  };

  const evidenceLevel = getEvidenceLevel(herb.evidence_level);

  // Default locale for static generation; client-side locale switching handles user prefs
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const tFaq = await getTranslations({ locale, namespace: "herbFaq" });
  // Same `herbMeta` title the <title> tag uses, so the JSON-LD name and the
  // share text are not English sentences on a French page.
  const tHerbMeta = await getTranslations({ locale, namespace: "herbMeta" });
  const herbMetaTitle = hasDistinctCommonName(herb)
    ? tHerbMeta("title", {
        name: herb.name,
        scientific: herb.scientific_name,
      })
    : tHerbMeta("titleBinomial", { scientific: herb.scientific_name });
  // Structured data must point at the URL this page actually serves. It used to
  // hardcode the English paths, so every /fr/herbs/* page declared a canonical
  // elsewhere in its own JSON-LD and English breadcrumb labels.
  const herbPageUrl = `${siteUrl()}${addLocalePrefix(`/herbs/${slug}`, locale)}`;
  const herbCrumbs = [
    {
      name: t("seo.breadcrumbHome"),
      url: `${siteUrl()}${addLocalePrefix("/", locale)}`,
    },
    {
      name: t("nav.herbs"),
      url: `${siteUrl()}${addLocalePrefix("/herbs", locale)}`,
    },
    { name: herb.name, url: herbPageUrl },
  ];

  // Localized fallback FAQs, shared with the visible section via the same
  // builder so JSON-LD and content match in both languages.
  const fallbackFaqInput = {
    herbName: herb.name,
    scientificName: herb.scientific_name,
    uses: [...(herb.traditional_uses || []), ...(herb.modern_uses || [])],
    safetyNotes:
      monograph?.safetyNotes?.join(". ") || herb.side_effects?.join(". ") || "",
    pregnancyCategory: monograph?.pregnancyCategory || "insufficient",
    drugInteractions: interactions.length,
    commonNames: herb.common_names || [],
  };
  const fallbackFaqs = buildHerbFallbackFaqs(fallbackFaqInput, (key, params) =>
    tFaq(key as never, params as never)
  );

  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null,
    t
  );
  // A review attribution needs a named, registered reviewer. Every herb row
  // carries the generic string "HerbAlly Editorial Team", which is not a
  // person and cannot be shown as a byline or emitted as a schema.org Person:
  // that would claim review by a body nobody can name. Until a real reviewer
  // is registered for a herb, the page shows its author and leaves review
  // unclaimed. `last_reviewed` is tied to the same condition — the current
  // value is one bulk date stamped across all 2,699 rows, so it is a
  // data-entry artifact, not evidence that anything was reviewed.
  const registeredReviewer = getReviewer(herb.reviewed_by);
  const lastReviewed =
    registeredReviewer && herb.last_reviewed
      ? new Date(herb.last_reviewed).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : undefined;
  const reviewedBy = registeredReviewer?.name;
  const reviewerCredentials = registeredReviewer?.credentials;

  // Related herbs: the category query is the only un-cached Supabase fetch on
  // this page (every other query uses tagged `fetch`/`unstable_cache`). Wrap
  // it in unstable_cache so it shares the page's 86400s revalidation window and
  // can be purged via the `related-herbs-<slug>` tag instead of re-running on
  // every daily regeneration. `getComparisonHerbs` is a pure in-memory ranker,
  // so it runs inside the cache to cache the final ranked result.
  const getRelatedHerbs = unstable_cache(
    async (herbSlug: string, categoryId: string | null) => {
      const supabaseClient = getAnonClient();
      if (!supabaseClient) return [];
      let relatedQuery = supabaseClient
        .from("herbs")
        .select(
          "name, slug, scientific_name, symptom_keywords, traditional_uses"
        )
        .eq("is_published", true);
      if (categoryId) {
        relatedQuery = relatedQuery.eq("category_id", categoryId);
      }
      const { data: categoryHerbs } = await relatedQuery;
      if (!categoryHerbs) return [];
      return getComparisonHerbs(herbSlug, categoryHerbs, 3);
    },
    ["related-herbs-" + slug],
    { revalidate: 86400, tags: ["related-herbs-" + slug] }
  );

  let relatedHerbs: Array<{
    name: string;
    slug: string;
    scientific_name: string;
  }> = [];
  try {
    relatedHerbs = await getRelatedHerbs(slug, herb.category_id ?? null);
  } catch {
    // swallow — related herbs are non-critical
  }

  // Structure rails. The A–Z neighbours are guaranteed and turn 2,700
  // otherwise-isolated pages into a crawlable chain; the symptom peers are the
  // relevance signal that actually varies across the library.
  const [{ prev, next }, symptomPeers] = await Promise.all([
    getAlphabeticalNeighbours(herb.name, slug),
    getSymptomPeers(slug, (herb.symptom_keywords as string[] | null) ?? null),
  ]);

  return (
    <div className="space-y-8">
      <ViewTracker slug={slug} />
      <WebPageSchema
        title={herbMetaTitle}
        description={herb.description ?? `Learn about ${herb.name}`}
        url={herbPageUrl}
        dateModified={herb.last_reviewed ?? herb.updated_at ?? undefined}
        breadcrumbs={herbCrumbs}
      />
      <BreadcrumbListSchema items={herbCrumbs} />
      <HerbSchema herb={herb} url={herbPageUrl} />
      <HerbFAQSchema
        herbName={herb.name}
        scientificName={herb.scientific_name}
        uses={[...(herb.traditional_uses || []), ...(herb.modern_uses || [])]}
        safetyNotes={
          monograph?.safetyNotes?.join(". ") ||
          herb.side_effects?.join(". ") ||
          ""
        }
        pregnancyCategory={monograph?.pregnancyCategory || "insufficient"}
        drugInteractions={interactions.length}
        preGeneratedFaqs={
          preGeneratedFaqs.length > 0 ? preGeneratedFaqs : undefined
        }
        fallbackFaqs={fallbackFaqs}
      />

      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { name: t("common.breadcrumbHome"), href: "/" },
          { name: t("nav.herbs"), href: "/herbs" },
          { name: herb.name },
        ]}
      />

      {/* Back Button */}
      <Button variant="ghost" size="sm" render={<Link href="/herbs" />}>
        <ArrowLeft className="size-4" />
        {t("herbDetail.backToHerbs")}
      </Button>

      {/* Medical Disclaimer */}
      <p className="text-xs text-muted-foreground italic">
        {t("herbDetail.medicalDisclaimerText")}
      </p>

      {/* New Hero */}
      {/* Safety-first: lethal plants (abrin, aconite…) get a hard "do not
          use" banner above the fold, before any hero/benefits content. */}
      <DangerousHerbBanner slug={slug} />
      <HerbHeroV2
        herb={{ ...herb, evidence_level: evidenceLevel }}
        provenance={herb.provenance as Record<string, unknown> | null}
        pubmedSheetStatus={pubmedSheet?.content ? pubmedSheet.status : null}
        isManualMonograph={isManualMonograph}
        interactions={interactions.map((i) => ({
          drug_name: i.drug_name,
          severity: i.severity,
        }))}
        safetyHref="#interactions"
      />

      {/* The hero's chips read "Evidence: A" next to "Not human-reviewed";
          they measure different things. This is the explanation, collapsed so
          it costs one line on a page where safety leads. */}
      <ChipLegend className="-mt-4" />

      {/* Accountable author. Health pages are judged on who stands behind
          them, and this site's byline previously read "Editorial Team". */}
      <AuthorByline
        locale={locale === "fr" ? "fr" : "en"}
        lastReviewed={herb.last_reviewed ?? herb.updated_at ?? null}
      />

      {/* Only the twelve herbs with a licensed photograph render anything. */}
      <HerbPhoto slug={slug} name={herb.name} className="mt-2" />

      {/* Personalized interaction warning (H1). Client component so the ISR
          page stays static for anonymous traffic; signed-in users get a
          personalized alert after hydration based on their medication list. */}
      <UserInteractionAlert herbSlug={slug} />

      {/* Known interactions, in the flow of the page.
          On a monograph this table used to exist only inside the "Safety"
          tab — the reason most visitors arrive was one click away, and the
          hero's "see the full list" link only opened a tab. It now sits above
          the tabs so it is on the page, in the DOM, and in the printout. The
          safety panel no longer repeats it. */}
      {interactions.length > 0 && (
        <section id="interactions" className="scroll-mt-24">
          <InteractionsTable interactions={interactions} herbSlug={slug} />
        </section>
      )}

      {/* Tabbed Content — only hand-written monographs show the narrative
          tabs; every other herb renders the government-sourced view (Option B)
          so no AI-generated content is displayed. */}
      {isManualMonograph ? (
        <HerbDetailTabs
          tabs={[
            {
              key: "overview",
              content: (
                <HerbOverviewPanel
                  herb={herb}
                  monograph={monograph}
                  lastReviewed={lastReviewed}
                  reviewedBy={reviewedBy}
                />
              ),
            },
            { key: "uses", content: <HerbUsesPanel herb={herb} /> },
            {
              key: "science",
              content: <HerbSciencePanel herb={herb} monograph={monograph} />,
            },
            { key: "dosage", content: <HerbDosagePanel herb={herb} /> },
            {
              key: "safety",
              content: (
                <HerbSafetyPanel
                  herb={herb}
                  interactions={interactions}
                  severityCounts={severityCounts}
                  showInteractions={false}
                />
              ),
            },
          ]}
        />
      ) : (
        <>
          {/* Option B: no hand-written monograph. If a PubMed-compiled sheet
              exists, show it (AI-assisted, every claim cited to a PubMed
              article). Otherwise show the government-sources stub. Either
              way, curated (non-AI) interaction data is shown when present. */}
          {pubmedSheet?.content ? (
            <PubmedMonographSheet
              content={pubmedSheet.content as unknown as SheetContent}
              citations={(pubmedSheet.citations as unknown as Citation[]) ?? []}
              articleCount={pubmedSheet.article_count ?? 0}
              model={pubmedSheet.model}
              status={pubmedSheet.status}
            />
          ) : (
            <GovSourcedBanner />
          )}
          {interactions.length > 0 && (
            /* Anchor for the hero's "See the full list" link. */
            <div id="safety" className="scroll-mt-24">
              <HerbSafetyPanel
                herb={herb}
                interactions={interactions}
                severityCounts={severityCounts}
                showInteractions={false}
              />
            </div>
          )}
        </>
      )}

      {/* Clearly labelled advertising on public herb reference pages only.
          No ad unit is shown unless NEXT_PUBLIC_ADSENSE_CLIENT and
          NEXT_PUBLIC_ADSENSE_SLOT_HERB are configured. Private tools (chat,
          interaction checker, calculator) never render this component. */}
      <AdSlot
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HERB}
        format="auto"
        className="my-8 min-h-[100px] no-print"
      />

      {/* Citations */}
      <section className="pt-4">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
          {t("herbDetail.sourcesAndCitations")}
        </h2>
        <CitationsList citations={citations} />
      </section>

      <SourceAttribution
        reviewedBy={reviewedBy}
        reviewerCredentials={reviewerCredentials}
        lastReviewed={lastReviewed}
      />

      {/* Government sources — the credible source-of-truth layer. Direct
          NCCIH/NIH monograph links where mapped; honest notice when no
          government monograph covers this herb. */}
      <GovSources slug={slug} displayName={herb.name} />

      {/* Visible FAQ — must match HerbFAQSchema Q&A above or Google ignores
          the FAQPage rich result (Search Appearance = No data, Sep 2026).
          Also targets converting intents: "X in english", dosage/calculator. */}
      <HerbFaqSection
        herbName={herb.name}
        scientificName={herb.scientific_name}
        uses={[...(herb.traditional_uses || []), ...(herb.modern_uses || [])]}
        safetyNotes={
          monograph?.safetyNotes?.join(". ") ||
          herb.side_effects?.join(". ") ||
          ""
        }
        pregnancyCategory={monograph?.pregnancyCategory || "insufficient"}
        drugInteractions={interactions.length}
        commonNames={herb.common_names || []}
        preGeneratedFaqs={
          preGeneratedFaqs.length > 0 ? preGeneratedFaqs : undefined
        }
      />

      {/* Calculator CTA — /calculator is the #1 converting page (4 clicks /
          92 imp). Funnel every herb view toward it with a crawlable link. */}
      <section
        aria-label={t("herbDetail.calculatorCtaTitle", { name: herb.name })}
        className="rounded-2xl border bg-muted/50 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">
              {t("herbDetail.calculatorCtaTitle", { name: herb.name })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("herbDetail.calculatorCtaBody")}
            </p>
          </div>
          <Button
            variant="outline"
            render={<Link href={`/calculator?herb=${slug}`} />}
          >
            {t("herbDetail.calculateDose")}
          </Button>
        </div>
      </section>

      {/* Share buttons */}
      <ShareButtons
        title={`${herbMetaTitle} - HerbAlly`}
        url={herbPageUrl}
        className="pt-4 no-print"
      />

      <section aria-labelledby="internal-links-heading" className="pt-4">
        <h2 id="internal-links-heading" className="sr-only">
          {t("herbDetail.relatedHerbs")}
        </h2>
        <InternalLinkRail
          locale={locale === "fr" ? "fr" : "en"}
          herbSlug={slug}
          interactions={interactions.map((i) => ({
            drug_name: i.drug_name,
            severity: i.severity,
          }))}
          prev={prev}
          next={next}
          peers={symptomPeers}
        />
      </section>

      {/* Related Herbs */}
      {relatedHerbs.length > 0 && (
        <section aria-labelledby="related-herbs-heading" className="pt-4">
          <h2
            id="related-herbs-heading"
            className="mb-4 text-xl font-semibold text-foreground"
          >
            {t("herbDetail.relatedHerbs")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedHerbs.map((related) => (
              <Link
                key={related.slug}
                href={`/herbs/${related.slug}`}
                className="group rounded-2xl border p-4 transition-colors hover:bg-muted/50"
              >
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {related.name}
                </h3>
                <p className="text-sm italic text-muted-foreground">
                  {related.scientific_name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The one place on the site that asks for something back. A visitor who
          has just read an interaction wants to know when it changes; without
          this, every one of them leaves and is never reachable again. */}
      <NewsletterSignup locale={locale === "fr" ? "fr" : "en"} />
    </div>
  );
}
