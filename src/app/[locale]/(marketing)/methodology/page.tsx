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
import { getGovernanceCoverageStats } from "@/lib/governance/coverage-stats";

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
  const [t, governanceStats] = await Promise.all([
    getTranslations({ locale }),
    getGovernanceCoverageStats(),
  ]);

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

        {/* Evidence Type vs. Evidence Certainty Matrix */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>
              <h2 className="flex items-center gap-3">
                <Scale className="size-6 text-primary" aria-hidden="true" />
                {locale === "fr"
                  ? "Type d'étude vs certitude des preuves (notes par indication)"
                  : "Evidence Type vs. Evidence Certainty (Indication-Specific Grades)"}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              {locale === "fr"
                ? "Un niveau global unique ne résume pas toutes les allégations d'une plante. Chaque étude est classée par type expérimental afin de ne jamais confondre travaux in vitro ou computationnels et données cliniques humaines."
                : "A single herb-wide grade cannot summarize every indication or preparation. Indication-level study grades supersede summary badges and classify study design separately from clinical certainty so in-vitro or computational findings are never mislabelled as anecdotal folklore."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th className="py-2 pr-4 font-semibold">
                      {locale === "fr"
                        ? "Type de preuve"
                        : "Study / Evidence Type"}
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      {locale === "fr" ? "Classification" : "Certainty Tier"}
                    </th>
                    <th className="py-2 font-semibold">
                      {locale === "fr"
                        ? "Portée clinique"
                        : "Interpretation Scope"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Plusieurs ECR humains concordants"
                        : "Multiple consistent human RCTs"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr" ? "Élevé (Niveau A)" : "High (Grade A)"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Applicable à l'indication et la dose étudiées"
                        : "Bound to the specific studied extract, dose, and indication"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Études cliniques humaines limitées"
                        : "Limited human clinical studies"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr"
                        ? "Modéré (Niveau B)"
                        : "Moderate (Grade B)"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Signaux prometteurs mais réplication requise"
                        : "Promising clinical signal; replication needed"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Données observationnelles / séries de cas"
                        : "Human observational or case reports"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr"
                        ? "Faible / Préliminaire (Niveau C)"
                        : "Low / Preliminary (Grade C)"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Hypothèse clinique, pas de lien causal établi"
                        : "Clinical hypothesis or safety signal; non-randomized"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Modèles animaux (in vivo)"
                        : "Animal studies (in vivo)"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr" ? "Préclinique" : "Preclinical"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Mécanisme ou toxicologie non extrapolables directement"
                        : "Mechanistic or toxicological; not clinical efficacy in humans"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Essais cellulaires / enzymatiques (in vitro)"
                        : "Cell / enzyme assays (in vitro)"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr" ? "Laboratoire" : "Laboratory"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Criblage de laboratoire sans preuve d'absorption humaine"
                        : "Bench-level bioactivity; bioavailability unestablished"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Modélisation informatique (in silico)"
                        : "Computational / docking (in silico)"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr"
                        ? "In silico (modélisation)"
                        : "In silico"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Génération d'hypothèses uniquement"
                        : "Theoretical prediction only"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Usage traditionnel / pharmacopée historique"
                        : "Historical traditional use"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr"
                        ? "Traditionnel (Trad)"
                        : "Traditional (Trad)"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Documenté en phytothérapie traditionnelle, distinct des essais"
                        : "Historical/traditional monograph record, distinct from RCT proof"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {locale === "fr"
                        ? "Témoignages ou usages anecdotiques"
                        : "Anecdotal / unsystematic reports"}
                    </td>
                    <td className="py-2 pr-4">
                      {locale === "fr"
                        ? "Anecdotique (Niveau D)"
                        : "Anecdotal (Grade D)"}
                    </td>
                    <td className="py-2">
                      {locale === "fr"
                        ? "Validation scientifique insuffisante"
                        : "Insufficient scientific validation"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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

        {/* Live Governance Coverage Dashboard & Public Corrections Log */}
        <section
          id="governance-coverage"
          aria-labelledby="governance-coverage-heading"
          className="mt-12 space-y-6 scroll-mt-24"
        >
          <div>
            <h2
              id="governance-coverage-heading"
              className="text-xl font-bold text-foreground"
            >
              {locale === "fr"
                ? "Couverture de gouvernance en direct et journal des corrections"
                : "Live Governance Coverage & Public Corrections Log"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "fr"
                ? "Compteurs calculés directement depuis notre base publique afin de distinguer la vérification documentaire de la révision clinique agréée."
                : "Live counts queried from our public database distinguishing editorial source checks from licensed clinical sign-off."}
            </p>
          </div>

          {governanceStats.available ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {locale === "fr"
                    ? "Fiches plantes publiées"
                    : "Published Herb Profiles"}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {governanceStats.totalHerbs.toLocaleString(
                    locale === "fr" ? "fr-CA" : "en-CA"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {locale === "fr"
                    ? "Fiches avec source primaire vérifiée"
                    : "Source-Checked Profiles"}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {governanceStats.sourceCheckedHerbs.toLocaleString(
                    locale === "fr" ? "fr-CA" : "en-CA"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {locale === "fr"
                    ? "Monographies révisées par clinicien"
                    : "Clinician-Signed Herbs"}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {governanceStats.clinicallyReviewedHerbs.toLocaleString(
                    locale === "fr" ? "fr-CA" : "en-CA"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {locale === "fr"
                    ? "Interactions (approuvées / total)"
                    : "Interactions (Signed / Total)"}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {governanceStats.clinicianApprovedInteractions.toLocaleString(
                    locale === "fr" ? "fr-CA" : "en-CA"
                  )}{" "}
                  /{" "}
                  {governanceStats.totalInteractions.toLocaleString(
                    locale === "fr" ? "fr-CA" : "en-CA"
                  )}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {locale === "fr"
                    ? `${governanceStats.legacyUnreviewedInteractions.toLocaleString("fr-CA")} dossiers hérités en attente de révision clinique`
                    : `${governanceStats.legacyUnreviewedInteractions.toLocaleString("en-CA")} legacy records awaiting clinical sign-off`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              {locale === "fr"
                ? "Les compteurs en direct ne sont pas disponibles dans cet environnement de construction."
                : "Live governance metrics are temporarily unavailable in this environment."}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === "fr"
                  ? "Journal public des corrections récentes"
                  : "Recent Public Corrections Log"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {governanceStats.corrections.length > 0 ? (
                <ul className="divide-y divide-border/70">
                  {governanceStats.corrections.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {entry.affected_surface}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {entry.correction_summary}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {entry.corrected_at.slice(0, 10)}
                        {entry.verified_by ? ` · ${entry.verified_by}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {locale === "fr"
                    ? "Les nouvelles corrections validées publiées via le portail LinkedIn SSO ou la file d'incidents apparaîtront ici avec leur date et référence."
                    : "Verified post-release corrections published through our safety-incident or LinkedIn SSO edit queue are logged publicly here as they land."}
                </p>
              )}
              <div className="mt-4">
                <Link
                  href="/clinical-review"
                  className="text-xs font-medium text-primary underline underline-offset-4"
                >
                  {locale === "fr"
                    ? "Signaler une erreur ou suggérer une correction via LinkedIn SSO →"
                    : "Flag an inaccuracy or suggest a correction via LinkedIn SSO →"}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

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
