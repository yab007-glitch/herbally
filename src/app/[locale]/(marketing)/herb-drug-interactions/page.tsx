import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { InteractionExplainer } from "@/components/herbs/interaction-explainer";
import { EmbedSnippet } from "@/components/embed/embed-snippet";
import { StackChecker } from "@/components/interactions/stack-checker";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { InteractionChecker } from "../interaction-checker";

export const revalidate = 3600;

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "herbDrugInteractions",
    descKey: "herbDrugInteractionsDesc",
    path: "/herb-drug-interactions",
  });

const COMMON_HERBS = [
  { slug: "st-johns-wort", nameKey: "cStJohnsWort" },
  { slug: "garlic", nameKey: "cGarlic" },
  { slug: "turmeric", nameKey: "cTurmeric" },
  { slug: "ginger", nameKey: "cGinger" },
  { slug: "ginkgo-biloba", nameKey: "cGinkgo" },
  { slug: "kava", nameKey: "cKava" },
  { slug: "milk-thistle", nameKey: "cMilkThistle" },
  { slug: "ashwagandha", nameKey: "cAshwagandha" },
] as const;

export default async function HerbDrugInteractionsPage() {
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: "herbDrugInteractionsPage",
  });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const fr = locale === "fr";
  const baseUrl = siteUrl();
  const url = `${baseUrl}${fr ? "/fr" : ""}/herb-drug-interactions`;

  return (
    <ToolsMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <WebPageSchema
          type="MedicalWebPage"
          title={t("heading")}
          description={t("intro")}
          url={url}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: t("heading"),
              description: t("intro"),
              url,
              inLanguage: ["en", "fr"],
              isAccessibleForFree: true,
              license: `${baseUrl}/methodology`,
              version: "2026-11",
              distribution: [
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/catalog.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/medications.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/interactions.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/quarantine.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/privacy-manifest.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/review-queue.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/manifest.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/schema.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "application/json",
                  contentUrl: `${baseUrl}/open-data/source-monitor-latest.json`,
                },
                {
                  "@type": "DataDownload",
                  encodingFormat: "text/plain",
                  contentUrl: `${baseUrl}/llms-full.txt`,
                },
              ],
              creator: {
                "@type": "Organization",
                name: "HerbAlly",
                url: baseUrl,
              },
              variableMeasured: [
                "Herb Name",
                "Medication or Drug Class",
                "Potential Interaction Severity",
                "Evidence Level & Clinician Review Status",
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
        <BreadcrumbListSchema
          items={[
            { name: "Home", url: "/" },
            { name: t("heading"), url: "/herb-drug-interactions" },
          ]}
        />

        <Breadcrumbs
          items={[
            { name: tCommon("breadcrumbHome"), href: "/" },
            { name: t("heading") },
          ]}
        />

        <header className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="size-6" aria-hidden="true" />
            <span className="text-sm font-medium uppercase tracking-wide">
              {t("heading")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("heading")}
          </h1>
          <p className="text-lg text-muted-foreground">{t("intro")}</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle
              className="size-3.5 text-amber-600"
              aria-hidden="true"
            />
            <Link
              href="/methodology"
              className="hover:text-foreground hover:underline"
            >
              {fr
                ? "Référence éducative issue de monographies publiques — fiches héritées non révisées par un clinicien"
                : "Educational reference compiled from public monographs — legacy interaction rows lack clinician sign-off"}
            </Link>
          </p>
        </header>

        {/* Clear Mode Selector so first-time visitors immediately see both checking modes */}
        <nav
          aria-label={
            fr
              ? "Choisir un mode de vérification"
              : "Choose interaction check mode"
          }
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          <a
            href="#single-checker"
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {fr ? "Mode 1 · Paire unique" : "Mode 1 · Single Pair Lookup"}
            </span>
            <span className="mt-1 text-sm font-semibold text-foreground">
              {fr ? "1 plante + 1 médicament" : "1 herb + 1 medication"}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {fr
                ? "Recherche structurée immédiate dans nos 515 paires sourcées."
                : "Instant structured lookup across 515 cited pairs."}
            </span>
          </a>
          <a
            href="#stack-checker"
            className="flex flex-col justify-between rounded-xl border border-primary/35 bg-primary/5 p-4 transition-colors hover:border-primary"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {fr
                ? "Mode 2 · Bilan multi-plantes"
                : "Mode 2 · Full Supplement Stack"}
            </span>
            <span className="mt-1 text-sm font-semibold text-foreground">
              {fr
                ? "Plusieurs plantes + plusieurs médicaments"
                : "Multiple herbs + multiple medications"}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {fr
                ? "Détecte 7 voies de risque cumulatif + résumé imprimable local."
                : "Flags 7 cumulative overlap pathways + printable local brief."}
            </span>
          </a>
        </nav>

        {/* The checker itself, on the page.
          This used to be a card explaining that the checker lives on the
          homepage, with a button that sent the visitor there — on the one page
          whose subject is checking a combination. */}
        <section id="single-checker" className="mt-8 scroll-mt-24">
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            {t("checkerCtaTitle")}
          </h2>
          <InteractionChecker showBrowseLink={false} />
        </section>

        <div className="mt-8">
          <StackChecker />
        </div>

        <section
          id="stack-capabilities"
          aria-labelledby="stack-capabilities-heading"
          className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <h2
            id="stack-capabilities-heading"
            className="text-lg font-semibold text-foreground"
          >
            {fr
              ? "Moteur multi-plantes à 7 classes pharmacologiques & export local (.txt / .json)"
              : "7-Class Cumulative Pharmacology Overlap Engine & Browser-Local Brief Export (.txt / .json)"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fr
              ? "En plus des vérifications par paire (y compris anticoagulants AOD : rivaroxaban, dabigatran, apixaban, édoxaban et clopidogrel), le vérificateur multi-plantes détecte automatiquement 7 classes de risque cumulatif lorsque deux plantes ou plus convergent sur une même voie :"
              : "Beyond pair-by-pair lookups (including DOAC anticoagulants rivaroxaban, dabigatran, apixaban, edoxaban, and clopidogrel), the multi-herb checker automatically flags 7 cumulative pharmacological overlap classes when two or more herbs converge on the same pathway:"}
          </p>
          <ul className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {[
              {
                code: "bleeding_overlap",
                sev: fr ? "Grave" : "Severe",
                en: "Cumulative bleeding risk (anticoagulants, DOACs, antiplatelets, NSAIDs)",
                fr: "Risque hémorragique cumulatif (anticoagulants, AOD, antiplaquettaires, AINS)",
              },
              {
                code: "serotonin_overlap",
                sev: fr ? "Grave" : "Severe",
                en: "Cumulative serotonergic overload signal (SSRIs, SNRIs, MAOIs, triptans)",
                fr: "Surcharge sérotoninergique cumulative (ISRS, IRSN, IMAO, triptans)",
              },
              {
                code: "qt_cardiac_overlap",
                sev: fr ? "Grave" : "Severe",
                en: "Cardiac rhythm, digoxin & electrolyte-depletion overlap",
                fr: "Chevauchement cardiaque, digoxine et déplétion potassique",
              },
              {
                code: "hepatotoxicity_overlap",
                sev: fr ? "Modéré" : "Moderate",
                en: "Additive hepatic metabolism & liver-stress signal",
                fr: "Signal cumulatif de charge ou toxicité hépatique",
              },
              {
                code: "hypoglycemia_overlap",
                sev: fr ? "Modéré" : "Moderate",
                en: "Cumulative blood-glucose lowering overlap",
                fr: "Effet cumulatif d'hypoglycémie (insuline, metformine, sulfonylurées)",
              },
              {
                code: "sedation_overlap",
                sev: fr ? "Modéré" : "Moderate",
                en: "Cumulative CNS sedation & fall-risk overlap",
                fr: "Sédation et somnolence cumulatives du SNC",
              },
              {
                code: "cyp_enzyme_overlap",
                sev: fr ? "Modéré" : "Moderate",
                en: "Overlapping CYP3A4 / CYP2C9 / CYP2C19 / CYP2D6 / P-gp / UGT modulation",
                fr: "Interactions multiples sur les enzymes et transporteurs (CYP / P-gp / UGT)",
              },
            ].map((rule) => (
              <li
                key={rule.code}
                className="rounded-lg border border-border/80 bg-background p-2.5"
              >
                <span className="font-mono font-semibold text-foreground">
                  {rule.code}
                </span>{" "}
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                  {rule.sev}
                </span>
                <p className="mt-1">{fr ? rule.fr : rule.en}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            <strong className="text-foreground">
              {fr
                ? "Export local confidentiel (.txt / .json) :"
                : "Browser-Local Consultation Brief (.txt / .json):"}
            </strong>{" "}
            {fr
              ? "Chaque bilan multi-plantes peut être téléchargé en texte brut (.txt) ou JSON structuré (.json) directement dans votre navigateur, sans aucun envoi ni conservation de données de santé sur nos serveurs."
              : "Every multi-herb screening run exports formatted .txt and structured .json consultation briefs generated 100% locally in your browser with zero server upload or PHI storage."}
          </p>
          <p className="mt-2.5 flex flex-wrap gap-3 text-xs font-medium">
            <a
              href="/open-data/review-queue.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/review-queue.json
            </a>
            <a
              href="/open-data/privacy-manifest.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/privacy-manifest.json
            </a>
            <a
              href="/open-data/schema.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/schema.json (OpenAPI 3.1)
            </a>
          </p>
        </section>

        <section className="mt-8 flex flex-col justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("npnBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("npnBannerBody")}
            </p>
          </div>
          <Link
            href="/npn-checker"
            className={buttonVariants({ className: "shrink-0" })}
          >
            {t("npnBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

        <section className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("medicationsBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("medicationsBannerBody")}
            </p>
          </div>
          <Link
            href="/medications"
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0",
            })}
          >
            {t("medicationsBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

        <section className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("surgeryBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("surgeryBannerBody")}
            </p>
          </div>
          <Link
            href="/surgery-planner"
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0",
            })}
          >
            {t("surgeryBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

        <div className="mt-8">
          <InteractionExplainer />
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            {t("commonHeading")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {COMMON_HERBS.map((h) => (
              <Link
                key={h.slug}
                href={`/herbs/${h.slug}`}
                className="rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200"
              >
                {t(h.nameKey)}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border bg-muted/30 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("embedTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("embedBody")}</p>
          <EmbedSnippet />
          <p className="mt-3 text-xs">
            <Link
              href="/widgets"
              className="font-medium text-primary hover:underline"
            >
              {t("widgetsHubLink")} →
            </Link>
          </p>
        </section>

        <section className="mt-10 rounded-2xl border bg-muted/30 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("ctaTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ctaBody")}</p>
          <div className="mt-4">
            <Link href="/herbalist" className={buttonVariants()}>
              {t("ctaButton")}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </section>

        <ClinicalSupportCallout locale={locale} />
      </div>
    </ToolsMessagesProvider>
  );
}
