import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
  Leaf,
  Pill,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { fitTitle } from "@/lib/seo/fit-title";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { Button } from "@/components/ui/button";
import { getMedicationBySlug } from "@/lib/interactions/medications";
import type {
  InteractionPair,
  InteractionSeverity,
} from "@/lib/interactions/pairs";
import { pairPath } from "@/lib/interactions/pair-url";
import { cn } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ drug: string }> };

const loadMedication = cache((slug: string, locale: string) =>
  getMedicationBySlug(slug, locale)
);

const SEVERITY_ORDER: InteractionSeverity[] = [
  "contraindicated",
  "severe",
  "moderate",
  "mild",
];

const SEVERITY_CARD_STYLE: Record<InteractionSeverity, string> = {
  contraindicated:
    "border-red-300 bg-red-50/70 dark:border-red-800 dark:bg-red-950/30",
  severe:
    "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
  moderate:
    "border-orange-200 bg-orange-50/40 dark:border-orange-900/60 dark:bg-orange-950/20",
  mild: "border-yellow-200 bg-yellow-50/40 dark:border-yellow-900/60 dark:bg-yellow-950/20",
};

const SEVERITY_BADGE_STYLE: Record<InteractionSeverity, string> = {
  contraindicated:
    "border-red-300 bg-red-200 text-red-900 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200",
  severe:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
  moderate:
    "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  mild: "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function severityLabel(severity: InteractionSeverity, fr: boolean): string {
  if (fr) {
    switch (severity) {
      case "contraindicated":
        return "Contre-indiqué";
      case "severe":
        return "Grave";
      case "moderate":
        return "Modéré";
      default:
        return "Léger";
    }
  }
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function evidenceLabel(level: string | null, fr: boolean): string | null {
  if (!level) return null;
  if (fr) {
    switch (level) {
      case "clinical":
      case "strong":
        return "Preuve clinique";
      case "moderate":
        return "Preuve modérée";
      case "case_report":
        return "Cas clinique";
      case "theoretical":
      case "limited":
        return "Mécanisme théorique";
      case "traditional":
        return "Usage traditionnel";
      default:
        return level;
    }
  }
  switch (level) {
    case "case_report":
      return "Case report";
    case "clinical":
      return "Clinical evidence";
    case "theoretical":
      return "Theoretical mechanism";
    case "traditional":
      return "Traditional warning";
    default:
      return `${level.charAt(0).toUpperCase()}${level.slice(1)} evidence`;
  }
}

function SeverityIcon({ severity }: { severity: InteractionSeverity }) {
  const cls = "size-4 shrink-0";
  if (severity === "contraindicated") return <AlertOctagon className={cls} />;
  if (severity === "severe") return <AlertTriangle className={cls} />;
  if (severity === "moderate") return <Info className={cls} />;
  return <ShieldCheck className={cls} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { drug } = await params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const med = await loadMedication(drug, locale);

  if (!med) {
    return {
      title: {
        absolute: fr
          ? "Médicament Non Trouvé | HerbAlly"
          : "Medication Not Found | HerbAlly",
      },
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = siteUrl();
  const path = `/medications/${med.drugSlug}`;
  const title = fitTitle(
    fr
      ? [
          `${med.drugName} et plantes médicinales : ${med.totalInteractions} interactions`,
          `${med.drugName} : interactions avec les plantes`,
          `${med.drugName} — Plantes à éviter`,
        ]
      : [
          `${med.drugName}: ${med.totalInteractions} Herb & Supplement Interactions`,
          `${med.drugName} Herb & Supplement Interactions`,
          `${med.drugName} — Herbs to Avoid`,
        ]
  );

  const herbPreview = med.sampleHerbs
    .slice(0, 3)
    .map((h) => h.name)
    .join(", ");

  const description = (
    fr
      ? `${med.totalInteractions} plante${med.totalInteractions > 1 ? "s" : ""} interagissant avec ${med.drugName} (${herbPreview}). Gravité, mécanisme et sources citées.`
      : `${med.totalInteractions} herb${med.totalInteractions === 1 ? "" : "s"} and supplement${med.totalInteractions === 1 ? "" : "s"} documented to interact with ${med.drugName} (including ${herbPreview}). Severity, mechanisms & citations.`
  ).slice(0, 158);

  const canonicalUrl =
    med.hasFr && fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`;
  const ogTitle =
    typeof title === "string"
      ? title
      : title && "absolute" in title
        ? title.absolute
        : med.drugName;

  return {
    title,
    description,
    ...(fr && !med.hasFr ? { robots: { index: false, follow: true } } : {}),
    alternates: med.hasFr
      ? {
          canonical: canonicalUrl,
          languages: {
            en: `${baseUrl}${path}`,
            fr: `${baseUrl}/fr${path}`,
            "x-default": `${baseUrl}${path}`,
          },
        }
      : {
          canonical: `${baseUrl}${path}`,
          languages: {
            en: `${baseUrl}${path}`,
            "x-default": `${baseUrl}${path}`,
          },
        },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      type: "article",
      images: [
        {
          url: `${baseUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${med.drugName} herb interactions`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [`${baseUrl}/twitter-image`],
    },
  };
}

export default async function MedicationDetailPage({ params }: Props) {
  const { drug } = await params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const med = await loadMedication(drug, locale);

  if (!med) notFound();

  const baseUrl = siteUrl();
  const path = `${fr && med.hasFr ? "/fr" : ""}/medications/${med.drugSlug}`;
  const pageUrl = `${baseUrl}${path}`;

  const grouped = new Map<InteractionSeverity, InteractionPair[]>();
  for (const sev of SEVERITY_ORDER) {
    const items = med.interactions.filter((i) => i.severity === sev);
    if (items.length > 0) grouped.set(sev, items);
  }

  const herbListText = med.sampleHerbs
    .slice(0, 5)
    .map((h) => h.name)
    .join(", ");

  const faqs = [
    {
      question: fr
        ? `Quelles plantes interagissent avec ${med.drugName} ?`
        : `Which herbs interact with ${med.drugName}?`,
      answer: fr
        ? `${med.totalInteractions} plantes sont documentées dans HerbAlly pour interagir avec ${med.drugName}, notamment ${herbListText}. Le niveau de risque le plus élevé enregistré est « ${severityLabel(med.highestSeverity, true)} ».`
        : `${med.totalInteractions} herb${med.totalInteractions === 1 ? " is" : "s are"} documented in HerbAlly to interact with ${med.drugName}, including ${herbListText}. The highest recorded risk tier is ${severityLabel(med.highestSeverity, false)}.`,
    },
    {
      question: fr
        ? `Puis-je prendre une tisane ou un complément si je prends ${med.drugName} ?`
        : `Should I avoid herbal supplements while taking ${med.drugName}?`,
      answer: fr
        ? "Certaines plantes peuvent modifier l'efficacité ou la toxicité du médicament (métabolisme CYP450, absorption ou effets additifs). Vérifiez chaque plante individuellement et demandez confirmation à votre pharmacien."
        : "Some herbs alter drug levels or add pharmacological side effects (such as bleeding, sedation, or CYP450 changes). Always screen each botanical ingredient and confirm with your pharmacist before starting or stopping supplements.",
    },
  ];

  const pageTitle = fr
    ? `${med.drugName} : interactions avec les plantes médicinales`
    : `${med.drugName} Herb & Supplement Interactions`;
  const pageDescription = fr
    ? `${med.totalInteractions} plantes documentées interagissant avec ${med.drugName}, classées par niveau de risque et mécanisme.`
    : `${med.totalInteractions} herbs and supplements documented to interact with ${med.drugName}, organized by severity and mechanism.`;

  return (
    <div className="space-y-8">
      <WebPageSchema
        type="MedicalWebPage"
        title={pageTitle}
        description={pageDescription}
        url={pageUrl}
        dateModified={med.updatedAt ?? undefined}
        breadcrumbs={[
          { name: tCommon("home"), url: `${baseUrl}${fr ? "/fr" : ""}` },
          {
            name: fr ? "Médicaments" : "Medications",
            url: `${baseUrl}${fr ? "/fr" : ""}/medications`,
          },
          { name: med.drugName, url: pageUrl },
        ]}
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
          { name: med.drugName, url: `/medications/${med.drugSlug}` },
        ]}
      />
      <FAQSchema items={faqs} />

      <Breadcrumbs
        items={[
          { name: tCommon("breadcrumbHome"), href: "/" },
          {
            name: fr
              ? "Interactions plante-médicament"
              : "Herb–Drug Interactions",
            href: "/herb-drug-interactions",
          },
          {
            name: fr ? "Médicaments" : "Medications",
            href: "/medications",
          },
          { name: med.drugName },
        ]}
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <Pill className="size-4" aria-hidden="true" />
            <span>{fr ? "Fiche médicament" : "Medication Reverse Lookup"}</span>
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              SEVERITY_BADGE_STYLE[med.highestSeverity]
            )}
          >
            <SeverityIcon severity={med.highestSeverity} />
            {fr ? "Risque maximal : " : "Highest risk: "}
            {severityLabel(med.highestSeverity, fr)}
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {pageTitle}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {fr
            ? `${med.totalInteractions} plante${med.totalInteractions > 1 ? "s ont" : " a"} une interaction documentée avec ${med.drugName}. Sélectionnez une fiche ci-dessous pour consulter les précautions détaillées.`
            : `${med.totalInteractions} medicinal herb${med.totalInteractions === 1 ? " has a" : "s have"} documented interaction${med.totalInteractions === 1 ? "" : "s"} with ${med.drugName}. Select any pair for full clinical notes and references.`}
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

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-4">
        {SEVERITY_ORDER.map((sev) => (
          <div key={sev}>
            <dt className="text-xs font-medium text-muted-foreground">
              {severityLabel(sev, fr)}
            </dt>
            <dd className="mt-1 text-xl font-bold text-foreground">
              {med.countsBySeverity[sev]}
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([sev, items]) => (
          <section key={sev} className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <SeverityIcon severity={sev} />
              <span>
                {severityLabel(sev, fr)} ({items.length})
              </span>
            </h2>

            <ul className="space-y-3">
              {items.map((pair) => {
                const ev = evidenceLabel(pair.evidenceLevel, fr);
                return (
                  <li
                    key={pair.id}
                    className={cn(
                      "rounded-2xl border p-4 sm:p-5",
                      SEVERITY_CARD_STYLE[pair.severity]
                    )}
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <Link
                          href={`/herbs/${pair.herbSlug}`}
                          className="inline-flex items-center gap-1.5 text-lg font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          <Leaf
                            className="size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{pair.herbName}</span>
                        </Link>
                        {pair.herbScientificName && (
                          <span className="ml-2 text-xs italic text-muted-foreground">
                            ({pair.herbScientificName})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            SEVERITY_BADGE_STYLE[pair.severity]
                          )}
                        >
                          {severityLabel(pair.severity, fr)}
                        </span>
                        {ev && (
                          <span className="rounded-full border bg-background/80 px-2.5 py-0.5 text-xs text-muted-foreground">
                            {ev}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
                      {pair.description}
                    </p>

                    {pair.mechanism && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {fr ? "Mécanisme : " : "Mechanism: "}
                        </span>
                        {pair.mechanism}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
                      <div className="text-muted-foreground">
                        {pair.sourceUrl ? (
                          <a
                            href={pair.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 underline hover:text-foreground"
                          >
                            <span>
                              {fr ? "Source : " : "Source: "}
                              {pair.source || pair.sourceUrl}
                            </span>
                            <ExternalLink
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span>
                            {pair.source
                              ? `${fr ? "Source : " : "Source: "}${pair.source}`
                              : fr
                                ? "Pharmacologie clinique répertoriée"
                                : "Recorded clinical pharmacology"}
                          </span>
                        )}
                      </div>

                      <Link
                        href={pairPath(pair.herbSlug, pair.drugName)}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <span>
                          {fr
                            ? `Fiche complète ${pair.herbName} + ${med.drugName}`
                            : `Full ${pair.herbName} + ${med.drugName} interaction`}
                        </span>
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {fr
              ? `Vous prenez ${med.drugName} avec plusieurs plantes ?`
              : `Taking ${med.drugName} with multiple supplements?`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fr
              ? "Saisissez toute votre liste dans le vérificateur multi-interactions pour repérer les risques cumulés."
              : "Check your complete list of herbs and prescriptions together for overlapping bleeding, sedation, or CYP450 effects."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/herb-drug-interactions#stack-checker" />}
          >
            {fr ? "Vérificateur multiple" : "Check Full Stack"}
            <ArrowRight className="ml-1 size-4" />
          </Button>
          <Button variant="outline" render={<Link href="/medications" />}>
            <ArrowLeft className="mr-1 size-4" />
            {fr ? "Tous les médicaments" : "All Medications"}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {fr ? "Questions fréquentes" : "Frequently asked questions"}
        </h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.question}
              className="rounded-lg border bg-background p-4"
            >
              <summary className="cursor-pointer font-medium text-foreground">
                {f.question}
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {fr
          ? "Informations éducatives uniquement — pas un avis médical. Confirmez toujours toute prise ou interruption avec votre médecin ou votre pharmacien."
          : "Educational information only — not medical advice. Always verify with a healthcare professional or pharmacist before combining or stopping any medication."}
      </p>
    </div>
  );
}
