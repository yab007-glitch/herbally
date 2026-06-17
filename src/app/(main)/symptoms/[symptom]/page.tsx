import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Stethoscope, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { type Locale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";

export const revalidate = 3600;

type Props = { params: Promise<{ symptom: string }> };

const symptomMeta: Record<
  string,
  { title: string; description: string; keywords: string[]; dbKeyword: string }
> = {
  anxiety: {
    title: "Herbs for Anxiety & Stress",
    description:
      "Evidence-based herbs for anxiety and stress relief. Compare effectiveness, safety, and drug interactions for herbs like Ashwagandha, Valerian, and Lavender.",
    keywords: [
      "anxiety herbs",
      "natural anxiety relief",
      "herbs for stress",
      "calming herbs",
      "adaptogens for anxiety",
    ],
    dbKeyword: "anxiety",
  },
  depression: {
    title: "Herbs for Depression & Mood",
    description:
      "Evidence-based herbs for depression and mood support. Compare effectiveness, safety, and drug interactions for St. John's Wort, Saffron, and more.",
    keywords: [
      "herbs for depression",
      "natural mood support",
      "st johns wort depression",
      "herbal antidepressants",
    ],
    dbKeyword: "depression",
  },
  sleep: {
    title: "Herbs for Sleep & Insomnia",
    description:
      "Evidence-based herbs for better sleep. Compare effectiveness, safety, and drug interactions for Valerian, Chamomile, and Melatonin.",
    keywords: [
      "sleep herbs",
      "natural sleep aids",
      "herbs for insomnia",
      "calming herbs for sleep",
      "valerian for sleep",
    ],
    dbKeyword: "sleep",
  },
  focus: {
    title: "Herbs for Focus & Memory",
    description:
      "Evidence-based herbs for cognitive enhancement and focus. Compare effectiveness and safety for Ginkgo, Bacopa, Rhodiola, and more.",
    keywords: [
      "herbs for focus",
      "nootropic herbs",
      "cognitive enhancement herbs",
      "bacopa for memory",
      "ginkgo for focus",
    ],
    dbKeyword: "focus",
  },
  inflammation: {
    title: "Herbs for Inflammation",
    description:
      "Evidence-based anti-inflammatory herbs. Compare effectiveness, safety, and drug interactions for Turmeric, Ginger, Boswellia, and more.",
    keywords: [
      "anti-inflammatory herbs",
      "herbs for inflammation",
      "natural inflammation relief",
      "turmeric benefits",
      "ginger for inflammation",
    ],
    dbKeyword: "inflammation",
  },
  joint: {
    title: "Herbs for Joint & Muscle Pain",
    description:
      "Evidence-based herbs for joint pain, arthritis, and muscle soreness. Compare effectiveness and safety for Turmeric, Boswellia, Devil's Claw, and more.",
    keywords: [
      "herbs for joint pain",
      "natural arthritis relief",
      "turmeric for joints",
      "boswellia for arthritis",
      "herbs for muscle pain",
    ],
    dbKeyword: "joint",
  },
  headache: {
    title: "Herbs for Headaches & Migraines",
    description:
      "Evidence-based herbs for headache and migraine relief. Compare effectiveness and safety for Feverfew, Butterbur, Peppermint, and more.",
    keywords: [
      "herbs for headaches",
      "natural migraine relief",
      "feverfew for migraines",
      "herbal headache remedies",
    ],
    dbKeyword: "headache",
  },
  digestion: {
    title: "Herbs for Digestive Health",
    description:
      "Evidence-based herbs for digestive issues including bloating, nausea, and IBS. Compare effectiveness and safety for Peppermint, Ginger, Fennel, and more.",
    keywords: [
      "herbs for digestion",
      "natural digestive remedies",
      "peppermint for IBS",
      "ginger for nausea",
      "herbs for bloating",
    ],
    dbKeyword: "digestion",
  },
  liver: {
    title: "Herbs for Liver Health",
    description:
      "Evidence-based herbs for liver support and detoxification. Compare effectiveness and safety for Milk Thistle, Dandelion Root, Turmeric, and more.",
    keywords: [
      "herbs for liver",
      "milk thistle benefits",
      "natural liver detox",
      "liver support herbs",
      "dandelion root for liver",
    ],
    dbKeyword: "liver",
  },
  bloodPressure: {
    title: "Herbs for Blood Pressure",
    description:
      "Evidence-based herbs for blood pressure management. Compare effectiveness and safety for Garlic, Hibiscus, Hawthorn, and more.",
    keywords: [
      "herbs for blood pressure",
      "natural blood pressure remedies",
      "garlic for hypertension",
      "hibiscus for blood pressure",
    ],
    dbKeyword: "blood-pressure",
  },
  cholesterol: {
    title: "Herbs for Cholesterol",
    description:
      "Evidence-based herbs for cholesterol management. Compare effectiveness and safety for Garlic, Red Yeast Rice, Artichoke, and more.",
    keywords: [
      "herbs for cholesterol",
      "natural cholesterol remedies",
      "garlic for cholesterol",
      "red yeast rice benefits",
    ],
    dbKeyword: "cholesterol",
  },
  circulation: {
    title: "Herbs for Circulation",
    description:
      "Evidence-based herbs for circulation and cardiovascular health. Compare effectiveness and safety for Ginkgo, Cayenne, Horse Chestnut, and more.",
    keywords: [
      "herbs for circulation",
      "ginkgo for circulation",
      "natural circulation remedies",
      "herbs for cardiovascular health",
    ],
    dbKeyword: "circulation",
  },
  immune: {
    title: "Herbs for Immune Support",
    description:
      "Evidence-based herbs for immune system support. Compare effectiveness and safety for Echinacea, Elderberry, Astragalus, and more.",
    keywords: [
      "herbs for immunity",
      "natural immune support",
      "echinacea benefits",
      "elderberry for colds",
      "adaptogen immune support",
    ],
    dbKeyword: "immune",
  },
  cold: {
    title: "Herbs for Colds & Flu",
    description:
      "Evidence-based herbs for cold and flu relief. Compare effectiveness and safety for Echinacea, Elderberry, Andrographis, and more.",
    keywords: [
      "herbs for colds",
      "natural flu remedies",
      "echinacea for colds",
      "elderberry for flu",
      "herbs for immunity",
    ],
    dbKeyword: "cold",
  },
  allergy: {
    title: "Herbs for Allergies",
    description:
      "Evidence-based herbs for allergy relief. Compare effectiveness and safety for Butterbur, Quercetin, Stinging Nettle, and more.",
    keywords: [
      "herbs for allergies",
      "natural allergy relief",
      "butterbur for allergies",
      "quercetin for allergies",
    ],
    dbKeyword: "allergy",
  },
  menstrual: {
    title: "Herbs for Menstrual Health",
    description:
      "Evidence-based herbs for menstrual cramps, PMS, and cycle support. Compare effectiveness and safety for Vitex, Cramp Bark, Ginger, and more.",
    keywords: [
      "herbs for menstrual cramps",
      "natural PMS relief",
      "vitex for hormones",
      "herbs for period pain",
    ],
    dbKeyword: "menstrual",
  },
  menopause: {
    title: "Herbs for Menopause",
    description:
      "Evidence-based herbs for menopause symptom relief. Compare effectiveness and safety for Black Cohosh, Red Clover, Dong Quai, and more.",
    keywords: [
      "herbs for menopause",
      "black cohosh benefits",
      "natural menopause relief",
      "red clover for hot flashes",
    ],
    dbKeyword: "menopause",
  },
  hormonal: {
    title: "Herbs for Hormonal Balance",
    description:
      "Evidence-based herbs for hormonal balance and endocrine support. Compare effectiveness and safety for Vitex, Maca, Ashwagandha, and more.",
    keywords: [
      "herbs for hormones",
      "natural hormonal balance",
      "vitex for hormones",
      "maca for hormone balance",
    ],
    dbKeyword: "hormonal",
  },
  skin: {
    title: "Herbs for Skin Health",
    description:
      "Evidence-based herbs for skin conditions including acne, eczema, and wound healing. Compare effectiveness and safety for Tea Tree, Aloe, Calendula, and more.",
    keywords: [
      "herbs for skin",
      "natural skin remedies",
      "tea tree for acne",
      "aloe for skin",
      "calendula for eczema",
    ],
    dbKeyword: "skin",
  },
  wound: {
    title: "Herbs for Wound Healing",
    description:
      "Evidence-based herbs for wound healing and tissue repair. Compare effectiveness and safety for Calendula, Comfrey, Aloe, and more.",
    keywords: [
      "herbs for wounds",
      "natural wound healing",
      "calendula for wounds",
      "comfrey for healing",
    ],
    dbKeyword: "wound",
  },
  acne: {
    title: "Herbs for Acne",
    description:
      "Evidence-based herbs for acne treatment and prevention. Compare effectiveness and safety for Tea Tree, Zinc, Burdock, and more.",
    keywords: [
      "herbs for acne",
      "natural acne remedies",
      "tea tree for acne",
      "burdock for skin",
    ],
    dbKeyword: "acne",
  },
  nerve: {
    title: "Herbs for Nerve Health",
    description:
      "Evidence-based herbs for nerve health and neuropathy support. Compare effectiveness and safety for St. John's Wort, Lion's Mane, and more.",
    keywords: [
      "herbs for nerves",
      "natural nerve support",
      "lions mane for nerves",
      "st johns wort for neuropathy",
    ],
    dbKeyword: "nerve",
  },
  prostate: {
    title: "Herbs for Prostate Health",
    description:
      "Evidence-based herbs for prostate support. Compare effectiveness and safety for Saw Palmetto, Pygeum, Stinging Nettle Root, and more.",
    keywords: [
      "herbs for prostate",
      "saw palmetto for prostate",
      "natural prostate support",
      "pygeum benefits",
    ],
    dbKeyword: "prostate",
  },
  diabetes: {
    title: "Herbs for Blood Sugar",
    description:
      "Evidence-based herbs for blood sugar management. Compare effectiveness and safety for Gymnema, Fenugreek, Bitter Melon, and more.",
    keywords: [
      "herbs for diabetes",
      "natural blood sugar support",
      "gymnema for blood sugar",
      "fenugreek for glucose",
    ],
    dbKeyword: "blood-sugar",
  },
  constipation: {
    title: "Herbs for Constipation",
    description:
      "Evidence-based herbs for constipation relief. Compare effectiveness and safety for Senna, Cascara, Psyllium, and more.",
    keywords: [
      "herbs for constipation",
      "natural laxatives",
      "senna for constipation",
      "psyllium for digestion",
    ],
    dbKeyword: "constipation",
  },
  nausea: {
    title: "Herbs for Nausea",
    description:
      "Evidence-based herbs for nausea and upset stomach. Compare effectiveness and safety for Ginger, Peppermint, Fennel, and more.",
    keywords: [
      "herbs for nausea",
      "natural nausea relief",
      "ginger for nausea",
      "peppermint for stomach",
    ],
    dbKeyword: "nausea",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symptom } = await params;
  const meta = symptomMeta[symptom];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  if (!meta) {
    return { title: "Not Found | HerbAlly", robots: { index: false } };
  }
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `${baseUrl}/symptoms/${symptom}`,
      languages: {
        "en": `${baseUrl}/symptoms/${symptom}`,
        "fr": `${baseUrl}/fr/symptoms/${symptom}`,
        "x-default": `${baseUrl}/symptoms/${symptom}`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${baseUrl}/symptoms/${symptom}`,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(symptomMeta).map((symptom) => ({ symptom }));
}

export default async function SymptomDetailPage({ params }: Props) {
  const { symptom } = await params;
  const meta = symptomMeta[symptom];

  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });
  if (!meta) {
    notFound();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let herbs: Array<{
    slug: string;
    name: string;
    scientific_name: string;
    evidence_level: string | null;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    traditional_uses: string[] | null;
    modern_uses: string[] | null;
  }> = [];

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("herbs")
        .select(
          "slug, name, scientific_name, evidence_level, pregnancy_safe, nursing_safe, traditional_uses, modern_uses"
        )
        .eq("is_published", true)
        .overlaps("symptom_keywords", [meta.dbKeyword])
        .order("evidence_level", { ascending: true })
        .limit(20);
      herbs = data || [];
    } catch {
      // Show empty state on error
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/symptoms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← {t("symptomsPage.allSymptoms")}
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground">
          {locale === "fr"
            ? t(`symptomMeta.${symptom}.title`) || meta.title
            : meta.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {locale === "fr"
            ? t(`symptomMeta.${symptom}.desc`) || meta.description
            : meta.description}
        </p>
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
            {herbs.map(
              (herb: {
                slug: string;
                name: string;
                scientific_name: string;
                evidence_level: string | null;
                pregnancy_safe: boolean | null;
                nursing_safe: boolean | null;
                traditional_uses: string[] | null;
                modern_uses: string[] | null;
              }) => (
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
                        </div>
                        <EvidenceGrade
                          level={
                            (herb.evidence_level || "C") as
                              | "A"
                              | "B"
                              | "C"
                              | "D"
                              | "trad"
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
              )
            )}
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
