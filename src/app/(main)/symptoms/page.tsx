import type { Metadata } from "next";
import { SymptomSearchClient } from "./symptom-search-client";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://herbally.app/symptoms",
    languages: {
      "en": "https://herbally.app/symptoms",
      "fr": "https://herbally.app/fr/symptoms",
      "x-default": "https://herbally.app/symptoms",
    },
  },
  title: "Find Herbs by Symptom",
  description: "Describe your symptoms in plain English and discover which medicinal herbs may help.",
};

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
