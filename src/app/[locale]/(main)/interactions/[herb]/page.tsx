import type { Metadata } from "next";
import { cache } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Calculator,
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
import { getHerbBySlug } from "@/lib/actions/herbs";
import { resolveHerbOr404 } from "@/lib/herbs/resolve-herb";
import {
  getHerbPairs,
  type InteractionPair,
  type InteractionSeverity,
} from "@/lib/interactions/pairs";
import {
  InteractionDataUnavailableError,
  isStubSupabase,
} from "@/lib/interactions/errors";
import { pairPath } from "@/lib/interactions/pair-url";
import { SEVERITY_WEIGHT } from "@/lib/interactions/stack";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { canShowDoseCalculator } from "@/lib/data/dangerous-herbs";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ herb: string }> };

const loadHerbAndPairs = cache(async (herbSlug: string, locale: string) => {
  const [herbResult, pairs] = await Promise.all([
    getHerbBySlug(herbSlug, { locale, skipCookies: true }),
    getHerbPairs(herbSlug, locale).catch((err) => {
      if (err instanceof InteractionDataUnavailableError && isStubSupabase()) {
        return [] as InteractionPair[];
      }
      throw err;
    }),
  ]);
  return { herbResult, pairs };
});

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

function SeverityIcon({ severity }: { severity: InteractionSeverity }) {
  const cls = "size-4 shrink-0";
  if (severity === "contraindicated") return <AlertOctagon className={cls} />;
  if (severity === "severe") return <AlertTriangle className={cls} />;
  if (severity === "moderate") return <Info className={cls} />;
  return <ShieldCheck className={cls} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { herb: herbSlug } = await params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const { herbResult, pairs } = await loadHerbAndPairs(herbSlug, locale);
  const herb = resolveHerbOr404(herbResult);

  const baseUrl = siteUrl();
  const path = `/interactions/${herb.slug}`;
  const frRecord = (
    herb.translations as { fr?: { description?: string } } | null
  )?.fr;
  const hasFr = Boolean(frRecord?.description || pairs.some((p) => p.hasFr));
  const title = fitTitle(
    fr
      ? [
          `${herb.name} : interactions médicamenteuses (${pairs.length})`,
          `${herb.name} et médicaments : interactions`,
        ]
      : [
          `${herb.name} Drug Interactions (${pairs.length} Medications)`,
          `${herb.name} Drug & Medication Interactions`,
        ]
  );

  const description = (
    fr
      ? pairs.length > 0
        ? `${pairs.length} médicament${pairs.length > 1 ? "s" : ""} avec interaction documentée pour ${herb.name} (${herb.scientific_name}) : gravité, mécanisme et sources scientifiques.`
        : `Consultez les données actuelles d'interactions médicamenteuses pour ${herb.name} (${herb.scientific_name}) et vérifiez votre combinaison.`
      : pairs.length > 0
        ? `${pairs.length} prescription medication${pairs.length === 1 ? "" : "s"} and drug class${pairs.length === 1 ? "" : "es"} documented to interact with ${herb.name} (${herb.scientific_name}). Severity grades & citations.`
        : `Check drug interaction status for ${herb.name} (${herb.scientific_name}) and screen combinations against medications.`
  ).slice(0, 158);

  const canonicalUrl =
    hasFr && fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`;
  const ogTitle =
    typeof title === "string"
      ? title
      : title && "absolute" in title
        ? title.absolute
        : `${herb.name} Interactions`;

  return {
    title,
    description,
    ...(pairs.length === 0 || (fr && !hasFr)
      ? { robots: { index: false, follow: true } }
      : {}),
    alternates: hasFr
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
          alt: `${herb.name} drug interactions`,
        },
      ],
    },
  };
}

export default async function HerbInteractionsHubPage({ params }: Props) {
  const { herb: herbSlug } = await params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const { herbResult, pairs } = await loadHerbAndPairs(herbSlug, locale);
  const herb = resolveHerbOr404(herbResult);

  const sortedPairs: InteractionPair[] = [...pairs].sort((a, b) => {
    const sevDiff =
      (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    return (a.localizedDrugName || a.drugName).localeCompare(
      b.localizedDrugName || b.drugName
    );
  });

  const baseUrl = siteUrl();
  const pageUrl = `${baseUrl}${fr ? "/fr" : ""}/interactions/${herb.slug}`;
  const title = fr
    ? `${herb.name} : interactions médicamenteuses`
    : `${herb.name} Drug Interactions`;
  const description = fr
    ? `${sortedPairs.length} interaction${sortedPairs.length > 1 ? "s" : ""} documentée${sortedPairs.length > 1 ? "s" : ""} entre ${herb.name} et les médicaments.`
    : `${sortedPairs.length} documented drug interaction${sortedPairs.length === 1 ? "" : "s"} for ${herb.name}.`;

  return (
    <div className="space-y-8">
      <WebPageSchema
        type="MedicalWebPage"
        title={title}
        description={description}
        url={pageUrl}
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
          { name: herb.name, url: `/interactions/${herb.slug}` },
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
          { name: herb.name },
        ]}
      />

      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <Leaf className="size-4" aria-hidden="true" />
          <span>{fr ? "Synthèse d'interactions" : "Herb Interaction Hub"}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm italic text-muted-foreground">
          {herb.scientific_name}
        </p>
        <p className="max-w-2xl text-base text-muted-foreground">
          {sortedPairs.length > 0
            ? fr
              ? `${sortedPairs.length} médicament${sortedPairs.length > 1 ? "s" : ""} ou classe${sortedPairs.length > 1 ? "s" : ""} thérapeutique${sortedPairs.length > 1 ? "s" : ""} sont répertorié${sortedPairs.length > 1 ? "s" : ""} avec ${herb.name}.`
              : `${sortedPairs.length} medication${sortedPairs.length === 1 ? " is" : "s and drug classes are"} documented to interact with ${herb.name}.`
            : fr
              ? `Aucune interaction médicament-plante structurée n'est encore enregistrée dans notre table pour ${herb.name}. L'absence de fiche ne garantit pas l'innocuité — vérifiez avec votre pharmacien.`
              : `No curated drug interaction pair is recorded yet for ${herb.name} in our table. Absence of a curated record does not prove safety — confirm with your pharmacist.`}
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

      {sortedPairs.length > 0 ? (
        <ul className="space-y-4">
          {sortedPairs.map((pair) => (
            <li
              key={pair.id}
              className={cn(
                "rounded-2xl border p-4 sm:p-5",
                SEVERITY_CARD_STYLE[pair.severity]
              )}
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/medications/${pair.drugSlug}`}
                  className="inline-flex items-center gap-1.5 text-lg font-semibold text-foreground hover:text-primary hover:underline"
                >
                  <Pill
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{pair.localizedDrugName || pair.drugName}</span>
                </Link>
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    SEVERITY_BADGE_STYLE[pair.severity]
                  )}
                >
                  <SeverityIcon severity={pair.severity} />
                  {severityLabel(pair.severity, fr)}
                </span>
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
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span>
                      {pair.source ||
                        (fr
                          ? "Pharmacologie clinique répertoriée"
                          : "Recorded clinical pharmacology")}
                    </span>
                  )}
                </div>
                <Link
                  href={pairPath(pair.herbSlug, pair.drugName)}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <span>
                    {fr ? "Fiche complète de la paire" : "Full pair analysis"}
                  </span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href={`/herbs/${herb.slug}`} className={buttonVariants()}>
          <Leaf className="mr-1.5 size-4" />
          {fr
            ? `Fiche complète de ${herb.name}`
            : `Full ${herb.name} monograph`}
        </Link>
        <Link
          href="/herb-drug-interactions#stack-checker"
          className={buttonVariants({ variant: "outline" })}
        >
          {fr ? "Tester plusieurs médicaments" : "Check Multi-Drug Stack"}
        </Link>
        <Link
          href="/medications"
          className={buttonVariants({ variant: "outline" })}
        >
          {fr ? "Répertoire des médicaments" : "Medications Directory"}
        </Link>
        {canShowDoseCalculator(herb.slug, herb.dosage_adult) && (
          <Link
            href={`/calculator?herb=${herb.slug}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            <Calculator className="mr-1.5 size-4" />
            {fr ? "Calculateur de dose" : "Dosage Calculator"}
          </Link>
        )}
      </div>
    </div>
  );
}
