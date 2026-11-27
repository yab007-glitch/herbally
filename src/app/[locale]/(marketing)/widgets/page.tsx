import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { MarketingMessagesProvider } from "@/components/i18n/marketing-messages-provider";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { WidgetBuilder } from "@/components/embed/widget-builder";
import { LibrarianCitationKit } from "@/components/embed/librarian-citation-kit";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";
import { Code2, Database } from "lucide-react";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "widgets",
    descKey: "widgetsDesc",
    path: "/widgets",
  });

export default async function WidgetsPage() {
  const locale = await getLocale();
  const fr = locale === "fr";
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
        />
        <WebApplicationSchema
          name={t("heading")}
          description={t("intro")}
          url={url}
          featureList={[
            fr
              ? "Widget iframe bilingue sans publicité (/embed/checker)"
              : "Ad-free bilingual iframe interaction checker (/embed/checker)",
            fr
              ? "Trousse de citation prête à copier pour LibGuides"
              : "Copy-paste Librarian Citation Kit for university LibGuides",
            fr
              ? "Points d'accès Open Data JSON CORS ouvert (/open-data/*)"
              : "Public CORS-enabled Open Data JSON endpoints (/open-data/*)",
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

        <section
          aria-labelledby="open-data-heading"
          className="mt-10 space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Database className="size-4" aria-hidden="true" />
            <span>
              {fr
                ? "Données ouvertes et flux machine"
                : "Open Data JSON Catalog & Feeds"}
            </span>
          </div>
          <h2
            id="open-data-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "Catalogue JSON ouvert, flux RSS et spécifications IA"
              : "Open Data JSON Catalog, RSS Feed & AI Specifications"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Points de terminaison JSON CORS ouverts exposant les compteurs vérifiés en direct (3 122 plantes, 515 paires d'interactions, 145 médicaments et classes), le répertoire complet des médicaments, la liste de quarantaine toxicologique, le registre de confidentialité et le registre des licences sources sous CC BY 4.0. Chargeur externe compatible CSP stricte : /embed.js (<herbally-checker>)."
              : "Public CORS-enabled JSON endpoints exposing live verified counts (3,122 herbs, 515 interaction pairs, 145 medications/classes), the full reverse medication registry, the toxic botanical quarantine registry, the Law 25 / PIPEDA privacy manifest, and primary source licensing under CC BY 4.0 for compilation metadata. Strict-CSP external Web Component loader: /embed.js (<herbally-checker>)."}
          </p>
          <pre
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground"
          >
            <code>{`curl -s https://herbally.app/open-data/catalog.json
curl -s https://herbally.app/open-data/medications.json
curl -s https://herbally.app/open-data/interactions.json
curl -s https://herbally.app/open-data/quarantine.json
curl -s https://herbally.app/open-data/privacy-manifest.json
curl -s https://herbally.app/open-data/review-queue.json
curl -s https://herbally.app/open-data/manifest.json
curl -s https://herbally.app/open-data/schema.json
curl -s https://herbally.app/open-data/source-monitor-latest.json`}</code>
          </pre>
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <a
              href="/open-data/catalog.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/catalog.json
            </a>
            <a
              href="/open-data/medications.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/medications.json
            </a>
            <a
              href="/open-data/interactions.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/interactions.json
            </a>
            <a
              href="/open-data/quarantine.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/quarantine.json
            </a>
            <a
              href="/open-data/privacy-manifest.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/privacy-manifest.json
            </a>
            <a
              href="/open-data/review-queue.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/review-queue.json
            </a>
            <a
              href="/open-data/manifest.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/manifest.json (SHA-256)
            </a>
            <a
              href="/embed.js"
              className="text-primary underline underline-offset-4"
            >
              /embed.js (&lt;herbally-checker&gt;)
            </a>
            <a
              href="/open-data/schema.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/schema.json
            </a>
            <a
              href="/trust"
              className="text-primary underline underline-offset-4"
            >
              /trust
            </a>
            <a
              href="/llms-full.txt"
              className="text-primary underline underline-offset-4"
            >
              /llms-full.txt
            </a>
            <a
              href="/rss.xml"
              className="text-primary underline underline-offset-4"
            >
              /rss.xml
            </a>
          </div>
        </section>

        <ClinicalSupportCallout locale={locale} />
      </div>
    </MarketingMessagesProvider>
  );
}
