import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { unstable_cache } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ShareButtons } from "@/components/shared/share-buttons";
import { HerbSchema } from "@/components/seo/herb-schema";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { CitationsList, SourceAttribution } from "@/components/herbs/citations";
import { generateMonograph } from "@/lib/data/generate-monograph";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import { siteUrl } from "@/lib/seo/site-url";
import type { Monograph } from "@/lib/data/monographs";
import { parseProvenance } from "@/lib/types/provenance";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { type Locale } from "@/lib/i18n/config";

import { HerbHeroV2 } from "@/components/herbs/herb-hero-v2";
import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import { HerbOverviewPanel } from "@/components/herbs/herb-overview-panel";
import { HerbUsesPanel } from "@/components/herbs/herb-uses-panel";
import { HerbSciencePanel } from "@/components/herbs/herb-science-panel";
import { HerbDosagePanel } from "@/components/herbs/herb-dosage-panel";
import { HerbSafetyPanel } from "@/components/herbs/herb-safety-panel";
import { UserInteractionAlert } from "@/components/herbs/user-interaction-alert";
import { GovSources } from "@/components/herbs/gov-sources";
import { GovSourcedBanner } from "@/components/herbs/gov-sourced-banner";
import { hasManualMonograph } from "@/lib/data/monographs";

// REMOVED: export const dynamic = "force-dynamic";
// This enables static generation (SSG) for every herb page at build time.
// All 1,000+ herb pages are now pre-rendered as static HTML for instant load.

type Props = { params: Promise<{ slug: string }> };

/**
 * Static generation for all published herb pages.
 * Pre-builds top 200 herb pages at deploy time; others render on-demand (cached).
 */
export const revalidate = 86400; // ISR: regenerate once per day

export async function generateStaticParams() {
  const supabase = getAnonClient();
  if (!supabase) {
    logger.warn("generateStaticParams: Supabase not available at build time");
    return [];
  }

  // Pre-render top 200 most-viewed herbs at build time for fast deploy.
  // Remaining ~2,500 herbs render on-demand on first visit (cached as static HTML).
  const { data: herbs } = await supabase
    .from("herbs")
    .select("slug")
    .eq("is_published", true)
    .order("view_count", { ascending: false })
    .limit(200);

  return (herbs ?? []).map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metaLocale = await getLocaleFromRequest();

  const getHerbMetaCached = unstable_cache(
    async (herbSlug: string, locale: string) => {
      return getHerbBySlug(herbSlug, { locale, skipCookies: true });
    },
    ["herb-meta-" + slug],
    { revalidate: 86400, tags: ["herb-meta-" + slug] }
  );

  const result = await getHerbMetaCached(slug, metaLocale);
  if (!result.success || !result.data) {
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

  return {
    title: `${herb.name} (${herb.scientific_name}) - Medicinal Herb Guide`,
    description: herb.description
      ? `${herb.description.slice(0, 155)}${herb.description.length > 155 ? "..." : ""}`
      : `Learn about ${herb.name} (${herb.scientific_name}) - uses, dosage, safety, and drug interactions.`,
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
      title: `${herb.name} (${herb.scientific_name})`,
      description: herb.description?.slice(0, 160) || undefined,
      url:
        metaLocale === "fr"
          ? `${baseUrl}/fr/herbs/${slug}`
          : `${baseUrl}/herbs/${slug}`,
      type: "article",
      siteName: "HerbAlly",
      images: [`${baseUrl}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${herb.name} - Medicinal Herb`,
      description: herb.description?.slice(0, 160) || undefined,
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
  const pageLocale = await getLocaleFromRequest();

  const getHerbCached = unstable_cache(
    async (herbSlug: string, locale: Locale) => {
      return getHerbBySlug(herbSlug, { locale, skipCookies: true });
    },
    ["herb-" + slug],
    { revalidate: 86400, tags: ["herb-" + slug] }
  );

  const result = await getHerbCached(slug, pageLocale as Locale);

  if (!result.success || !result.data) {
    notFound();
  }

  const herb = result.data;

  after(async () => {
    if (!herb.id) return;
    // L-2 (audit 2026-06-22): increment_herb_view EXECUTE was revoked from
    // anon/authenticated (migration 00046) to close a direct-RPC view-count
    // inflation vector. Call it via the service role; the service key may be
    // absent in local dev, in which case we silently skip — view tracking is
    // non-critical and must never break the page render.
    try {
      const admin = createAdminClient();
      await admin.rpc("increment_herb_view", { herb_id: herb.id });
    } catch {
      /* service role unavailable — skip view-count increment */
    }
  });

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

  const dbMonograph = await getMonographCached(slug);

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

  // Fetch pre-generated FAQs for Featured Snippet optimization
  const getFaqsCached = unstable_cache(
    async (herbId: string) => {
      const supabase = getAnonClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from("herb_faqs")
        .select("question, answer, category")
        .eq("herb_id", herbId)
        .order("sort_order", { ascending: true })
        .limit(6);
      return data || [];
    },
    [`herb-faqs-${slug}`],
    { revalidate: 86400, tags: [`herb-faqs-${slug}`] }
  );

  const preGeneratedFaqs = await getFaqsCached(herb.id);

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
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null,
    t
  );
  const lastReviewed = herb.last_reviewed
    ? new Date(herb.last_reviewed).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : herb.updated_at
      ? new Date(herb.updated_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : undefined;
  const reviewedBy = herb.reviewed_by || t("herbDetailContent.editorialTeam");
  const reviewerCredentials =
    herb.reviewer_credentials || t("herbDetailContent.editorialCredentials");

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

  return (
    <div className="space-y-8">
      <WebPageSchema
        title={`${herb.name} (${herb.scientific_name}) - Medicinal Herb Guide`}
        description={herb.description ?? `Learn about ${herb.name}`}
        url={`${siteUrl()}/herbs/${slug}`}
        dateModified={herb.last_reviewed ?? herb.updated_at ?? undefined}
        breadcrumbs={[
          { name: "Home", url: siteUrl() },
          { name: "Herbs", url: `${siteUrl()}/herbs` },
          { name: herb.name, url: `${siteUrl()}/herbs/${slug}` },
        ]}
      />
      <HerbSchema herb={herb} />
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
      <HerbHeroV2
        herb={{ ...herb, evidence_level: evidenceLevel }}
        provenance={herb.provenance as Record<string, unknown> | null}
      />

      {/* Personalized interaction warning (H1). Client component so the ISR
          page stays static for anonymous traffic; signed-in users get a
          personalized alert after hydration based on their medication list. */}
      <UserInteractionAlert herbSlug={slug} />

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
                />
              ),
            },
          ]}
        />
      ) : (
        <>
          {/* Option B: no hand-written monograph — do not show AI-generated
              narrative. Surface government sources + PubMed citations + any
              curated (non-AI) interaction data below. */}
          <GovSourcedBanner />
          {interactions.length > 0 && (
            <HerbSafetyPanel
              herb={herb}
              interactions={interactions}
              severityCounts={severityCounts}
            />
          )}
        </>
      )}

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

      {/* Share buttons */}
      <ShareButtons
        title={`${herb.name} (${herb.scientific_name}) - HerbAlly`}
        url={`${siteUrl()}/herbs/${slug}`}
        className="pt-4"
      />

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
    </div>
  );
}
