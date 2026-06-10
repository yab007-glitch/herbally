import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  Calculator,
  AlertTriangle,
  FlaskConical,
  BookOpen,
  Stethoscope,
  Pill,
  GitCompare,
  Clock,
  FileText,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HerbSafetyBadges } from "@/components/herbs/herb-safety-badges";
import {
  InteractionsTable,
  type Interaction,
} from "@/components/herbs/interactions-table";
import { CopyLinkButton } from "@/components/herbs/copy-link-button";
import { HerbSchema } from "@/components/seo/herb-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { parseProvenance } from "@/lib/types/provenance";
import {
  SafetyAlert,
  InteractionAlert,
  PregnancyAlert,
} from "@/components/herbs/safety-alert";
import { CitationsList, SourceAttribution } from "@/components/herbs/citations";
import { generateMonograph } from "@/lib/data/generate-monograph";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import type { Monograph } from "@/lib/data/monographs";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

// Generate static pages for popular herbs at build time.
// Herbs beyond this count are served via ISR (revalidate = 3600).
export async function generateStaticParams() {
  try {
    const supabase = getAnonClient();
    if (!supabase) return [];

    const { data: herbs } = await supabase
      .from("herbs")
      .select("slug")
      .eq("is_published", true)
      .order("name", { ascending: true })
      .limit(500);

    return (herbs ?? []).map((herb) => ({ slug: herb.slug }));
  } catch {
    return [];
  }
}

