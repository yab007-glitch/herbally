import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowRight, Pill, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { buttonVariants } from "@/components/ui/button-variants";
import { getMedicationSummaries } from "@/lib/interactions/medications";
import { MedicationDirectoryClient } from "@/components/interactions/medication-directory-client";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  buildPageMetadata({
    titleKey: "medications",
    descKey: "medicationsDesc",
    path: "/medications",
  });

export default async function MedicationsIndexPage() {
  const locale = await getLocale();
  const fr = locale === "fr";
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const medications = await getMedicationSummaries(locale);

  const totalPairs = medications.reduce(
    (sum, m) => sum + m.totalInteractions,
    0
  );
  const criticalCount = medications.filter(
    (m) =>
      m.highestSeverity === "contraindicated" || m.highestSeverity === "severe"
  ).length;

  const baseUrl = siteUrl();
  const pageUrl = `${baseUrl}${fr ? "/fr" : ""}/medications`;
  const title = fr
    ? "Interactions par médicament : quelles plantes éviter"
    : "Medication Interaction Directory: Herbs to Avoid or Monitor";
  const description = fr
    ? "Recherchez votre médicament d'ordonnance ou classe thérapeutique pour consulter toutes les plantes médicinales qui interagissent avec lui, classées par gravité et sources scientifiques."
    : "Look up your prescription drug or medication class to see every medicinal herb documented to interact with it, ranked by severity with primary citations.";

  return (
    <div className="space-y-8">
      <WebPageSchema
        type="CollectionPage"
        title={title}
        description={description}
        url={pageUrl}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: title,
            description,
            url: pageUrl,
            inLanguage: ["en", "fr"],
            isAccessibleForFree: true,
            creator: {
              "@type": "Organization",
              name: "HerbAlly",
              url: baseUrl,
            },
            variableMeasured: [
              "Medication or Drug Class Scope",
              "Herb–Drug Potential Interaction Severity",
              "Clinical Review Status",
              "Primary Bibliographic Citation",
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          {
            name: fr
              ? "Interactions plante-médicament"
              : "Herb–Drug Interactions",
            url: "/herb-drug-interactions",
          },
          { name: fr ? "Médicaments" : "Medications", url: "/medications" },
        ]}
      />

      <Breadcrumbs
        items={[
          { name: tCommon("breadcrumbHome"), href: "/" },
          {
            name: fr
              ? "Interactions plante-médicament"
              : "Herb–Drug Interactions",
            href: "/herb-drug-interactions",
          },
          { name: fr ? "Médicaments" : "Medications" },
        ]}
      />

      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <Pill className="size-4" aria-hidden="true" />
          <span>
            {fr
              ? "Recherche inverse par médicament"
              : "Reverse Medication Lookup"}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {description}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            {fr
              ? "Révision éditoriale : Yasser Bheekun — MLT, OPTMQ · CSMLS"
              : "Editorially reviewed by Yasser Bheekun — MLT, OPTMQ · CSMLS"}
          </span>
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {fr
              ? "Médicaments et classes couverts"
              : "Medications & drug classes"}
          </dt>
          <dd className="mt-1 text-2xl font-bold text-foreground">
            {medications.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {fr ? "Associations documentées" : "Documented herb–drug pairs"}
          </dt>
          <dd className="mt-1 text-2xl font-bold text-foreground">
            {totalPairs}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {fr
              ? "Avec alerte grave ou contre-indication"
              : "With severe or contraindicated alerts"}
          </dt>
          <dd className="mt-1 text-2xl font-bold text-foreground">
            {criticalCount}
          </dd>
        </div>
      </dl>

      {medications.length > 0 &&
        medications.every((m) => m.publishedCount === 0) && (
          <div
            role="note"
            className="rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <p>
              {fr
                ? "Statut de révision : ces fiches héritées proviennent de compilations sourcées et attendent une validation indépendante par un clinicien agréé. Le badge ci-dessous indique la gravité maximale enregistrée pour chaque classe ou molécule, jamais que l'ensemble des fiches ont cette gravité."
                : "Review status: These legacy interaction records come from cited source compilations and await independent licensed clinician sign-off. The severity badge per row reflects the highest recorded risk in that drug entry, not that every paired herb has that severity."}
            </p>
            <p className="mt-1.5">
              {fr
                ? "Portée par classe thérapeutique : certaines entrées regroupent une classe (ex. anticoagulants ou ISRS) plutôt qu'une molécule isolée — chaque fiche individuelle précise la portée exacte et les données disponibles."
                : "Class-level entries: Some entries group a drug class (for example, anticoagulants or SSRIs) rather than a single molecule — check the specific pair page and confirm with your pharmacist before acting."}
            </p>
            <p className="mt-1.5">
              {fr
                ? "Note de couverture : les 509 fiches reflètent la taille actuelle du catalogue documenté, et non l'exhaustivité clinique. L'absence d'un couple ne prouve pas son innocuité."
                : "Coverage note: The 509 documented pairs measure current catalogue size, not complete clinical coverage. Absence of an unlisted herb–drug pair never establishes safety."}
            </p>
          </div>
        )}

      <MedicationDirectoryClient
        medications={medications.map((m) => ({
          drugSlug: m.drugSlug,
          drugName: m.drugName,
          enDrugName: m.enDrugName,
          totalInteractions: m.totalInteractions,
          publishedCount: m.publishedCount,
          highestSeverity: m.highestSeverity,
          countsBySeverity: m.countsBySeverity,
          sampleHerbs: m.sampleHerbs.slice(0, 4).map((h) => ({
            slug: h.slug,
            name: h.name,
          })),
        }))}
        locale={locale}
      />

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {fr
              ? "Vous prenez plusieurs plantes et plusieurs médicaments ?"
              : "Taking multiple herbs alongside your prescriptions?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fr
              ? "Testez votre combinaison complète en une seule fois dans le vérificateur multi-interactions."
              : "Screen your entire regimen at once using our Multi-Herb & Medication Stack Checker."}
          </p>
        </div>
        <Link
          href="/herb-drug-interactions#stack-checker"
          className={buttonVariants({ className: "shrink-0" })}
        >
          {fr ? "Ouvrir le vérificateur multiple" : "Open Stack Checker"}
          <ArrowRight className="ml-1 size-4" />
        </Link>
      </section>

      <p className="text-xs text-muted-foreground">
        {fr
          ? "Informations éducatives uniquement — ne constituent pas un avis médical. N'interrompez jamais un traitement prescrit sans l'avis de votre médecin ou de votre pharmacien."
          : "Educational information only — not medical advice. Never stop a prescribed medication without consulting your physician or pharmacist."}
      </p>

      <ClinicalSupportCallout locale={locale} />
    </div>
  );
}
