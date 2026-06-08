import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { SourceAttribution } from "@/components/herbs/citations";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const revalidate = 3600;

// Pre-render popular comparisons for SEO
export async function generateStaticParams() {
  const popularComparisons = [
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
  ];
  return popularComparisons;
}

type Props = { params: Promise<{ slug1: string; slug2: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug1, slug2 } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";

  const [resultA, resultB] = await Promise.all([
    getHerbBySlug(slug1),
    getHerbBySlug(slug2),
  ]);

  const herbA = resultA.success ? resultA.data : null;
  const herbB = resultB.success ? resultB.data : null;

  if (!herbA || !herbB) {
    return { title: "Herb Comparison Not Found" };
  }

  return {
    title: `${herbA.name} vs ${herbB.name} - Herb Comparison`,
    description: `Compare ${herbA.name} and ${herbB.name} side by side. Uses, safety, interactions, and evidence levels.`,
    alternates: { canonical: `${baseUrl}/compare/${slug1}/vs/${slug2}` },
  };
}

export default async function ComparePage({ params }: Props) {
  const { slug1, slug2 } = await params;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const t = await getTranslations();
  const [resultA, resultB] = await Promise.all([
    getHerbBySlug(slug1),
    getHerbBySlug(slug2),
  ]);

  if (!resultA.success || !resultB.success || !resultA.data || !resultB.data) {
    notFound();
  }

  const herbA = resultA.data;
  const herbB = resultB.data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
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
      </div>
    </div>
  );
}
