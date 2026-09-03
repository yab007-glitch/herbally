import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { SourceAttribution } from "@/components/herbs/citations";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";

export const revalidate = 3600;

/**
 * Canonical list of popular comparisons. Exported so the sitemap derives its
 * compare URLs from the SAME source of truth as generateStaticParams.
 *
 * Extended Sep 2026 from Search Console converting queries — these /compare/
 * pages already get clicks at 5-10% CTR vs 0.4% site average:
 * st-johns-wort/vs/nettle, dulse/vs/irish-moss, milk-thistle/vs/psyllium,
 * garlic/vs/hawthorn, peppermint/vs/fennel, hops/vs/valerian, etc.
 */
export const POPULAR_COMPARISONS = [
  { slug1: "turmeric", slug2: "ginger" },
  { slug1: "ashwagandha", slug2: "rhodiola" },
  { slug1: "chamomile", slug2: "valerian" },
  { slug1: "garlic", slug2: "ginger" },
  { slug1: "echinacea", slug2: "elderberry" },
  { slug1: "ginkgo", slug2: "ginseng" },
  { slug1: "lavender", slug2: "chamomile" },
  { slug1: "turmeric", slug2: "ashwagandha" },
  { slug1: "st-johns-wort", slug2: "kava" },
  { slug1: "milk-thistle", slug2: "dandelion" },
  { slug1: "st-johns-wort", slug2: "nettle" },
  { slug1: "dulse", slug2: "irish-moss" },
  { slug1: "milk-thistle", slug2: "psyllium" },
  { slug1: "garlic", slug2: "hawthorn" },
  { slug1: "peppermint", slug2: "fennel" },
  { slug1: "hops", slug2: "valerian" },
  { slug1: "lemon-basil", slug2: "thai-basil" },
  { slug1: "vervain", slug2: "valerian" },
  { slug1: "olive", slug2: "fish-oil" },
  { slug1: "turmeric", slug2: "fish-oil" },
  { slug1: "selfheal-herb", slug2: "salvia-pratensis" },
  { slug1: "kelp", slug2: "ascophyllum-nodosum" },
] as const;

// Pre-render popular comparisons for SEO
export async function generateStaticParams() {
  return [...POPULAR_COMPARISONS];
}

