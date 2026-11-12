import { buildPageMetadata } from "@/lib/i18n/metadata";
import { SymptomSearchClient } from "./symptom-search-client";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { LocalizedLink } from "@/components/i18n/localized-link";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ArrowRight } from "lucide-react";
import { SYMPTOM_SLUGS } from "@/lib/symptoms/symptom-meta";
import { getEmptySymptomHubs } from "@/lib/symptoms/hub-coverage";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "herbsBySymptom",
    descKey: "herbsBySymptomDesc",
    path: "/symptoms",
  });

export default async function SymptomsPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const prefix = locale === "fr" ? "/fr" : "";

  // Do not link a hub that has no herbs behind it. Those four hubs render an
  // empty state while returning 200, which Google reports as a soft 404 —
  // exactly 8 URLs, 4 hubs x 2 locales. They are already excluded from the
  // sitemap and marked noindex; the leak was that this index linked them
  // anyway, which is how Googlebot kept finding them. They reappear here on
  // their own once herbs match their keywords, since this is a live check.
  const emptyHubs = new Set(await getEmptySymptomHubs());

  return (
    <div>
      <BreadcrumbListSchema
        items={[
          { name: t("common.home"), url: prefix || "/" },
          { name: t("symptomsPage.title"), url: `${prefix}/symptoms` },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("symptomsPage.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("symptomsPage.subtitle")}
        </p>
      </div>
      <SymptomSearchClient />

      {/*
        Crawlable index of the symptom hubs. The search UI below the fold is a
        client component rendered as buttons, so the 26 /symptoms/<slug> pages
        had zero incoming internal links and sat orphaned in the sitemap (they
        are a large share of the "crawled - currently not indexed" bucket).
        Server-rendered links fix the discovery problem at its source.
      */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t("symptomsPage.allSymptomsHeading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("symptomsPage.allSymptomsIntro")}
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SYMPTOM_SLUGS.filter((slug) => !emptyHubs.has(slug)).map((slug) => (
            <li key={slug}>
              <LocalizedLink
                href={`/symptoms/${slug}`}
                className="group flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <span>{t(`symptomMeta.${slug}.title`)}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </LocalizedLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
