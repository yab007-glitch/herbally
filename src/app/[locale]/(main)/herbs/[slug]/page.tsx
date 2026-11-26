import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { unstable_cache } from "next/cache";
import { isUsablePubmedSheet } from "@/lib/pubmed/usable";
import { resolveSheetContent } from "@/lib/i18n/sheet-content";
import type { SheetContent } from "@/components/herbs/pubmed-monograph-sheet";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ShareButtons } from "@/components/shared/share-buttons";
import { HerbSchema } from "@/components/seo/herb-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";
import { HerbFaqSection } from "@/components/herbs/herb-faq-section";
import { AuthorByline } from "@/components/herbs/author-byline";
import { HerbPhoto } from "@/components/herbs/herb-photo";
import { HerbJumpNav } from "@/components/herbs/herb-jump-nav";
import { HerbRegulatorExcerpts } from "@/components/herbs/herb-regulator-excerpts";
import { HerbBodyContent } from "@/components/herbs/herb-body-content";
import { HerbRelatedSection } from "@/components/herbs/herb-related-grid";
import { NewsletterSignup } from "@/components/marketing/newsletter-signup";
import {
  getAlphabeticalNeighbours,
  getSymptomPeers,
} from "@/lib/data/internal-links";
import { CitationsList, SourceAttribution } from "@/components/herbs/citations";
import { generateMonograph } from "@/lib/data/generate-monograph";
import { siteUrl } from "@/lib/seo/site-url";
import { truncateDescription } from "@/lib/seo/truncate-description";
import { fitTitle } from "@/lib/seo/fit-title";
import { hasDistinctCommonName } from "@/lib/seo/herb-naming";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { hasManualMonograph, type Monograph } from "@/lib/data/monographs";
import { parseProvenance, getReviewState } from "@/lib/types/provenance";
import { herbUnavailable, resolveHerbOr404 } from "@/lib/herbs/resolve-herb";
import {
  localizeHerb,
  localizeInteraction,
  redactPublicHerbFields,
} from "@/lib/utils/localize-herb";
import type { HerbWithInteractions } from "@/lib/types";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { HerbsMessagesProvider } from "@/components/i18n/herbs-messages-provider";
import { type Locale } from "@/lib/i18n/config";
import { herbPageCopy } from "@/lib/i18n/herb-page-copy";
import {
  HERB_PAGE_TTL,
  PRERENDER_HERB_LIMIT,
  computeLatestModified,
  formatCitations,
  getEvidenceLevel,
  loadFaqsCached,
  loadHerb,
  loadHerbPageBundle,
  loadMonographCached,
  loadPubmedSheetCached,
  loadRegulatoryEvidence,
  loadRelatedHerbs,
  loadSourcesCached,
  type CitationData,
} from "@/lib/herbs/herb-page-data";
import { HerbHeroV2 } from "@/components/herbs/herb-hero-v2";
import { DangerousHerbBanner } from "@/components/herbs/dangerous-herb-banner";
import { HerbNarrative } from "@/components/herbs/herb-narrative";
import { InteractionsTable } from "@/components/herbs/interactions-table";
import { AdSlot } from "@/components/ads/ad-slot";
import { AdCmp } from "@/components/ads/ad-cmp";
import { CmpBootstrap } from "@/components/ads/cmp-bootstrap";
import { UserInteractionAlert } from "@/components/herbs/user-interaction-alert";
import { ViewTracker } from "@/components/herbs/view-tracker";
import { GovSources } from "@/components/herbs/gov-sources";
import { RegulatoryEvidenceSection } from "@/components/herbs/regulatory-evidence";
import { compactRegulatoryEvidence } from "@/lib/herbs/regulatory-evidence";
import { HerbSources } from "@/components/herbs/herb-sources";
import { resolvePublicReviewerFromDb } from "@/lib/data/reviewers";
import {
  canShowDoseCalculator,
  isDangerousHerb,
} from "@/lib/data/dangerous-herbs";
import { matchGuidesForHerb } from "@/lib/guides/match-herb-guides";

