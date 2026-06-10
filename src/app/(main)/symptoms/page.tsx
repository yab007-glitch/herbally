import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  Flame,
  Heart,
  Leaf,
  Moon,
  Shield,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "HerbAlly - Herbs by Symptom",
  description:
    "Find the right herbs for your symptoms. Browse evidence-based herbal recommendations for anxiety, sleep, inflammation, digestion, and more.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"}/symptoms`,
  },
  openGraph: {
    title: "HerbAlly - Herbs by Symptom",
    description:
      "Find the right herbs for your symptoms. Browse evidence-based herbal recommendations.",
    url: "https://herbally.app/symptoms",
    type: "website",
    siteName: "HerbAlly",
  },
};

const categoryConfig = [
  {
    key: "mental",
    icon: Brain,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    symptoms: [
      { subkey: "anxiety", query: "anxiety" },
      { subkey: "depression", query: "depression" },
      { subkey: "sleep", query: "sleep" },
      { subkey: "focus", query: "focus" },
    ],
  },
  {
    key: "pain",
    icon: Flame,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    symptoms: [
      { subkey: "inflammation", query: "inflammation" },
      { subkey: "joint", query: "joint" },
      { subkey: "headache", query: "headache" },
      { subkey: "nerve", query: "nerve" },
    ],
  },
  {
    key: "digestive",
    icon: Leaf,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    symptoms: [
      { subkey: "indigestion", query: "digestion" },
      { subkey: "nausea", query: "nausea" },
      { subkey: "constipation", query: "constipation" },
      { subkey: "liver", query: "liver" },
    ],
  },
  {
    key: "heart",
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    symptoms: [
      { subkey: "bloodPressure", query: "blood-pressure" },
      { subkey: "cholesterol", query: "cholesterol" },
      { subkey: "circulation", query: "circulation" },
    ],
  },
  {
    key: "immune",
    icon: Shield,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    symptoms: [
      { subkey: "cold", query: "cold" },
      { subkey: "cough", query: "cough" },
      { subkey: "allergy", query: "allergy" },
      { subkey: "immuneSupport", query: "immune" },
    ],
  },
  {
    key: "womens",
    icon: Moon,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    symptoms: [
      { subkey: "menstrual", query: "menstrual" },
      { subkey: "menopause", query: "menopause" },
      { subkey: "hormonal", query: "hormonal" },
    ],
  },
  {
    key: "skin",
    icon: Stethoscope,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    symptoms: [
      { subkey: "eczema", query: "skin" },
      { subkey: "wound", query: "wound" },
      { subkey: "acne", query: "acne" },
    ],
  },
];

export default async function SymptomsPage() {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const _locale: Locale = localeCookie?.value === "fr" ? "fr" : "en";
  const t = await getTranslations();

  const symptomCategories = categoryConfig.map((cat) => ({
    ...cat,
    title: t(`symptomsPage.${cat.key}.title`),
    symptoms: cat.symptoms.map((s) => ({
      ...s,
      name: t(`symptomsPage.${cat.key}.${s.subkey}.name`),
      description: t(`symptomsPage.${cat.key}.${s.subkey}.desc`),
    })),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("symptomsPage.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {t("symptomsPage.subtitle")}
        </p>
      </div>

      {/* Safety Notice */}
      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{t("symptomsPage.disclaimerTitle")}</p>
            <p className="mt-1">{t("symptomsPage.disclaimerText")}</p>
          </div>
        </div>
      </div>

      {/* Symptom Categories */}
      <div className="space-y-10">
        {symptomCategories.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <section key={category.key}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`inline-flex size-10 items-center justify-center rounded-lg ${category.bgColor}`}
                >
                  <CategoryIcon className={`size-5 ${category.color}`} />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {category.title}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {category.symptoms.map((symptom) => (
                  <Link
                    key={symptom.subkey}
                    href={`/symptoms/${encodeURIComponent(symptom.query)}`}
                    className="group"
                  >
                    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {symptom.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {symptom.description}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                          {t("symptomsPage.browseHerbs")}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 rounded-lg border bg-muted/50 p-6 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {t("symptomsPage.notSureTitle")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("symptomsPage.notSureDesc")}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Stethoscope className="size-4" />
            {t("symptomsPage.askHerbalist")}
          </Link>
          <Link
            href="/herbs"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Leaf className="size-4" />
            {t("symptomsPage.browseAllHerbs")}
          </Link>
        </div>
      </div>
    </div>
  );
}
