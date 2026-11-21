import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { unstable_cache } from "next/cache";
import { isIndexable } from "@/lib/seo/indexable";
import { isUsablePubmedSheet } from "@/lib/pubmed/usable";
import { resolveSheetContent } from "@/lib/i18n/sheet-content";
import type { SheetContent } from "@/components/herbs/pubmed-monograph-sheet";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { parseProvenance } from "@/lib/types/provenance";
import { herbUnavailable, resolveHerbOr404 } from "@/lib/herbs/resolve-herb";
import { localizeHerb, localizeInteraction } from "@/lib/utils/localize-herb";
import type { HerbWithInteractions } from "@/lib/types";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
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
import { HerbSources } from "@/components/herbs/herb-sources";
import { getReviewer } from "@/lib/data/reviewers";

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
      ["herb-meta-v2-" + slug],
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

  const untranslatedFr = metaLocale === "fr" && !hasFr;
  const bundleInteractions = (
    bundle?.herb as Record<string, unknown> | null | undefined
  )?.drug_interactions;
  const hasCuratedInteraction =
    (Array.isArray(herb.drug_interactions) &&
      herb.drug_interactions.length > 0) ||
    (Array.isArray(bundleInteractions) && bundleInteractions.length > 0);
  const sourced =
    Boolean(bundle?.monograph) ||
    (bundle?.sources?.length ?? 0) > 0 ||
    hasManualMonograph(slug) ||
    hasCuratedInteraction;
  const thin =
    !sourced ||
    !isIndexable({
      description: herb.description,
      traditional_uses: herb.traditional_uses,
      dosage_adult: herb.dosage_adult,
      hasMonograph:
        Boolean(bundle?.monograph) ||
        isUsablePubmedSheet(
          bundle?.pubmed as {
            content?: unknown;
            pmids?: unknown;
            citations?: unknown;
          } | null
        ) ||
        (bundle?.sources?.length ?? 0) > 0 ||
        hasManualMonograph(slug) ||
        hasCuratedInteraction,
      hasRegulatory: Boolean(bundle?.regulatory),
    });

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
    robots:
      untranslatedFr || thin
        ? { index: false, follow: true }
        : {
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
    const localized = localizeHerb(
      bundle.herb as unknown as HerbWithInteractions,
      pageLocale
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
      ["herb-v8-" + slug],
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
    },
    (key, params) => tFaq(key as never, params as never)
  );

  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null,
    t
  );
  const registeredReviewer = getReviewer(herb.reviewed_by);
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

  return (
    <div className="space-y-8">
      <ViewTracker slug={slug} />
      <BreadcrumbListSchema items={herbCrumbs} />
      <HerbSchema
        herb={herb}
        url={herbPageUrl}
        dateModified={latestModified ?? undefined}
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

      <Button
        variant="ghost"
        size="sm"
        className="min-h-10"
        render={<Link href="/herbs" />}
      >
        <ArrowLeft className="size-4" />
        {t("herbDetail.backToHerbs")}
      </Button>

      <p className="text-xs text-muted-foreground italic">
        {t("herbDetail.medicalDisclaimerText")}
      </p>

      <DangerousHerbBanner slug={slug} />
      <HerbHeroV2
        herb={{ ...herb, evidence_level: evidenceLevel }}
        provenance={herb.provenance as Record<string, unknown> | null}
        pubmedSheetStatus={
          pubmedSheet && isUsablePubmedSheet(pubmedSheet)
            ? pubmedSheet.status
            : null
        }
        isManualMonograph={isManualMonograph}
        interactions={interactions.map((i) => ({
          drug_name: i.drug_name,
          severity: i.severity,
        }))}
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

      <AuthorByline locale={copyLocale} lastReviewed={latestModified} />

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

      {interactions.length > 0 && (
        <section id="interactions" className="scroll-mt-28">
          <InteractionsTable interactions={interactions} herbSlug={slug} />
        </section>
      )}

      <HerbSources
        sources={verifiedSources}
        lastChecked={
          (herb.provenance as { last_verified_at?: string } | null)
            ?.last_verified_at ?? null
        }
        label={copy.sources.label}
        checkedLabel={copy.sources.checkedLabel}
        countLabel={copy.sources.count}
        note={copy.sources.note}
      />

      <HerbRegulatorExcerpts
        herbName={herb.name}
        sources={sources}
        copy={copy}
      />

      <div id="dosage-safety" className="scroll-mt-28 space-y-8">
        <HerbNarrative
          herb={herb}
          interactionCount={interactions.length}
          locale={copyLocale}
        />

        <HerbBodyContent
          herb={herb}
          monograph={monograph}
          isManualMonograph={isManualMonograph}
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

      <SourceAttribution
        reviewedBy={reviewedBy}
        reviewerCredentials={reviewerCredentials}
        lastReviewed={lastReviewed}
      />

      <RegulatoryEvidenceSection
        evidence={regulatoryEvidence}
        locale={copyLocale}
        className="mt-4"
      />

      <GovSources slug={slug} displayName={herb.name} />

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
            className="min-h-10"
            render={<Link href={`/calculator?herb=${slug}`} />}
          >
            {t("herbDetail.calculateDose")}
          </Button>
        </div>
      </section>

      <ShareButtons
        title={`${herbMetaTitle} - HerbAlly`}
        url={herbPageUrl}
        className="pt-4 no-print"
      />

      <HerbRelatedSection
        locale={copyLocale}
        herbSlug={slug}
        interactions={interactions.map((i) => ({
          drug_name: i.drug_name,
          severity: i.severity,
        }))}
        prev={prev}
        next={next}
        symptomPeers={symptomPeers}
        relatedHerbs={relatedHerbs}
        relatedHeading={t("herbDetail.relatedHerbs")}
      />

      <NewsletterSignup locale={copyLocale} />
    </div>
  );
}