// Revalidate every hour
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getHerbBySlug(slug);
  if (!result.success || !result.data) {
    return { title: "Herbally" };
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
      canonical: `${baseUrl}/herbs/${slug}`,
    },
    openGraph: {
      title: `${herb.name} (${herb.scientific_name})`,
      description: herb.description?.slice(0, 160) || undefined,
      url: `${baseUrl}/herbs/${slug}`,
      type: "article",
      siteName: "HerbAlly",
    },
    twitter: {
      card: "summary_large_image",
      title: `${herb.name} - Medicinal Herb`,
      description: herb.description?.slice(0, 160) || undefined,
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

// Map DB evidence_level to EvidenceLevel type
function getEvidenceLevel(
  level: string | null | undefined
): "A" | "B" | "C" | "D" | "trad" {
  if (level && ["A", "B", "C", "D", "trad"].includes(level))
    return level as "A" | "B" | "C" | "D" | "trad";
  return "C";
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

type DrugInteraction = {
  severity: "mild" | "moderate" | "severe" | "contraindicated";
};

export default async function HerbDetailPage({ params }: Props) {
  const { slug } = await params;
  const result = await getHerbBySlug(slug);

  // Get locale from cookies
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";

  // Translation helper
  const t = await getTranslations();
  if (!result.success || !result.data) {
    notFound();
  }

  const herb = result.data;

  // Defer view count increment so it doesn't block the response
  after(async () => {
    const supabase = getAnonClient();
    if (supabase && herb.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)("increment_herb_view", { herb_id: herb.id });
    }
  });

  // Try DB monograph first, then fall back to generated monograph
  let monograph: Monograph | null = null;
  const supabase = getAnonClient();
  if (supabase) {
    try {
      const { data: dbMonograph } = await supabase
        .from("herb_monographs")
        .select(
          "summary, mechanism, claims, safety_notes, drug_interactions, pregnancy_category, key_citations, status"
        )
        .eq("herb_slug", slug)
        .eq("status", "published")
        .single();

      if (dbMonograph) {
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
      }
    } catch {
      // Fall through to generated monograph
    }
  }

  if (!monograph) {
    monograph = generateMonograph({
      ...herb,
      citations: herb.citations as unknown[] | null | undefined,
    });
  }

  const category = herb.herb_categories?.name || t("herbDetail.uncategorized");
  const interactions = (herb.drug_interactions || []) as Interaction[];

  const severityCounts = {
    contraindicated: interactions.filter(
      (i: DrugInteraction) => i.severity === "contraindicated"
    ).length,
    severe: interactions.filter((i: DrugInteraction) => i.severity === "severe")
      .length,
    moderate: interactions.filter(
      (i: DrugInteraction) => i.severity === "moderate"
    ).length,
    mild: interactions.filter((i: DrugInteraction) => i.severity === "mild")
      .length,
  };

  const evidenceLevel = getEvidenceLevel(herb.evidence_level);
  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null,
    t
  );
  const lastReviewed = herb.last_reviewed
    ? new Date(herb.last_reviewed).toLocaleDateString(
        locale === "fr" ? "fr-FR" : "en-US",
        {
          month: "long",
          year: "numeric",
        }
      )
    : herb.updated_at
      ? new Date(herb.updated_at).toLocaleDateString(
          locale === "fr" ? "fr-FR" : "en-US",
          {
            month: "long",
            year: "numeric",
          }
        )
      : undefined;
  const reviewedBy = herb.reviewed_by || t("herbDetailContent.editorialTeam");
  const reviewerCredentials =
    herb.reviewer_credentials || t("herbDetailContent.editorialCredentials");

  // Fetch related herbs using smart comparison logic (same category only)
  let relatedHerbs: Array<{
    name: string;
    slug: string;
    scientific_name: string;
  }> = [];
  try {
    const supabaseClient = getAnonClient();
    if (supabaseClient) {
      let relatedQuery = supabaseClient
        .from("herbs")
        .select(
          "name, slug, scientific_name, symptom_keywords, traditional_uses"
        )
        .eq("is_published", true);

      if (herb.category_id) {
        relatedQuery = relatedQuery.eq("category_id", herb.category_id);
      }

      const { data: categoryHerbs } = await relatedQuery;

      if (categoryHerbs) {
        relatedHerbs = getComparisonHerbs(slug, categoryHerbs, 3);
      }
    }
  } catch {
    // Related herbs are non-critical, swallow errors
  }

  return (
    <div className="space-y-8">
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
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              {t("herbDetailContent.breadcrumbHome")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/herbs"
              className="hover:text-foreground transition-colors"
            >
              {t("herbDetailContent.breadcrumbHerbs")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium" aria-current="page">
            {herb.name}
          </li>
        </ol>
      </nav>

      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: t("herbDetailContent.breadcrumbHome"),
                item: baseUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: t("herbDetailContent.breadcrumbHerbs"),
                item: `${baseUrl}/herbs`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: herb.name,
                item: `${baseUrl}/herbs/${slug}`,
              },
            ],
          }),
        }}
      />

      {/* Back Button */}
      <Button variant="ghost" size="sm" render={<Link href="/herbs" />}>
        <ArrowLeft className="size-4" />
        {t("herbDetail.backToHerbs")}
      </Button>

      {/* Medical Disclaimer - ABOVE FOLD */}
      <SafetyAlert severity="info" title={t("fda.disclaimer").split(".")[0]}>
        {t("herbDetail.medicalDisclaimerText")}
      </SafetyAlert>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {herb.name}
          </h1>
          <Badge variant="secondary">{category}</Badge>
          <EvidenceGrade level={evidenceLevel} />
          <ProvenanceBadge provenance={parseProvenance(herb.provenance)} />
          <CopyLinkButton />
        </div>
        <p className="mt-1 text-lg italic text-muted-foreground">
          {herb.scientific_name}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <HerbSafetyBadges
            pregnancySafe={herb.pregnancy_safe ?? false}
            nursingSafe={herb.nursing_safe ?? false}
          />
          {lastReviewed && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {t("herbDetail.lastReviewedPrefix")} {lastReviewed}
            </span>
          )}
        </div>
      </div>

      {/* Critical Safety Warnings - ABOVE FOLD */}
      {(!herb.pregnancy_safe || !herb.nursing_safe) && (
        <PregnancyAlert
          pregnancySafe={herb.pregnancy_safe ?? false}
          nursingSafe={herb.nursing_safe ?? false}
          evidenceLevel="limited"
        />
      )}

      <InteractionAlert
        interactionCount={interactions.length}
        severityCounts={severityCounts}
      />

      {/* Description */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {t("herbDetail.description")}
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          {herb.description}
        </p>
        {monograph && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="font-semibold text-foreground">
              {t("herbDetail.clinicalSummary")}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {monograph.summary}
            </p>
            {monograph.mechanism && (
              <>
                <h4 className="mt-3 font-medium text-foreground">
                  {t("herbDetail.mechanismOfAction")}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {monograph.mechanism}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* Per-Claim Evidence (from monograph) */}
      {monograph && monograph.claims.length > 0 && (
        <>
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
              <FlaskConical className="size-5 text-primary" />
              {t("herbDetail.evidenceByClaim")}
            </h2>
            <div className="space-y-3">
              {monograph.claims.map((claim) => (
                <div
                  key={claim.claim}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{claim.claim}</p>
                    {claim.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {claim.note}
                      </p>
                    )}
                  </div>
                  <EvidenceGrade
                    level={claim.evidence as "A" | "B" | "C" | "D" | "trad"}
                    showLabel={false}
                  />
                </div>
              ))}
            </div>
          </section>
          <Separator />
        </>
      )}

      {/* Active Compounds */}
      {herb.active_compounds && herb.active_compounds.length > 0 && (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {t("herbDetail.activeCompounds")}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {herb.active_compounds.map((compound: string) => (
                <Badge key={compound} variant="outline">
                  {compound}
                </Badge>
              ))}
            </div>
          </section>
          <Separator />
        </>
      )}

      {/* Uses Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Traditional Uses */}
        {herb.traditional_uses && herb.traditional_uses.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {t("herbDetail.traditionalUses")}
              </h2>
              <EvidenceGrade level="C" showLabel={false} />
            </div>
            <ul className="space-y-2">
              {herb.traditional_uses.map((use: string) => (
                <li
                  key={use}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {use}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Modern Uses */}
        {herb.modern_uses && herb.modern_uses.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {t("herbDetail.modernUses")}
              </h2>
              <EvidenceGrade level="B" showLabel={false} />
            </div>
            <ul className="space-y-2">
              {herb.modern_uses.map((use: string) => (
                <li
                  key={use}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-green-500" />
                  {use}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Separator />

      {/* Dosage Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="size-5 text-primary" />
            {t("herbDetail.dosageInfo")}
          </CardTitle>
          <CardDescription>{t("herbDetail.recommendedDosing")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {herb.dosage_forms && herb.dosage_forms.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.forms")}
                </dt>
                <dd className="text-sm capitalize text-muted-foreground">
                  {herb.dosage_forms.join(", ")}
                </dd>
              </div>
            )}
            {herb.dosage_adult && (
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.adultDosage")}
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {herb.dosage_adult}
                </dd>
              </div>
            )}
            {herb.dosage_child && (
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.childDosage")}
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {herb.dosage_child}
                </dd>
              </div>
            )}
            {herb.preparation_notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.preparationNotes")}
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {herb.preparation_notes}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Detailed Safety Information */}
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-5" />
            {t("herbDetail.safetyInfo")}
          </CardTitle>
          <CardDescription>
            {t("herbDetail.safetyConsiderations")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {herb.pregnancy_safe ? (
                <ShieldCheck className="size-5 text-green-600" />
              ) : (
                <ShieldX className="size-5 text-red-500" />
              )}
              <span className="text-sm">
                {herb.pregnancy_safe
                  ? t("herbDetail.safePregnancy")
                  : t("herbDetail.notSafePregnancy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {herb.nursing_safe ? (
                <ShieldCheck className="size-5 text-green-600" />
              ) : (
                <ShieldX className="size-5 text-red-500" />
              )}
              <span className="text-sm">
                {herb.nursing_safe
                  ? t("herbDetail.safeNursing")
                  : t("herbDetail.notSafeNursing")}
              </span>
            </div>
          </div>
          {herb.contraindications && herb.contraindications.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                {t("herbDetail.contraindicationsLabel")}
              </h3>
              <ul className="space-y-1">
                {herb.contraindications.map((c: string) => (
                  <li
                    key={c}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {herb.side_effects && herb.side_effects.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                {t("herbDetail.possibleSideEffects")}
              </h3>
              <ul className="space-y-1">
                {herb.side_effects.map((s: string) => (
                  <li
                    key={s}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drug Interactions */}
      <InteractionsTable interactions={interactions} />

      {/* Citations */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileText className="size-5 text-primary" />
          {t("herbDetail.sourcesAndCitations")}
        </h2>
        <CitationsList citations={citations} />
      </section>

      {/* Source Attribution */}
      <SourceAttribution
        reviewedBy={reviewedBy}
        reviewerCredentials={reviewerCredentials}
        lastReviewed={lastReviewed}
        sources={[
          t("herbDetailContent.sources.who"),
          t("herbDetailContent.sources.nccih"),
          t("herbDetailContent.sources.pubmed"),
          t("herbDetailContent.sources.commissionE"),
        ]}
      />

      {/* Related Herbs */}
      {relatedHerbs.length > 0 && (
        <section aria-labelledby="related-herbs-heading">
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
                className="group rounded-lg border p-4 transition-colors hover:bg-muted/50"
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

      {/* CTA Buttons */}
      <div className="flex flex-wrap gap-3 pt-4">
        <Button render={<Link href={`/calculator?herb=${slug}`} />}>
          <Calculator className="size-4" />
          {t("herbDetail.calculateDose")}
        </Button>
        <Button variant="outline" render={<Link href={`/?herb=${slug}`} />}>
          <AlertTriangle className="size-4" />
          {t("herbDetail.checkInteractions")}
        </Button>
        {relatedHerbs.length > 0 && (
          <Button
            variant="outline"
            render={
              <Link href={`/compare/${slug}/vs/${relatedHerbs[0].slug}`} />
            }
          >
            <GitCompare className="size-4" />
            {t("herbDetail.compareTo", { name: relatedHerbs[0].name })}
          </Button>
        )}
      </div>

      {/* Report Issue */}
      <div className="mt-8 rounded-lg border border-dashed p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("herbDetail.foundError", { name: herb.name })}
        </p>
        <a
          href={`mailto:support@herbally.app?subject=Correction%20for%20${encodeURIComponent(herb.name)}%20(${encodeURIComponent(herb.scientific_name)})&body=I%20found%20an%20error%20on%20the%20${encodeURIComponent(herb.name)}%20page%3A%0A%0A`}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("herbDetailContent.reportIssue")} →
        </a>
      </div>
    </div>
  );
}
