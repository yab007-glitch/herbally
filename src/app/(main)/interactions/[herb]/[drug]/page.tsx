import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldCheck,
  MessageCircle,
  Calculator,
  ArrowLeft,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import {
  getInteractionPair,
  getInteractionPairs,
  getRelatedPairs,
  type InteractionPair,
} from "@/lib/interactions/pairs";
import { pairPath } from "@/lib/interactions/pair-url";
import { siteUrl } from "@/lib/seo/site-url";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ herb: string; drug: string }> };

// Pre-render every curated pair for SEO. Pairs added later via admin render
// on demand (dynamicParams defaults to true) and join the sitemap within
// the hour via revalidate.
export async function generateStaticParams() {
  const pairs = await getInteractionPairs();
  return pairs.map((p) => ({ herb: p.herbSlug, drug: p.drugSlug }));
}

const SEVERITY_ORDER = [
  "contraindicated",
  "severe",
  "moderate",
  "mild",
] as const;

const SEVERITY_STYLE: Record<string, string> = {
  mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  moderate:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  severe:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  contraindicated:
    "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200 border-red-300 dark:border-red-700",
};

function verdictCopy(
  severity: InteractionPair["severity"],
  herb: string,
  drug: string,
  fr: boolean
): { headline: string; action: string } {
  if (fr) {
    switch (severity) {
      case "contraindicated":
        return {
          headline: `N'associez pas ${herb} et ${drug}`,
          action: `L'association ${herb} + ${drug} est contre-indiquée : le risque l'emporte sur tout bénéfice potentiel.`,
        };
      case "severe":
        return {
          headline: `${herb} + ${drug} : risque élevé`,
          action: `Évitez cette association sauf avis contraire explicite de votre médecin, avec suivi adapté.`,
        };
      case "moderate":
        return {
          headline: `${herb} + ${drug} : prudence requise`,
          action: `Possible sous surveillance : parlez-en à votre médecin ou pharmacien avant de combiner.`,
        };
      default:
        return {
          headline: `${herb} + ${drug} : risque faible`,
          action: `Risque faible aux doses habituelles, mais signalez tout symptôme inhabituel à un professionnel de santé.`,
        };
    }
  }
  switch (severity) {
    case "contraindicated":
      return {
        headline: `Do not combine ${herb} with ${drug}`,
        action: `The combination ${herb} + ${drug} is contraindicated: risk outweighs any potential benefit.`,
      };
    case "severe":
      return {
        headline: `${herb} + ${drug}: high risk`,
        action: `Avoid this combination unless your prescriber explicitly approves it with appropriate monitoring.`,
      };
    case "moderate":
      return {
        headline: `${herb} + ${drug}: use caution`,
        action: `May be possible under supervision — talk to your prescriber or pharmacist before combining.`,
      };
    default:
      return {
        headline: `${herb} + ${drug}: low risk`,
        action: `Low risk at usual doses, but report any unusual symptoms to a healthcare professional.`,
      };
  }
}