type Props = { params: Promise<{ slug1: string; slug2: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug1, slug2 } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const metaLocale = await getLocaleFromRequest();

  // Use the request locale (not hardcoded "en") so the title/description
  // show localized herb names on /fr pages.
  const [resultA, resultB] = await Promise.all([
    getHerbBySlug(slug1, { locale: metaLocale, skipCookies: true }),
    getHerbBySlug(slug2, { locale: metaLocale, skipCookies: true }),
  ]);

  const herbA = resultA.success ? resultA.data : null;
  const herbB = resultB.success ? resultB.data : null;

  if (!herbA || !herbB) {
    return {
      title: "Herb Comparison Not Found | HerbAlly",
      robots: { index: false },
    };
  }

  return {
    title: `${herbA.name} vs ${herbB.name}: Difference, Benefits & Which Is Better?`,
    description: `Compare ${herbA.name} vs ${herbB.name}: uses, dosage, pregnancy safety, side effects & drug interactions. Evidence-based verdict + free dose calculator.`.slice(
      0,
      158
    ),
    alternates: {
      canonical:
        metaLocale === "fr"
          ? `${baseUrl}/fr/compare/${slug1}/vs/${slug2}`
          : `${baseUrl}/compare/${slug1}/vs/${slug2}`,
      languages: {
        en: `${baseUrl}/compare/${slug1}/vs/${slug2}`,
        fr: `${baseUrl}/fr/compare/${slug1}/vs/${slug2}`,
        "x-default": `${baseUrl}/compare/${slug1}/vs/${slug2}`,
      },
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { slug1, slug2 } = await params;
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });
  const [resultA, resultB] = await Promise.all([
    getHerbBySlug(slug1, { skipCookies: true }),
    getHerbBySlug(slug2, { skipCookies: true }),
  ]);

  if (!resultA.success || !resultB.success || !resultA.data || !resultB.data) {
    notFound();
  }

  const herbA = resultA.data;
  const herbB = resultB.data;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const compareUrl = `${baseUrl}/compare/${slug1}/vs/${slug2}`;

  return (
    <div className="space-y-8">
      <WebPageSchema
        title={`${herbA.name} vs ${herbB.name}: Difference, Benefits & Which Is Better?`}
        description={`Compare ${herbA.name} vs ${herbB.name}: uses, dosage, safety & interactions.`}
        url={compareUrl}
        breadcrumbs={[
          { name: "Home", url: baseUrl },
          { name: "Herbs", url: `${baseUrl}/herbs` },
          {
            name: `${herbA.name} vs ${herbB.name}`,
            url: compareUrl,
          },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: baseUrl },
          { name: "Herbs", url: `${baseUrl}/herbs` },
          {
            name: `${herbA.name} vs ${herbB.name}`,
            url: compareUrl,
          },
        ]}
      />
      <FAQSchema
        items={[
          {
            question: `What is the difference between ${herbA.name} and ${herbB.name}?`,
            answer: `${herbA.name} (${herbA.scientific_name}) is traditionally used for ${(herbA.traditional_uses || []).slice(0, 3).join(", ") || "various wellness applications"}, while ${herbB.name} (${herbB.scientific_name}) is used for ${(herbB.traditional_uses || []).slice(0, 3).join(", ") || "various wellness applications"}. See the comparison table for dosage, safety and interactions.`,
          },
          {
            question: `Which is better, ${herbA.name} or ${herbB.name}?`,
            answer: `It depends on your goal. Compare evidence levels, pregnancy safety and drug interactions in the table above, then use our free dose calculator. Consult your healthcare provider for personalized advice.`,
          },
          {
            question: `Can I take ${herbA.name} and ${herbB.name} together?`,
            answer: `Combining herbs can change safety and interactions. Check each herb's interaction profile above and consult your healthcare provider before combining ${herbA.name} with ${herbB.name}.`,
          },
        ]}
      />
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { name: t("common.breadcrumbHome"), href: "/" },
            { name: t("nav.herbs"), href: "/herbs" },
            { name: `${herbA.name} vs ${herbB.name}` },
          ]}
        />
        <Button variant="ghost" size="sm" render={<Link href="/herbs" />}>
          <ArrowLeft className="size-4" />
          {t("herbDetail.backToHerbs")}
        </Button>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
          {t("compare.title", { name1: herbA.name, name2: herbB.name })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("compare.subtitle")}</p>
      </div>

      {/* Names */}
      <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 rounded-lg border bg-muted/50 p-4">
        <div className="font-medium text-foreground">{t("compare.herb")}</div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{herbA.name}</h2>
          <p className="text-sm italic text-muted-foreground">
            {herbA.scientific_name}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {herbA.herb_categories?.name || t("herbDetail.uncategorized")}
            </Badge>
            <EvidenceGrade
              level={
                (herbA.evidence_level as "A" | "B" | "C" | "D" | "trad") || "C"
              }
              showLabel={false}
            />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{herbB.name}</h2>
          <p className="text-sm italic text-muted-foreground">
            {herbB.scientific_name}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {herbB.herb_categories?.name || t("herbDetail.uncategorized")}
            </Badge>
            <EvidenceGrade
              level={
                (herbB.evidence_level as "A" | "B" | "C" | "D" | "trad") || "C"
              }
              showLabel={false}
            />
          </div>
        </div>
      </div>

      {/* Safety Warnings */}
      {(!herbA.pregnancy_safe ||
        !herbB.pregnancy_safe ||
        !herbA.nursing_safe ||
        !herbB.nursing_safe) && (
        <SafetyAlert
          severity="critical"
          title={`⚠️ ${t("compare.pregnancyWarnings")}`}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium">{herbA.name}</p>
              <p>
                {herbA.pregnancy_safe
                  ? `✅ ${t("compare.safeInPregnancy")}`
                  : `❌ ${t("compare.notRecommendedPregnancy")}`}
              </p>
              <p>
                {herbA.nursing_safe
                  ? `✅ ${t("compare.safeNursing")}`
                  : `❌ ${t("compare.notRecommendedNursing")}`}
              </p>
            </div>
            <div>
              <p className="font-medium">{herbB.name}</p>
              <p>
                {herbB.pregnancy_safe
                  ? `✅ ${t("compare.safeInPregnancy")}`
                  : `❌ ${t("compare.notRecommendedPregnancy")}`}
              </p>
              <p>
                {herbB.nursing_safe
                  ? `✅ ${t("compare.safeNursing")}`
                  : `❌ ${t("compare.notRecommendedNursing")}`}
              </p>
            </div>
          </div>
        </SafetyAlert>
      )}

      {/* Comparison Table */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.description")}
            </div>
            <div className="text-muted-foreground">
              {herbA.description || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.description || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.activeCompounds")}
            </div>
            <div className="text-muted-foreground">
              {herbA.active_compounds?.join(", ") || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.active_compounds?.join(", ") || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.traditionalUses")}
            </div>
            <div className="text-muted-foreground">
              {herbA.traditional_uses?.join(", ") || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.traditional_uses?.join(", ") || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.modernUses")}
            </div>
            <div className="text-muted-foreground">
              {herbA.modern_uses?.join(", ") || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.modern_uses?.join(", ") || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.adultDosage")}
            </div>
            <div className="text-muted-foreground">
              {herbA.dosage_adult || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.dosage_adult || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.contraindications")}
            </div>
            <div className="text-muted-foreground">
              {herbA.contraindications?.join(", ") || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.contraindications?.join(", ") || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 border-b py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.sideEffects")}
            </div>
            <div className="text-muted-foreground">
              {herbA.side_effects?.join(", ") || "—"}
            </div>
            <div className="text-muted-foreground">
              {herbB.side_effects?.join(", ") || "—"}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 py-3 text-sm">
            <div className="font-medium text-foreground">
              {t("compare.drugInteractions")}
            </div>
            <div className="text-muted-foreground">
              {t("compare.knownInteractions", {
                count: (herbA.drug_interactions || []).length,
              })}
            </div>
            <div className="text-muted-foreground">
              {t("compare.knownInteractions", {
                count: (herbB.drug_interactions || []).length,
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <SourceAttribution
        reviewedBy={t("herbDetailContent.editorialTeam")}
        reviewerCredentials={t("herbDetailContent.editorialCredentials")}
        sources={[
          t("herbDetailContent.sources.who"),
          t("herbDetailContent.sources.nccih"),
          t("herbDetailContent.sources.pubmed"),
          t("herbDetailContent.sources.commissionE"),
        ]}
      />

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        <Button render={<Link href={`/herbs/${slug1}`} />}>
          <Leaf className="size-4" />
          {t("compare.viewDetails", { name: herbA.name })}
        </Button>
        <Button variant="outline" render={<Link href={`/herbs/${slug2}`} />}>
          <Leaf className="size-4" />
          {t("compare.viewDetails", { name: herbB.name })}
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/calculator?herb=${slug1}`} />}
        >
          Calculate {herbA.name} Dose
        </Button>
      </div>

      {/* Visible FAQ — must mirror FAQSchema above for rich-result eligibility */}
      <section aria-labelledby="compare-faq-heading" className="pt-4">
        <h2
          id="compare-faq-heading"
          className="mb-3 text-xl font-semibold text-foreground"
        >
          Frequently asked questions
        </h2>
        <div className="divide-y rounded-2xl border">
          <details className="px-4 py-3">
            <summary className="cursor-pointer font-medium text-foreground">
              What is the difference between {herbA.name} and {herbB.name}?
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {herbA.name} ({herbA.scientific_name}) is traditionally used for{" "}
              {(herbA.traditional_uses || []).slice(0, 3).join(", ") ||
                "various wellness applications"}
              , while {herbB.name} ({herbB.scientific_name}) is used for{" "}
              {(herbB.traditional_uses || []).slice(0, 3).join(", ") ||
                "various wellness applications"}
              . See the comparison table for dosage, safety and interactions.
            </p>
          </details>
          <details className="px-4 py-3">
            <summary className="cursor-pointer font-medium text-foreground">
              Which is better, {herbA.name} or {herbB.name}?
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              It depends on your goal. Compare evidence levels, pregnancy safety
              and drug interactions in the table above, then use our free dose
              calculator. Consult your healthcare provider for personalized
              advice.
            </p>
          </details>
          <details className="px-4 py-3">
            <summary className="cursor-pointer font-medium text-foreground">
              Can I take {herbA.name} and {herbB.name} together?
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Combining herbs can change safety and interactions. Check each
              herb&apos;s interaction profile above and consult your healthcare
              provider before combining {herbA.name} with {herbB.name}.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
