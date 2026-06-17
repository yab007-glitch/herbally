import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { HomeSearchClient } from "./home-search-client";
import { Leaf } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        {/* Logo mark */}
        <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Leaf className="size-6" />
        </div>

        {/* Server-rendered hero — this is the LCP element */}
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("home.heroTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
          {t("home.heroSubtitle")}
        </p>

        <HomeSearchClient
          labels={{
            herbPlaceholder: t("home.herbPlaceholder"),
            medPlaceholder: t("home.medPlaceholder"),
            checkButton: t("home.checkButton"),
            suggestionsTitle: t("home.suggestionsTitle"),
            suggestion1: t("home.suggestion1"),
            suggestion2: t("home.suggestion2"),
            suggestion3: t("home.suggestion3"),
            suggestion4: t("home.suggestion4"),
            trustLine: t("home.trustLine"),
          }}
        />

        {/* Browse all herbs link */}
        <div className="mt-4">
          <Link
            href="/herbs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("home.heroButton")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
