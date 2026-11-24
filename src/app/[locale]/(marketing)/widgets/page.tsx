import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { MarketingMessagesProvider } from "@/components/i18n/marketing-messages-provider";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { WidgetBuilder } from "@/components/embed/widget-builder";
import { LibrarianCitationKit } from "@/components/embed/librarian-citation-kit";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";
import { Code2 } from "lucide-react";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "widgets",
    descKey: "widgetsDesc",
    path: "/widgets",
  });

export default async function WidgetsPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "widgetsPage" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const url = `${siteUrl()}${locale === "fr" ? "/fr" : ""}/widgets`;

  return (
    <MarketingMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <WebPageSchema
          title={t("heading")}
          description={t("intro")}
          url={url}
          breadcrumbs={[
            { name: tCommon("home"), url: siteUrl() },
            { name: t("heading"), url },
          ]}
        />
        <BreadcrumbListSchema
          items={[
            { name: "Home", url: "/" },
            { name: t("heading"), url: "/widgets" },
          ]}
        />

        <Breadcrumbs
          items={[
            { name: tCommon("breadcrumbHome"), href: "/" },
            { name: t("heading") },
          ]}
        />

        <header className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Code2 className="size-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t("eyebrow")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("heading")}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t("intro")}
          </p>
        </header>

        <div className="mt-8">
          <WidgetBuilder />
        </div>

        <LibrarianCitationKit />

        <ClinicalSupportCallout locale={locale} />
      </div>
    </MarketingMessagesProvider>
  );
}
