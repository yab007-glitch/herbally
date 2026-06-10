import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomePageClient } from "./home-page-client";

export const metadata: Metadata = {
  title: "HerbAlly — Virtual Herbalist | Medicinal Herbs & Drug Interactions",
  description:
    "Ask our AI herbalist about herb safety, drug interactions, and dosage. Explore 2,700+ medicinal herbs. Evidence-based answers from WHO, NCCIH, and PubMed. Free, no account required.",
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
  },
};

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <HomePageClient
      labels={{
        heroBadge: t("hero.badge"),
        heroTitle: t("hero.title"),
        heroSubtitle: t("hero.subtitle"),
        heroSearchButton: t("hero.searchButton"),
        heroAskHerbalistButton: t("hero.askHerbalistButton"),
        trustBadges: t.raw("hero.trustBadgesList") as string[],
        statsHeading: t("stats.heading"),
        statsHerbs: t("stats.herbs"),
        statsInteractions: t("stats.interactions"),
        statsFree: t("stats.free"),
        featuresTitle: t("features.title"),
        featuresSubtitle: t("features.subtitle"),
        ctaTitle: t("cta.title"),
        ctaSubtitle: t("cta.subtitle"),
        ctaButton: t("cta.button"),
        featureHerbsTitle: t("features.herbs.title"),
        featureHerbsDescription: t("features.herbs.description"),
        featureCalculatorTitle: t("features.calculator.title"),
        featureCalculatorDescription: t("features.calculator.description"),
        featureInteractionsTitle: t("features.interactions.title"),
        featureInteractionsDescription: t("features.interactions.description"),
        featureAiTitle: t("features.ai.title"),
        featureAiDescription: t("features.ai.description"),
      }}
    />
  );
}
