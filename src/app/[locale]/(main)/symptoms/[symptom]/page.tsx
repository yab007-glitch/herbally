import type { Metadata } from "next";
import { cache } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowRight, Stethoscope, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { notFound } from "next/navigation";
import { getAnonClient } from "@/lib/supabase/anonymous";
import {
  dedupeSymptomResults,
  localizeSymptomHerb,
} from "@/lib/search/symptom-results";
import {
  SYMPTOM_SLUGS,
  symptomMatchKeyword,
  symptomMeta,
} from "@/lib/symptoms/symptom-meta";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { JsonLd } from "@/components/seo/json-ld";

// ISR. The locale is a root param, so static generation no longer throws; the
// slug set is finite (SYMPTOM_SLUGS), and unknown slugs still render notFound.
export const revalidate = 86400;

type Props = { params: Promise<{ symptom: string }> };

type SymptomHerb = {
  slug: string;
  name: string;
  scientific_name: string;
  evidence_level: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  aliases?: string[];
  translations?: unknown;
};

/**
 * One query per request, shared by generateMetadata and the page body.
 *
 * generateMetadata needs the row count to decide the robots tag, and the body
 * needs the rows; `cache` keeps both from hitting Supabase twice. Four hubs
 * (bloodPressure, hormonal, prostate, diabetes) currently match zero published
 * herbs — they rendered "no herbs yet" while sitting in the sitemap, which is
 * the soft-404 shape Google files under "crawled - currently not indexed".
 */
const loadSymptomHerbs = cache(
  async (symptom: string, locale: string): Promise<SymptomHerb[]> => {
    const meta = symptomMeta[symptom];
    const supabase = getAnonClient();
    if (!meta || !supabase) return [];
    try {
      const { data } = await supabase
        .from("herbs")
        .select(
          "slug, name, scientific_name, evidence_level, pregnancy_safe, nursing_safe, traditional_uses, modern_uses, translations"
        )
        .eq("is_published", true)
        .overlaps("symptom_keywords", [meta.dbKeyword])
        .order("evidence_level", { ascending: true })
        .limit(20);
      // Translate before de-duplicating: de-dup is by scientific name, the
      // first row wins, and merged alias names must already be localized so
      // they do not stay English on French pages. The match itself is
      // unchanged — this page's query already requires the keyword overlap.
      return dedupeSymptomResults(
        (data || []).map((herb) => localizeSymptomHerb(herb, locale))
      );
    } catch {
      // Fall through to the empty state rather than failing the page.
      return [];
    }
  }
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symptom } = await params;
  const meta = symptomMeta[symptom];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const metaLocale = await getLocale();
  if (!meta) {
    return { title: "Not Found | HerbAlly", robots: { index: false } };
  }
  // Localize title/description from the dictionary when translations exist;
  // fall back to the English symptomMeta copy (desc is empty in en.json, so
  // the || fallback yields the English description there too).
  const t = await getTranslations({ locale: metaLocale });
  const title = t(`symptomMeta.${symptom}.title`) || meta.title;
  const description = t(`symptomMeta.${symptom}.desc`) || meta.description;
  const herbs = await loadSymptomHerbs(symptom, metaLocale);
  return {
    title,
    description,
    keywords: meta.keywords,
    // An empty hub is not a page worth indexing; it stays crawlable and
    // linked so it starts ranking the moment data lands.
    ...(herbs.length === 0 ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical:
        metaLocale === "fr"
          ? `${baseUrl}/fr/symptoms/${symptom}`
          : `${baseUrl}/symptoms/${symptom}`,
      languages: {
        en: `${baseUrl}/symptoms/${symptom}`,
        fr: `${baseUrl}/fr/symptoms/${symptom}`,
        "x-default": `${baseUrl}/symptoms/${symptom}`,
      },
    },
    openGraph: {
      title,
      description,
      url:
        metaLocale === "fr"
          ? `${baseUrl}/fr/symptoms/${symptom}`
          : `${baseUrl}/symptoms/${symptom}`,
    },
  };
}

export async function generateStaticParams() {
  return SYMPTOM_SLUGS.map((symptom) => ({ symptom }));
}

