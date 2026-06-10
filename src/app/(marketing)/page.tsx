import { getTranslations } from "next-intl/server";
import { HomePageClient } from "./home-page-client";

export default async function HomePage() {
  const t = await getTranslations();

  const labels = {
    heroTitle: t("home.heroTitle"),
    heroSubtitle: t("home.heroSubtitle"),
    heroButton: t("home.heroButton"),
    herbPlaceholder: t("home.herbPlaceholder"),
    medPlaceholder: t("home.medPlaceholder"),
    checkButton: t("home.checkButton"),
    suggestionsTitle: t("home.suggestionsTitle"),
    suggestion1: t("home.suggestion1"),
    suggestion2: t("home.suggestion2"),
    suggestion3: t("home.suggestion3"),
    suggestion4: t("home.suggestion4"),
    trustLine: t("home.trustLine"),
  };

  return <HomePageClient labels={labels} />;
}
