import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HerbSchema } from "@/components/seo/herb-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { CitationsList, SourceAttribution } from "@/components/herbs/citations";
import { generateMonograph } from "@/lib/data/generate-monograph";
import { getComparisonHerbs } from "@/lib/data/comparisons";
import type { Monograph } from "@/lib/data/monographs";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

import { HerbHeroV2 } from "@/components/herbs/herb-hero-v2";
import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import { HerbOverviewPanel } from "@/components/herbs/herb-overview-panel";
import { HerbUsesPanel } from "@/components/herbs/herb-uses-panel";
import { HerbSciencePanel } from "@/components/herbs/herb-science-panel";
import { HerbDosagePanel } from "@/components/herbs/herb-dosage-panel";
import { HerbSafetyPanel } from "@/components/herbs/herb-safety-panel";

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

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getHerbBySlug(slug, { locale: "en", skipCookies: true });
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
    alternates: { canonical: `${baseUrl}/herbs/${slug}` },
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


export default async function HerbDetailPage({ params }: Props) {
  const { slug } = await params;
  const result = await getHerbBySlug(slug);

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const t = await getTranslations();

  if (!result.success || !result.data) {
    notFound();
  }

  const herb = result.data;

  after(async () => {
    const supabase = getAnonClient();
    if (supabase && herb.id) {
      await (supabase.rpc as any)("increment_herb_view", { herb_id: herb.id });
    }
  });

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
      // fall through
    }
  }

  if (!monograph) {
    monograph = generateMonograph({
      ...herb,
      citations: herb.citations as unknown[] | null | undefined,
    });
  }

  const interactions = (herb.drug_interactions || []) as import("@/components/herbs/interactions-table").Interaction[];

  const severityCounts = {
    contraindicated: interactions.filter(
      (i) => i.severity === "contraindicated"
    ).length,
    severe: interactions.filter((i) => i.severity === "severe").length,
    moderate: interactions.filter((i) => i.severity === "moderate").length,
    mild: interactions.filter((i) => i.severity === "mild").length,
  };

  const evidenceLevel = getEvidenceLevel(herb.evidence_level);
  const citations = formatCitations(
    herb.citations as unknown as CitationData[] | null,
    t
  );
  const lastReviewed = herb.last_reviewed
    ? new Date(herb.last_reviewed).toLocaleDateString(
        locale === "fr" ? "fr-FR" : "en-US",
        { month: "long", year: "numeric" }
      )
    : herb.updated_at
      ? new Date(herb.updated_at).toLocaleDateString(
          locale === "fr" ? "fr-FR" : "en-US",
          { month: "long", year: "numeric" }
        )
      : undefined;
  const reviewedBy = herb.reviewed_by || t("herbDetailContent.editorialTeam");
  const reviewerCredentials =
    herb.reviewer_credentials || t("herbDetailContent.editorialCredentials");

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
        .select("name, slug, scientific_name, symptom_keywords, traditional_uses")
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
    // swallow
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

      {/* Back Button */}
      <Button variant="ghost" size="sm" render={<Link href="/herbs" />}>
        <ArrowLeft className="size-4" />
        {t("herbDetail.backToHerbs")}
      </Button>

      {/* Medical Disclaimer */}
      <SafetyAlert severity="info" title={t("fda.disclaimer").split(".")[0]}>
        {t("herbDetail.medicalDisclaimerText")}
      </SafetyAlert>

      {/* New Hero */}
      <HerbHeroV2 herb={{ ...herb, evidence_level: evidenceLevel }} />

      {/* Tabbed Content */}
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
        sources={[
          t("herbDetailContent.sources.who"),
          t("herbDetailContent.sources.nccih"),
          t("herbDetailContent.sources.pubmed"),
          t("herbDetailContent.sources.commissionE"),
        ]}
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

      {/* Report Issue */}
      <div className="mt-8 rounded-2xl border border-dashed p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("herbDetail.foundError", { name: herb.name })}
        </p>
        <a
          href={`mailto:support@herbally.app?subject=Correction%20for%20${encodeURIComponent(herb.name)}%20(${encodeURIComponent(herb.scientific_name)})`}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("herbDetailContent.reportIssue")} →
        </a>
      </div>
    </div>
  );
}