function severityLabel(
  severity: InteractionPair["severity"],
  fr: boolean
): string {
  if (fr) {
    return severity === "contraindicated"
      ? "Contre-indiqué"
      : severity === "severe"
        ? "Grave"
        : severity === "moderate"
          ? "Modéré"
          : "Léger";
  }
  return severity === "contraindicated"
    ? "Contraindicated"
    : severity.charAt(0).toUpperCase() + severity.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { herb, drug } = await params;
  const baseUrl = siteUrl();
  const locale = await getLocaleFromRequest();
  const fr = locale === "fr";
  const pair = await getInteractionPair(herb, drug);

  if (!pair) {
    return {
      title: fr
        ? "Interaction Non Trouvée | HerbAlly"
        : "Interaction Not Found | HerbAlly",
      robots: { index: false, follow: false },
    };
  }

  const title = fr
    ? `${pair.herbName} et ${pair.drugName} : interaction, gravité et conseils`
    : `${pair.herbName} and ${pair.drugName}: Interaction, Severity & Safety`;
  const description = (
    fr
      ? `Peut-on associer ${pair.herbName} (${pair.herbScientificName}) et ${pair.drugName} ? Gravité ${severityLabel(pair.severity, true).toLowerCase()}, mécanisme et conduite à tenir, avec sources.`
      : `Can you take ${pair.herbName} (${pair.herbScientificName}) with ${pair.drugName}? ${severityLabel(pair.severity, false)} interaction — mechanism, evidence and what to do, with sources.`
  ).slice(0, 158);
  const path = `/interactions/${pair.herbSlug}/${pair.drugSlug}`;

  return {
    title,
    description,
    alternates: {
      canonical: fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`,
      languages: {
        en: `${baseUrl}${path}`,
        fr: `${baseUrl}/fr${path}`,
        "x-default": `${baseUrl}${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}${path}`,
      type: "article",
    },
  };
}

function SeverityIcon({ severity }: { severity: InteractionPair["severity"] }) {
  const cls = "size-5 shrink-0";
  if (severity === "contraindicated") return <AlertOctagon className={cls} />;
  if (severity === "severe") return <AlertTriangle className={cls} />;
  if (severity === "moderate") return <Info className={cls} />;
  return <ShieldCheck className={cls} />;
}

export default async function InteractionPairPage({ params }: Props) {
  const { herb, drug } = await params;
  const locale = await getLocaleFromRequest();
  const fr = locale === "fr";
  const t = await getTranslations({ locale });
  const pair = await getInteractionPair(herb, drug);

  if (!pair) notFound();

  const [{ sameHerb, sameDrug }] = await Promise.all([getRelatedPairs(pair)]);
  const baseUrl = siteUrl();
  const path = `/interactions/${pair.herbSlug}/${pair.drugSlug}`;
  const url = `${baseUrl}${path}`;
  const verdict = verdictCopy(pair.severity, pair.herbName, pair.drugName, fr);
  const checkerQuery = fr
    ? `Puis-je prendre ${pair.herbName} avec ${pair.drugName} ?`
    : `Can I take ${pair.herbName} with ${pair.drugName}?`;

  const faqs = [
    {
      question: fr
        ? `Puis-je prendre ${pair.herbName} avec ${pair.drugName} ?`
        : `Can I take ${pair.herbName} with ${pair.drugName}?`,
      answer: `${verdict.headline}. ${verdict.action} ${pair.description}`,
    },
    {
      question: fr
        ? `Pourquoi ${pair.herbName} et ${pair.drugName} interagissent-ils ?`
        : `Why do ${pair.herbName} and ${pair.drugName} interact?`,
      answer:
        pair.mechanism ||
        (fr
          ? "Le mécanisme exact n'est pas entièrement élucidé — parlez-en à votre pharmacien."
          : "The exact mechanism is not fully characterized — discuss it with your pharmacist."),
    },
    {
      question: fr
        ? `Que faire si je prends déjà les deux ?`
        : `What should I do if I'm already taking both?`,
      answer: fr
        ? `N'arrêtez rien brutalement de votre propre initiative. Parlez-en rapidement à votre médecin ou pharmacien et apportez cette page à votre rendez-vous.`
        : `Do not stop either abruptly on your own. Talk to your prescriber or pharmacist promptly — bring this page to your appointment.`,
    },
  ];

  return (
    <div className="space-y-8">
      <WebPageSchema
        title={`${pair.herbName} and ${pair.drugName}: Interaction, Severity & Safety`}
        description={pair.description}
        url={url}
        dateModified={pair.updatedAt}
        breadcrumbs={[
          { name: "Home", url: baseUrl },
          {
            name: "Herb–Drug Interactions",
            url: `${baseUrl}/herb-drug-interactions`,
          },
          { name: `${pair.herbName} + ${pair.drugName}`, url },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Herb–Drug Interactions", url: "/herb-drug-interactions" },
          { name: `${pair.herbName} + ${pair.drugName}`, url: path },
        ]}
      />
      <FAQSchema items={faqs} />

      <Breadcrumbs
        items={[
          { name: t("common.breadcrumbHome"), href: "/" },
          {
            name: t("footer.herbDrugInteractions"),
            href: "/herb-drug-interactions",
          },
          { name: `${pair.herbName} + ${pair.drugName}` },
        ]}
      />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/herbs/${pair.herbSlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Leaf className="size-3.5" />
            {pair.herbName}
          </Link>
          <span className="text-muted-foreground">+</span>
          <span className="text-sm font-medium text-foreground">
            {pair.drugName}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {verdict.headline}
        </h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          {pair.herbScientificName}
        </p>
      </div>

      {/* Verdict hero */}
      <div
        className={cn("rounded-2xl border p-5", SEVERITY_STYLE[pair.severity])}
        role="note"
        aria-label={severityLabel(pair.severity, fr)}
      >
        <div className="flex items-start gap-3">
          <SeverityIcon severity={pair.severity} />
          <div>
            <p className="font-semibold capitalize">
              {severityLabel(pair.severity, fr)}
              {pair.evidenceLevel && (
                <span className="ml-2 text-xs font-normal opacity-80">
                  · {pair.evidenceLevel}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm">{verdict.action}</p>
          </div>
        </div>
      </div>

      {/* What the data says */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {fr ? "Ce que montrent les données" : "What the data shows"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {pair.description}
        </p>
        {pair.mechanism && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {fr ? "Mécanisme" : "Mechanism"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {pair.mechanism}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {fr ? "Source : " : "Source: "}
          {pair.sourceUrl ? (
            <a
              href={pair.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {pair.source || pair.sourceUrl}
            </a>
          ) : (
            pair.source || (fr ? "Base HerbAlly" : "HerbAlly database")
          )}
          {pair.updatedAt && (
            <>
              {" · "}
              {fr ? "Vérifié le " : "Reviewed "}
              {new Date(pair.updatedAt).toLocaleDateString(
                fr ? "fr-FR" : "en-US",
                { year: "numeric", month: "long" }
              )}
            </>
          )}
        </p>
      </section>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <Button
          render={
            <Link href={`/herbalist?q=${encodeURIComponent(checkerQuery)}`} />
          }
        >
          <MessageCircle className="mr-1 size-4" />
          {fr ? "Poser la question à l'herboriste IA" : "Ask the AI herbalist"}
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/calculator?herb=${pair.herbSlug}`} />}
        >
          <Calculator className="mr-1 size-4" />
          {fr ? "Calculer une dose" : "Calculate a dose"}
        </Button>
        <Button
          variant="ghost"
          render={<Link href={`/herbs/${pair.herbSlug}`} />}
        >
          <ArrowLeft className="mr-1 size-4" />
          {pair.herbName}
        </Button>
      </div>

      {/* Related pairs */}
      {sameHerb.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            {fr
              ? `Autres interactions de ${pair.herbName}`
              : `More ${pair.herbName} interactions`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {sameHerb
              .sort(
                (a, b) =>
                  SEVERITY_ORDER.indexOf(a.severity) -
                  SEVERITY_ORDER.indexOf(b.severity)
              )
              .map((p) => (
                <Link
                  key={p.id}
                  href={pairPath(p.herbSlug, p.drugName)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {p.herbName} + {p.drugName}
                </Link>
              ))}
          </div>
        </section>
      )}
      {sameDrug.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            {fr
              ? `Autres plantes interagissant avec ${pair.drugName}`
              : `More herbs that interact with ${pair.drugName}`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {sameDrug
              .sort(
                (a, b) =>
                  SEVERITY_ORDER.indexOf(a.severity) -
                  SEVERITY_ORDER.indexOf(b.severity)
              )
              .map((p) => (
                <Link
                  key={p.id}
                  href={pairPath(p.herbSlug, p.drugName)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {p.herbName} + {p.drugName}
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* FAQ */}
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
          ? "Informations éducatives uniquement — pas un avis médical. Vérifiez toujours auprès d'un professionnel de santé."
          : "Educational information only — not medical advice. Always verify with a healthcare professional."}
      </p>
    </div>
  );
}