export default async function SymptomDetailPage({ params }: Props) {
  const { symptom } = await params;
  const meta = symptomMeta[symptom];

  const locale = await getLocale();
  const t = await getTranslations({ locale });
  if (!meta) {
    notFound();
  }

  const herbs = await loadSymptomHerbs(symptom, locale);

  const pageTitle =
    locale === "fr"
      ? t(`symptomMeta.${symptom}.title`) || meta.title
      : meta.title;
  const pageDescription =
    locale === "fr"
      ? t(`symptomMeta.${symptom}.desc`) || meta.description
      : meta.description;

  // JSON-LD must describe the page that actually rendered: a /fr page that
  // declares English URLs competes with its own EN twin instead of pairing
  // with it through hreflang.
  const prefix = locale === "fr" ? "/fr" : "";
  const symptomPath = `${prefix}/symptoms/${symptom}`;
  const herbPathPrefix = `${prefix}/herbs/`;

  return (
    <div className="space-y-8">
      <BreadcrumbListSchema
        items={[
          { name: t("common.home"), url: locale === "fr" ? "/fr" : "/" },
          {
            name: t("symptomsPage.title"),
            url: locale === "fr" ? "/fr/symptoms" : "/symptoms",
          },
          { name: pageTitle, url: symptomPath },
        ]}
      />
      <JsonLd
        id={`symptom-${symptom}-structured-data`}
        data={{
          "@context": "https://schema.org",
          "@type": "MedicalWebPage",
          name: pageTitle,
          description: pageDescription,
          url: `${siteUrl()}${symptomPath}`,
          mainEntity: {
            "@type": "ItemList",
            name: pageTitle,
            itemListElement: herbs.map((herb, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "MedicalSubstance",
                name: herb.name,
                alternateName: herb.scientific_name,
                url: `${siteUrl()}${herbPathPrefix}${herb.slug}`,
              },
            })),
          },
        }}
      />
      <div>
        <Link
          href="/symptoms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← {t("symptomsPage.allSymptoms")}
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground">
          {pageTitle}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{pageDescription}</p>
      </div>

      {/* Medical Disclaimer */}
      <SafetyAlert
        severity="info"
        title={t("symptomsDetail.medicalDisclaimer")}
      >
        {t("symptomsDetail.medicalDisclaimerText")}
      </SafetyAlert>

      {/* Herb Results */}
      {herbs && herbs.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stethoscope className="size-4" />
            <span>
              {t("symptomsDetail.herbCount", { count: herbs.length })}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {herbs.map((herb) => (
              <Link
                key={herb.slug}
                href={`/herbs/${herb.slug}`}
                className="group"
              >
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {herb.name}
                        </h3>
                        <p className="text-sm italic text-muted-foreground">
                          {herb.scientific_name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("symptomsPage.matchReasonSymptom", {
                            symptoms: symptomMatchKeyword(symptom, locale),
                          })}
                        </p>
                        {herb.aliases && herb.aliases.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("symptomsPage.alsoListedAs", {
                              names: herb.aliases.join(", "),
                            })}
                          </p>
                        )}
                      </div>
                      <EvidenceGrade
                        level={
                          (herb.evidence_level || "C") as
                            "A" | "B" | "C" | "D" | "trad"
                        }
                        showLabel={false}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(!herb.pregnancy_safe || !herb.nursing_safe) && (
                        <Badge variant="destructive" className="text-xs">
                          ⚠️ {t("herbBadges.pregnancyRisk")}
                        </Badge>
                      )}
                      {(herb.traditional_uses || herb.modern_uses || [])
                        .slice(0, 3)
                        .map((use: string) => (
                          <Badge
                            key={use}
                            variant="outline"
                            className="text-xs"
                          >
                            {use}
                          </Badge>
                        ))}
                    </div>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      {t("symptomsPage.viewDetails")}{" "}
                      <ArrowRight className="size-3" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {t("symptomsDetail.noHerbsYet")}
          </p>
          <Link
            href="/herbs"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("herbs.browseAll")}
          </Link>
        </div>
      )}

      {/* Compare CTA */}
      {herbs && herbs.length >= 2 && (
        <div className="mt-8 rounded-lg border bg-muted/50 p-6 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {t("symptomsDetail.compareThese")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("symptomsDetail.compareDesc")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href={`/compare/${herbs[0].slug}/vs/${herbs[1].slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Shield className="size-4" />
              {herbs[0].name} vs {herbs[1].name}
            </Link>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Stethoscope className="size-4" />
          {t("symptomsDetail.askHerbalist")}
        </Link>
      </div>
    </div>
  );
}