// ISR: locale comes from [locale] param and no page-level code reads a request API.
export const revalidate = 259200;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (PRERENDER_HERB_LIMIT === 0) return [];

  const supabase = getAnonClient();
  if (!supabase) {
    logger.warn("generateStaticParams: Supabase not available at build time");
    return [];
  }

  const { data: herbs, error } = await supabase
    .from("herb_popularity")
    .select("slug")
    .order("views", { ascending: false })
    .limit(PRERENDER_HERB_LIMIT);

  if (error) {
    logger.error("generateStaticParams: herb_popularity unavailable", {
      error: error.message,
    });
  }

  return (herbs ?? []).map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metaLocale = await getLocale();
  const bundle = await loadHerbPageBundle(slug);

  let herb: HerbWithInteractions;
  if (bundle?.herb) {
    herb = localizeHerb(
      bundle.herb as unknown as HerbWithInteractions,
      metaLocale
    );
  } else {
    const getHerbMetaCached = unstable_cache(
      async (herbSlug: string, locale: string) => {
        return loadHerb(herbSlug, locale as Locale);
      },
      ["herb-meta-v3-" + slug],
      { revalidate: HERB_PAGE_TTL, tags: ["herb-meta-" + slug] }
    );

    const result = await getHerbMetaCached(slug, metaLocale);
    if (!result.success || !result.data) {
      if (!result.success && result.reason === "unavailable") {
        herbUnavailable(result.error);
      }
      return {
        title: { absolute: "Herb Not Found | HerbAlly" },
        robots: { index: false },
      };
    }
    herb = result.data;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const frRecord = (herb.translations as Record<string, unknown> | null)?.fr;
  const hasFr =
    !!frRecord &&
    typeof frRecord === "object" &&
    Object.keys(frRecord).length > 0;
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

  const herbT = await getTranslations({
    locale: metaLocale,
    namespace: "herbMeta",
  });
  const commonNames = (herb.common_names || []).slice(0, 3).join(", ");
  const scientific = herb.scientific_name;
  const title = hasDistinctCommonName(herb)
    ? herbT("title", { name: herb.name, scientific })
    : herbT("titleBinomial", { scientific });
  const titleMeta = fitTitle(
    hasDistinctCommonName(herb)
      ? [
          title,
          herbT("titleShort", { name: herb.name, scientific }),
          `${herb.name} (${scientific})`,
          herb.name,
        ]
      : [title, herbT("titleBinomialShort", { scientific }), scientific]
  );

  const description = commonNames
    ? truncateDescription(
        herbT("descWithNames", {
          name: herb.name,
          common: commonNames,
        })
      )
    : herb.description
      ? truncateDescription(herb.description)
      : truncateDescription(
          herbT("descFallback", {
            name: herb.name,
            scientific: herb.scientific_name,
          })
        );

  // Owner policy 2026-11-23: every published herb page is indexable. The
  // sourced/thin gate was removed here and in the sitemap so the robots
  // directive and the advertised set agree across the whole catalogue.
  return {
    title: titleMeta,
    description,
    keywords,
    alternates: hasFr
      ? {
          canonical:
            metaLocale === "fr"
              ? `${baseUrl}/fr/herbs/${slug}`
              : `${baseUrl}/herbs/${slug}`,
          languages: {
            en: `${baseUrl}/herbs/${slug}`,
            fr: `${baseUrl}/fr/herbs/${slug}`,
            "x-default": `${baseUrl}/herbs/${slug}`,
          },
        }
      : {
          canonical: `${baseUrl}/herbs/${slug}`,
          languages: {
            en: `${baseUrl}/herbs/${slug}`,
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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

export default async function HerbDetailPage({ params }: Props) {
  const { slug } = await params;
  const pageLocale = await getLocale();
  const bundle = await loadHerbPageBundle(slug);

  let herb: HerbWithInteractions;
  if (
    bundle?.herb &&
    Array.isArray((bundle.herb as Record<string, unknown>).drug_interactions)
  ) {
    const localized = redactPublicHerbFields(
      localizeHerb(bundle.herb as unknown as HerbWithInteractions, pageLocale)
    );
    herb = {
      ...localized,
      drug_interactions: (localized.drug_interactions || []).map((ix) =>
        localizeInteraction(ix, pageLocale)
      ),
    };
  } else {
    const getHerbCached = unstable_cache(
      async (herbSlug: string, locale: Locale) => loadHerb(herbSlug, locale),
      ["herb-v9-" + slug],
      { revalidate: HERB_PAGE_TTL, tags: ["herb-" + slug] }
    );
    herb = resolveHerbOr404(await getHerbCached(slug, pageLocale as Locale));
  }

  const [
    sources,
    dbMonograph,
    pubmedSheet,
    preGeneratedFaqs,
    regulatoryEvidence,
  ] = await Promise.all([
    loadSourcesCached(slug),
    loadMonographCached(slug),
    loadPubmedSheetCached(slug),
    loadFaqsCached(slug, pageLocale),
    loadRegulatoryEvidence(slug),
  ]);

  const provenance = parseProvenance(
    herb.provenance as Record<string, unknown> | null
  );
  const verifiedSources: string[] = (() => {
    const raw = herb.provenance as {
      verified_sources?: unknown;
      sources?: unknown;
    } | null;
    const pick = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    const list = pick(raw?.verified_sources);
    return list.length ? list : pick(raw?.sources);
  })();
  const isNotManuallyVerified =
    provenance.verification_method === "unverified" ||
    provenance.verification_method === "ai_summarized";

  const isManualMonograph =
    hasManualMonograph(slug) ||
    (dbMonograph?.status === "published" &&
      (dbMonograph.generation_method === "manual" ||
        Boolean(dbMonograph.reviewed_by)));

  let monograph: Monograph | null = null;
  if (dbMonograph) {
    const builtMonograph: Monograph = {
      slug,
      summary: (dbMonograph.summary as string) ?? "",
      mechanism: (dbMonograph.mechanism as string) ?? "",
      claims: dbMonograph.claims as Monograph["claims"],
      safetyNotes: dbMonograph.safety_notes as Monograph["safetyNotes"],
      drugInteractions:
        dbMonograph.drug_interactions as Monograph["drugInteractions"],
      pregnancyCategory:
        dbMonograph.pregnancy_category as Monograph["pregnancyCategory"],
      keyCitations: dbMonograph.key_citations as Monograph["keyCitations"],
    };
    monograph = builtMonograph;

    if (isNotManuallyVerified && builtMonograph.mechanism) {
      builtMonograph.mechanism = `The specific molecular targets and pharmacokinetic pathways by which the active compounds of ${herb.name} exert their reported effects have not been verified against primary literature for this entry. This monograph was generated by AI and has not yet been reviewed against authoritative sources. Consult PubMed or a qualified pharmacognosist for evidence-based mechanism data.`;
    }
    if (isNotManuallyVerified && builtMonograph.summary) {
      if (
        !/not been verified/i.test(builtMonograph.summary) &&
        !/AI-generated/i.test(builtMonograph.summary)
      ) {
        builtMonograph.summary = `${builtMonograph.summary} (This summary was AI-generated and has not been verified against primary sources.)`;
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

  const severityCounts = {
    contraindicated: interactions.filter(
      (i) => i.severity === "contraindicated"
    ).length,
    severe: interactions.filter((i) => i.severity === "severe").length,
    moderate: interactions.filter((i) => i.severity === "moderate").length,
    mild: interactions.filter((i) => i.severity === "mild").length,
  };

  const evidenceLevel = getEvidenceLevel(herb.evidence_level);
  const locale = pageLocale;
  const copyLocale = locale === "fr" ? "fr" : "en";
  const copy = herbPageCopy(copyLocale);
  const sheet = resolveSheetContent(
    pubmedSheet?.content as unknown as SheetContent | undefined,
    locale
  );

  const [t, tFaq, tHerbMeta] = await Promise.all([
    getTranslations({ locale }),
    getTranslations({ locale, namespace: "herbFaq" }),
    getTranslations({ locale, namespace: "herbMeta" }),
  ]);

  const herbMetaTitle = hasDistinctCommonName(herb)
    ? tHerbMeta("title", {
        name: herb.name,
        scientific: herb.scientific_name,
      })
    : tHerbMeta("titleBinomial", { scientific: herb.scientific_name });
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

  const isDangerous = isDangerousHerb(slug);
  const showCalculator = canShowDoseCalculator(slug, herb.dosage_adult);
  const reviewState = getReviewState(provenance);
  const reviewInvalidated =
    reviewState?.kind === "needs_re_review" ||
    reviewState?.kind === "ai_generated" ||
    reviewState?.kind === "not_reviewed";
  const resolvedReviewer = await resolvePublicReviewerFromDb(herb.reviewed_by);
  const clinicalReviewer = resolvedReviewer;
  const hasClinicalReviewer = clinicalReviewer?.role === "clinical";
  const isClinicallyReviewed =
    !reviewInvalidated &&
    hasClinicalReviewer &&
    (reviewState?.kind === "human_reviewed" ||
      isManualMonograph ||
      (pubmedSheet?.status === "reviewed" && isUsablePubmedSheet(pubmedSheet)));

  const fallbackFaqs = buildHerbFallbackFaqs(
    {
      herbName: herb.name,
      scientificName: herb.scientific_name,
      uses: [...(herb.traditional_uses || []), ...(herb.modern_uses || [])],
      safetyNotes:
        monograph?.safetyNotes?.join(". ") ||
        herb.side_effects?.join(". ") ||
        "",
      pregnancyCategory: monograph?.pregnancyCategory || "insufficient",
      drugInteractions: interactions.length,
      commonNames: herb.common_names || [],
      isDangerous,
      showCalculator,
    },
    (key, params) => tFaq(key as never, params as never)
  );

  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null
  );
  const registeredReviewer = resolvedReviewer;
  const lastReviewed =
    registeredReviewer && herb.last_reviewed
      ? new Date(herb.last_reviewed).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : undefined;
  const regulatorName =
    (
      (herb.provenance as { sources?: unknown[] } | null)?.sources?.find(
        (src) =>
          typeof src === "object" &&
          src !== null &&
          (src as { type?: string }).type === "regulator"
      ) as { name?: string } | undefined
    )?.name ?? null;
  const reviewedBy = registeredReviewer?.name;
  const reviewerCredentials = registeredReviewer?.credentials;
  const latestModified = computeLatestModified(
    herb.updated_at,
    herb.last_reviewed
  );
  const rawLastVerified =
    typeof (herb.provenance as { last_verified_at?: unknown } | null)
      ?.last_verified_at === "string"
      ? ((herb.provenance as { last_verified_at?: string }).last_verified_at ??
        null)
      : null;
  const provenanceLastVerified =
    rawLastVerified &&
    rawLastVerified.startsWith("2026-06-23") &&
    reviewState?.kind !== "human_reviewed"
      ? null
      : rawLastVerified;
  const sourcesLastChecked = computeLatestModified(
    provenanceLastVerified,
    regulatoryEvidence?.retrieved_at ?? herb.updated_at ?? null
  );
  const relatedGuides = matchGuidesForHerb({
    slug,
    interactions,
    sources,
    pregnancySafe: herb.pregnancy_safe,
    pregnancySafeOral: herb.pregnancy_safe_oral,
    symptomKeywords: herb.symptom_keywords,
    hasRegulatory: Boolean(regulatoryEvidence),
  });

  let relatedHerbs: Array<{
    name: string;
    slug: string;
    scientific_name: string;
  }> = [];
  try {
    relatedHerbs = await loadRelatedHerbs(
      slug,
      herb.category_id ?? null,
      (
        (herb as { related_slugs?: string[] | null }).related_slugs ?? []
      ).filter(Boolean)
    );
  } catch {
    // Non-critical related herbs fallback
  }

  const [{ prev, next }, symptomPeers] =
    bundle?.neighbours && Array.isArray(bundle.symptom_peers)
      ? [bundle.neighbours, bundle.symptom_peers]
      : await Promise.all([
          getAlphabeticalNeighbours(herb.name, slug),
          getSymptomPeers(
            slug,
            (herb.symptom_keywords as string[] | null) ?? null
          ),
        ]);

  const imageMeta = (
    herb.provenance as {
      image?: {
        credit?: string;
        source?: string;
        publisher?: string;
        licence?: string;
        licence_url?: string;
        licenceUrl?: string;
      };
    } | null
  )?.image;

  // Keep RSC Flight payloads compact by passing only the fields read by
  // client boundaries instead of full DB rows/blobs.
  const heroHerb = {
    id: herb.id,
    slug,
    name: herb.name,
    scientific_name: herb.scientific_name,
    image_url: herb.image_url,
    pregnancy_safe: herb.pregnancy_safe,
    nursing_safe: herb.nursing_safe,
    pregnancy_safe_oral: herb.pregnancy_safe_oral,
    pregnancy_safe_topical: herb.pregnancy_safe_topical,
    nursing_safe_oral: herb.nursing_safe_oral,
    nursing_safe_topical: herb.nursing_safe_topical,
    herb_categories: herb.herb_categories?.name
      ? { name: herb.herb_categories.name }
      : null,
    evidence_level: evidenceLevel,
    contraindications: herb.contraindications ?? null,
  };
  const compactProvenance: Record<string, unknown> = {
    verification_method: provenance.verification_method,
    verification_status: provenance.verification_status,
    verified_source_count: provenance.verified_source_count,
    verified_sources: provenance.verified_sources,
    verified_by: provenance.verified_by,
    review_status: provenance.review_status,
    reviewed_by_name: provenance.reviewed_by_name,
    reviewed_on: provenance.reviewed_on,
    review_role: provenance.review_role ?? null,
    bulk_editorial_import: provenance.bulk_editorial_import ?? null,
  };
  const tableInteractions = interactions.map((ix) => ({
    id: ix.id,
    drug_name: ix.drug_name,
    display_drug_name: (ix as { display_drug_name?: string }).display_drug_name,
    severity: ix.severity,
    description: ix.description,
    source_url: ix.source_url ?? null,
    publication_status:
      (ix as { publication_status?: string | null }).publication_status ?? null,
  }));
  const glanceInteractions = interactions.map((i) => ({
    drug_name: i.drug_name,
    display_drug_name: (i as { display_drug_name?: string }).display_drug_name,
    severity: i.severity,
  }));
  const resolvedFaqs =
    !isDangerous && preGeneratedFaqs.length > 0
      ? preGeneratedFaqs.map((f) => ({
          question: f.question,
          answer: f.answer,
        }))
      : fallbackFaqs;
  const compactRegulatory = regulatoryEvidence
    ? compactRegulatoryEvidence(regulatoryEvidence)
    : null;
  const compactRelatedGuides = relatedGuides.map((guide) => {
    const gCopy = copyLocale === "fr" ? guide.fr : guide.en;
    return {
      slug: guide.slug,
      title: gCopy.title,
      metaDescription: gCopy.metaDescription,
    };
  });

  return (
    <HerbsMessagesProvider locale={copyLocale}>
      <div className="space-y-8">
        <ViewTracker slug={slug} />
        <BreadcrumbListSchema items={herbCrumbs} />
        <HerbSchema
          herb={herb}
          url={herbPageUrl}
          dateModified={latestModified ?? undefined}
          isDangerous={isDangerous}
          isClinicallyReviewed={isClinicallyReviewed}
          resolvedReviewer={resolvedReviewer}
        />
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
          isDangerous={isDangerous}
          showCalculator={showCalculator}
          preGeneratedFaqs={
            preGeneratedFaqs.length > 0 ? preGeneratedFaqs : undefined
          }
          fallbackFaqs={fallbackFaqs}
        />

        <Breadcrumbs
          items={[
            { name: t("common.breadcrumbHome"), href: "/" },
            { name: t("nav.herbs"), href: "/herbs" },
            { name: herb.name },
          ]}
        />

        <Link
          href="/herbs"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "min-h-10",
          })}
        >
          <ArrowLeft className="size-4" />
          {t("herbDetail.backToHerbs")}
        </Link>

        <p className="text-xs text-muted-foreground italic">
          {t("herbDetail.medicalDisclaimerText")}
        </p>

        <DangerousHerbBanner slug={slug} locale={copyLocale} />
        <HerbHeroV2
          herb={heroHerb}
          provenance={compactProvenance}
          pubmedSheetStatus={
            pubmedSheet && isUsablePubmedSheet(pubmedSheet)
              ? pubmedSheet.status
              : null
          }
          isManualMonograph={isManualMonograph}
          showCalculator={showCalculator}
          interactions={glanceInteractions}
          safetyHref="#interactions"
        />

        <p className="-mt-4 text-sm text-muted-foreground">
          <Link
            href="/methodology"
            className="inline-flex min-h-9 items-center underline-offset-4 hover:text-foreground hover:underline"
          >
            {copy.evidenceLabelsLink}
          </Link>
        </p>

        <AuthorByline
          locale={copyLocale}
          lastReviewed={isClinicallyReviewed ? latestModified : null}
          lastUpdated={herb.updated_at ?? null}
          isReviewed={isClinicallyReviewed}
          isManualMonograph={isManualMonograph}
          sourceCount={verifiedSources.length}
          reviewerName={reviewedBy}
          reviewerCredentials={reviewerCredentials}
          herbSlug={slug}
        />

        <HerbJumpNav
          locale={copyLocale}
          hasInteractions={interactions.length > 0}
        />

        <HerbPhoto
          slug={slug}
          name={herb.name}
          className="mt-2"
          imageUrl={herb.image_url}
          credit={imageMeta?.credit}
          creditUrl={imageMeta?.source}
          publisher={imageMeta?.publisher}
          licence={imageMeta?.licence}
          licenceUrl={imageMeta?.licence_url ?? imageMeta?.licenceUrl}
        />

        <div id="overview" className="scroll-mt-28 space-y-8">
          {!isManualMonograph && herb.description?.trim() ? (
            <p className="measure prose-body leading-relaxed text-foreground">
              {herb.description}
            </p>
          ) : null}

          <UserInteractionAlert herbSlug={slug} />
        </div>

        {tableInteractions.length > 0 && (
          <section id="interactions" className="scroll-mt-28">
            <InteractionsTable
              interactions={tableInteractions}
              herbSlug={slug}
            />
          </section>
        )}

        <HerbSources
          sources={verifiedSources}
          lastChecked={sourcesLastChecked}
          label={copy.sources.label}
          checkedLabel={copy.sources.checkedLabel}
          countLabel={copy.sources.count}
          taxonomyLabel={copy.sources.taxonomyLabel}
          note={copy.sources.note}
        />

        <HerbRegulatorExcerpts
          herbName={herb.name}
          sources={sources}
          copy={copy}
          filter="modern"
          locale={copyLocale}
        />

        <div id="dosage-safety" className="scroll-mt-28 space-y-8">
          <HerbNarrative
            herb={herb}
            interactionCount={interactions.length}
            locale={copyLocale}
            isDangerous={isDangerous}
          />

          <HerbBodyContent
            herb={herb}
            compactProvenance={compactProvenance}
            monograph={monograph}
            isManualMonograph={isManualMonograph}
            isClinicallyReviewed={isClinicallyReviewed}
            showCalculator={showCalculator}
            lastReviewed={lastReviewed}
            reviewedBy={reviewedBy}
            regulatorName={regulatorName}
            interactions={interactions}
            severityCounts={severityCounts}
            locale={copyLocale}
            copy={copy}
            pubmedSheet={pubmedSheet}
            sheet={sheet}
          />
        </div>

        <CmpBootstrap />
        <AdCmp />
        <AdSlot
          slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HERB}
          format="auto"
          className="my-8 min-h-[100px] no-print"
        />

        <section id="sources" className="scroll-mt-28 pt-4">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
            {t("herbDetail.sourcesAndCitations")}
          </h2>
          <CitationsList citations={citations} />
        </section>

        {isClinicallyReviewed && (
          <SourceAttribution
            reviewedBy={reviewedBy}
            reviewerCredentials={reviewerCredentials}
            lastReviewed={lastReviewed}
          />
        )}

        <RegulatoryEvidenceSection
          evidence={compactRegulatory?.evidence ?? null}
          isHomeopathic={compactRegulatory?.isHomeopathic}
          locale={copyLocale}
          isDangerous={isDangerous}
          className="mt-4"
        />

        <GovSources
          slug={slug}
          displayName={herb.name}
          monographSources={sources}
        />

        <HerbFaqSection faqs={resolvedFaqs} />

        <HerbRegulatorExcerpts
          herbName={herb.name}
          sources={sources}
          copy={copy}
          filter="historical"
          isDangerous={isDangerous}
          locale={copyLocale}
        />

        {showCalculator && (
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
              <Link
                href={`/calculator?herb=${slug}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-10",
                })}
              >
                {t("herbDetail.calculateDose")}
              </Link>
            </div>
          </section>
        )}

        <ShareButtons
          title={`${herbMetaTitle} - HerbAlly`}
          url={herbPageUrl}
          className="pt-4 no-print"
        />

        <HerbRelatedSection
          locale={copyLocale}
          herbSlug={slug}
          interactions={glanceInteractions.slice(0, 6)}
          prev={prev}
          next={next}
          symptomPeers={symptomPeers}
          relatedHerbs={relatedHerbs}
          relatedHeading={t("herbDetail.relatedHerbs")}
          relatedGuides={compactRelatedGuides}
        />

        <NewsletterSignup locale={copyLocale} />
      </div>
    </HerbsMessagesProvider>
  );
}
