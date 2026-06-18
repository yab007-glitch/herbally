import { buildPageMetadata } from "@/lib/i18n/metadata";
import { SymptomSearchClient } from "./symptom-search-client";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "herbsBySymptom",
    descKey: "herbsBySymptomDesc",
    path: "/symptoms",
  });

export default async function SymptomsPage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("symptomsPage.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("symptomsPage.subtitle")}
        </p>
      </div>
      <SymptomSearchClient />
    </div>
  );
}
