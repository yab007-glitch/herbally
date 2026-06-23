import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { HomeSearchClient } from "./home-search-client";
import { WelcomeToast } from "@/components/auth/welcome-toast";
import { Leaf } from "lucide-react";
import Link from "next/link";

// M10 (audit 2026-06-22): the homepage previously had no generateMetadata, so
// it emitted no canonical URL or hreflang alternates — the highest-traffic
// page lacked the locale signals Google uses for en/fr routing. buildPageMetadata
// derives canonical + en/fr/x-default alternates from the path "/".
export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "homeTitle", path: "/" });

export default async function HomePage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  return (
    <>
      <WelcomeToast />
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
              symptomsLink: t("home.symptomsLink"),
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
    </>
  );
}
