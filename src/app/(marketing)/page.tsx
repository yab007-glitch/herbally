import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { type Locale } from "@/lib/i18n/config";
import { HomePageClient } from "./home-page-client";

export default async function HomePage() {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const t = await getTranslations();

  const labels = {
    heroTitle: t("home.heroTitle"),
    heroSubtitle: t("home.heroSubtitle"),
    heroButton: t("home.heroButton"),
    heroSecondary: t("home.heroSecondary"),
    featuresTitle: t("home.featuresTitle"),
    featureHerbsTitle: t("home.featureHerbsTitle"),
    featureHerbsDescription: t("home.featureHerbsDescription"),
    featureCalculatorTitle: t("home.featureCalculatorTitle"),
    featureCalculatorDescription: t("home.featureCalculatorDescription"),
    featureInteractionsTitle: t("home.featureInteractionsTitle"),
    featureInteractionsDescription: t("home.featureInteractionsDescription"),
    featureAiTitle: t("home.featureAiTitle"),
    featureAiDescription: t("home.featureAiDescription"),
  };

  return <HomePageClient labels={labels} />;
}
