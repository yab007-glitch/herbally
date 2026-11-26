import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  BookOpen,
  FlaskConical,
  Shield,
  Scale,
  Microscope,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { ChipLegend } from "@/components/herbs/chip-legend";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { HerbsMessagesProvider } from "@/components/i18n/herbs-messages-provider";
import { siteUrl } from "@/lib/seo/site-url";
import { getReviewer } from "@/lib/data/reviewers";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "methodology",
    descKey: "methodologyDesc",
    path: "/methodology",
  });

const sectionKeys = [
  { key: "evidenceGrading", icon: Scale },
  { key: "sourceHierarchy", icon: BookOpen },
  { key: "safetyAssessment", icon: Shield },
  { key: "monographProcess", icon: Microscope },
  { key: "transparency", icon: FileCheck },
  { key: "activeCompounds", icon: FlaskConical },
] as const;

export default async function MethodologyPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  const methodologySections = sectionKeys.map(({ key, icon }) => ({
    icon,
    title: t(`methodologyContent.${key}.title`),
    content: t(`methodologyContent.${key}.content`),
  }));

  const url =
    locale === "fr"
      ? `${siteUrl()}/fr/methodology`
      : `${siteUrl()}/methodology`;
  const reviewer = getReviewer("yasser-bheekun");

  return (
    <HerbsMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <BreadcrumbListSchema
          items={[
            { name: "Home", url: "/" },
            { name: t("methodologyContent.title"), url: "/methodology" },
          ]}
        />
        {/* Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AboutPage",
              name: t("methodologyContent.title"),
              description: t("methodologyContent.subtitle"),
              url,
              publishingPrinciples: `${siteUrl()}${locale === "fr" ? "/fr" : ""}/editorial-policy`,
              ...(reviewer && {
                author: {
                  "@type": "Person",
                  name: reviewer.name,
                  jobTitle: reviewer.credentials,
                  url: reviewer.profileUrl,
                },
                editor: {
                  "@type": "Person",
                  name: reviewer.name,
                  jobTitle: `${reviewer.credentials} (Editorial maintainer — not a licensed physician clinical reviewer)`,
                  url: reviewer.profileUrl,
                  affiliation: {
                    "@type": "Organization",
                    name: reviewer.affiliation,
                  },
                },
              }),
              mainEntity: {
                "@type": "Organization",
                name: "HerbAlly",
                url: siteUrl(),
                publishingPrinciples: `${siteUrl()}/editorial-policy`,
              },
              publisher: {
                "@type": "Organization",
                name: "HerbAlly",
                url: siteUrl(),
              },
            }).replace(/</g, "\\u003c"),
          }}
        />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {t("methodologyContent.title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("methodologyContent.subtitle")}
          </p>
        </div>

        {/* The label key that used to sit in a collapsed block on every herb entry.
          Same explanations, one address, and the entries link here. */}
        <div className="mb-8">
          <ChipLegend defaultOpen />
        </div>

        <div className="space-y-8">
          {methodologySections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle>
                  <h2 className="flex items-center gap-3">
                    <section.icon
                      className="size-6 text-primary"
                      aria-hidden="true"
                    />
                    {section.title}
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {section.content.split("\n\n").map((paragraph, i) => {
                    if (paragraph.startsWith("**")) {
                      return (
                        <h3 key={i} className="text-lg font-semibold mt-6 mb-3">
                          {paragraph.replace(/\*\*/g, "")}
                        </h3>
                      );
                    }
                    if (paragraph.startsWith("1. ")) {
                      return (
                        <ol
                          key={i}
                          className="list-decimal list-inside space-y-2 mb-4"
                        >
                          {paragraph.split("\n").map((item, j) => (
                            <li key={j} className="text-muted-foreground">
                              {item
                                .replace(/^\d+\.\s*/, "")
                                .replace(/\*\*/g, "")}
                            </li>
                          ))}
                        </ol>
                      );
                    }
                    if (paragraph.startsWith("- ")) {
                      return (
                        <ul
                          key={i}
                          className="list-disc list-inside space-y-2 mb-4"
                        >
                          {paragraph.split("\n").map((item, j) => (
                            <li key={j} className="text-muted-foreground">
                              {item.replace(/^-\s*/, "").replace(/\*\*/g, "")}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={i} className="text-muted-foreground mb-4">
                        {paragraph.replace(/\*\*/g, "")}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Source Licensing & Attribution Register */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>
              <h2 className="flex items-center gap-3">
                <BookOpen className="size-6 text-primary" aria-hidden="true" />
                {locale === "fr"
                  ? "Registre des licences et attributions des sources"
                  : "Source Licensing & Attribution Register"}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              {locale === "fr"
                ? "HerbAlly importe et cite uniquement des sources ouvertes ou publiques autorisant la réutilisation commerciale avec attribution. Les bases non commerciales ou propriétaires (DDInter CC BY-NC-SA, ClarisHerba, DrugBank, Natural Medicines, Wikipédia CC BY-SA et monographies OMS sous droits réservés) sont exclues de nos flux automatisés."
                : "HerbAlly imports and reproduces structured excerpts only from public-domain or permissively licensed sources allowing commercial redistribution with attribution. Non-commercial or proprietary datasets (DDInter CC BY-NC-SA, ClarisHerba, DrugBank, Natural Medicines Database, Wikipedia CC BY-SA, and all-rights-reserved WHO monograph volumes) are excluded."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th className="py-2 pr-4 font-semibold">
                      {locale === "fr" ? "Source" : "Source"}
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      {locale === "fr" ? "Éditeur" : "Publisher"}
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      {locale === "fr" ? "Licence / statut" : "Licence / Terms"}
                    </th>
                    <th className="py-2 font-semibold">
                      {locale === "fr" ? "Portée" : "Scope"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[
                    {
                      name: "Health Canada LNHPD",
                      url: "https://health-products.canada.ca/lnhpd-bdpsnh/",
                      publisher: "Government of Canada",
                      licence: "Open Government Licence – Canada (OGL-Canada)",
                      scopeEn: "Indications, adult doses, risk statements",
                      scopeFr:
                        "Indications, posologies adultes, mises en garde",
                    },
                    {
                      name: "EMA HMPC Monographs",
                      url: "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
                      publisher: "European Medicines Agency",
                      licence: "EMA Legal Notice (attribution required)",
                      scopeEn:
                        "Well-established & traditional herbal monographs",
                      scopeFr: "Monographies bien établies et traditionnelles",
                    },
                    {
                      name: "NIH NCCIH / ODS / LiverTox",
                      url: "https://nccih.nih.gov/",
                      publisher: "U.S. NIH / NIDDK / NLM",
                      licence: "US Federal Public Domain (17 U.S.C. §105)",
                      scopeEn:
                        "Clinical overviews, liver safety, interaction notes",
                      scopeFr:
                        "Synthèses cliniques, hépatotoxicité, interactions",
                    },
                    {
                      name: "PubMed & PubChem (NCBI)",
                      url: "https://pubmed.ncbi.nlm.nih.gov/",
                      publisher: "U.S. National Library of Medicine",
                      licence: "NLM Data Terms / Fair Use (metadata & CIDs)",
                      scopeEn:
                        "Citation metadata (PMIDs) & chemical identifiers",
                      scopeFr: "Métadonnées bibliographiques (PMID) & chimie",
                    },
                    {
                      name: "GBIF Backbone & Wikidata",
                      url: "https://www.gbif.org/",
                      publisher: "GBIF Secretariat / Wikimedia",
                      licence: "CC BY 4.0 (GBIF) / CC0 1.0 (Wikidata data)",
                      scopeEn: "Botanical taxonomy cross-checking",
                      scopeFr: "Recoupement taxonomique botanique",
                    },
                  ].map((row) => (
                    <tr key={row.name}>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-primary underline underline-offset-4 hover:text-primary/80"
                        >
                          {row.name}
                        </a>
                      </td>
                      <td className="py-2 pr-4">{row.publisher}</td>
                      <td className="py-2 pr-4">{row.licence}</td>
                      <td className="py-2">
                        {locale === "fr" ? row.scopeFr : row.scopeEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-12 rounded-lg border bg-muted/50 p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {t("methodologyContent.questionsTitle")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("methodologyContent.questionsDesc")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/editorial-policy"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("footer.editorialPolicy")}
            </Link>
            <Link
              href="/clinical-review"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {locale === "fr" ? "Révision clinique" : "Clinical Review Portal"}
            </Link>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("methodologyContent.viewFaq")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("methodologyContent.contactUs")}
            </Link>
          </div>
        </div>
      </div>
    </HerbsMessagesProvider>
  );
}
