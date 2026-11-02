import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
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
import { getLocale } from "@/lib/i18n/page-locale";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { cn } from "@/lib/utils";

// ISR, same reasoning as herbs/[slug]: the locale is a root param now, so
// on-demand static generation no longer throws. Pairs outside the prerendered
// set are generated on demand and cached.
export const revalidate = 86400;

type Props = { params: Promise<{ herb: string; drug: string }> };

/**
 * How many pair pages to pre-render at build time.
 *
 * Zero, deliberately: this is the most expensive route to generate
 * (getInteractionPair plus getRelatedPairs, the latter pulling up to 500
 * joined rows), and the build shares the 0.5 GB production database. Pairs are
 * generated on demand and cached instead. Indexability never depended on
 * prerendering — the sitemap lists every curated pair.
 */
const PRERENDER_PAIR_LIMIT = 0;

/**
 * Request-scoped memo around the pair fetch. generateMetadata and the page
 * component both call it with the same arguments, and neither call is cached,
 * so every render queried the database twice for the same row. React's cache
 * dedupes them within one render pass — which is every render here, since this
 * route is never served from a prerender.
 */
const loadPair = cache((herb: string, drug: string, locale: string) =>
  getInteractionPair(herb, drug, locale)
);

/**
 * No prerendering for now — see PRERENDER_PAIR_LIMIT. Every URL renders on
 * demand (dynamicParams defaults to true).
 */
export async function generateStaticParams() {
  if (PRERENDER_PAIR_LIMIT === 0) return [];

  const pairs = await getInteractionPairs();
  return pairs
    .slice(0, PRERENDER_PAIR_LIMIT)
    .map((p) => ({ herb: p.herbSlug, drug: p.drugSlug }));
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

/**
 * Evidence levels are stored as English enums (`well-documented`,
 * `moderate-evidence`, `limited-evidence`) straight from the curation sheet.
 * Rendering them raw leaked English onto every French page — the badge read
 * "Grave · well-documented" under a French headline. Map them to reader-facing
 * labels per locale, and fall back to the stored value for any level added
 * later so a new enum cannot crash the page.
 */
const EVIDENCE_LABELS_FR: Record<string, string> = {
  "well-documented": "preuves solides",
  "moderate-evidence": "preuves modérées",
  "limited-evidence": "preuves limitées",
};

const EVIDENCE_LABELS_EN: Record<string, string> = {
  "well-documented": "well-documented",
  "moderate-evidence": "moderate evidence",
  "limited-evidence": "limited evidence",
};

function evidenceLabel(level: string, fr: boolean): string {
  const table = fr ? EVIDENCE_LABELS_FR : EVIDENCE_LABELS_EN;
  return table[level] ?? level.replace(/-/g, " ");
}

/**
 * Severity-specific next step. Shared boilerplate ("talk to your doctor") is
 * useless advice on a contraindicated pair, and an over-cautious warning on a
 * mild one trains readers to ignore the page. The sentence has to match the
 * grade the reader is looking at.
 */
function practicalAdvice(
  severity: InteractionPair["severity"],
  herb: string,
  drug: string,
  fr: boolean
): string {
  if (fr) {
    switch (severity) {
      case "contraindicated":
        return `N'associez pas ${herb} et ${drug}. Si vous prenez déjà les deux, contactez votre médecin ou votre pharmacien aujourd'hui plutôt que d'attendre le prochain rendez-vous : la conduite à tenir se décide avec lui.`;
      case "severe":
        return `Évitez d'associer ${herb} et ${drug}, sauf si votre médecin le juge nécessaire et met en place un suivi rapproché. Si vous prenez déjà les deux, parlez-en avant toute nouvelle prise.`;
      case "moderate":
        return `${herb} et ${drug} peuvent être associés dans certains cas, mais pas sans surveillance. Demandez à votre pharmacien si un ajustement de dose ou un espacement des prises est indiqué dans votre situation.`;
      default:
        return `Aux doses habituelles, le risque est faible. Signalez tout de même la prise de ${herb} à votre pharmacien, en particulier si votre traitement change ou si vous devez être opéré.`;
    }
  }
  switch (severity) {
    case "contraindicated":
      return `Do not combine ${herb} and ${drug}. If you already take both, contact your doctor or pharmacist today rather than waiting for your next appointment — what happens next is their call, not yours.`;
    case "severe":
      return `Avoid combining ${herb} and ${drug} unless your doctor judges it necessary and sets up close monitoring. If you already take both, raise it before any further dose.`;
    case "moderate":
      return `${herb} and ${drug} can be used together in some cases, but not unmonitored. Ask your pharmacist whether a dose adjustment or spacing the doses applies to your situation.`;
    default:
      return `At usual doses the risk is low. Still tell your pharmacist that you take ${herb}, especially if your medication changes or you face surgery.`;
  }
}

function severityExplainer(fr: boolean): string {
  return fr
    ? "Contre-indiqué et grave signifient que l'association est à éviter ; modéré, qu'elle reste possible sous surveillance ; léger, que le risque est faible aux doses habituelles. Ce niveau décrit la gravité du risque si les deux sont pris ensemble, pas la probabilité de le ressentir."
    : "Contraindicated and severe mean the pair should be avoided; moderate means it can be used with monitoring; mild means low risk at usual doses. The grade describes how bad the outcome could be, not how likely you are to experience it.";
}

function evidenceExplainer(fr: boolean): string {
  return fr
    ? "Les preuves solides viennent d'études cliniques ou de cas publiés chez l'humain ; les preuves modérées, d'études limitées ou de cas isolés ; les preuves limitées, de mécanismes connus ou de travaux chez l'animal. Un niveau de preuve faible ne veut pas dire que l'interaction est imaginaire, mais que peu de personnes ont été étudiées."
    : "Strong evidence comes from clinical studies or published human case reports; moderate evidence from limited studies or isolated cases; limited evidence from known mechanisms or animal work. A weak evidence grade does not mean the interaction is imaginary — it means few people have been studied.";
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
  const locale = await getLocale();
  const fr = locale === "fr";
  const pair = await loadPair(herb, drug, locale);

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
  const locale = await getLocale();
  const fr = locale === "fr";
  const t = await getTranslations({ locale });
  const pair = await loadPair(herb, drug, locale);

  if (!pair) notFound();

  const [{ sameHerb, sameDrug }] = await Promise.all([
    getRelatedPairs(pair, locale),
  ]);
  const baseUrl = siteUrl();
  // Locale-aware: a /fr page that declares the English URL competes with its
  // own EN twin instead of pairing with it through hreflang.
  const path = `${fr ? "/fr" : ""}/interactions/${pair.herbSlug}/${pair.drugSlug}`;
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
        type="MedicalWebPage"
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
                  · {evidenceLabel(pair.evidenceLevel, fr)}
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

      {/* What to do — scaled by severity so the advice is about THIS pair,
          not boilerplate repeated across every page. */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {fr ? "Que faire concrètement" : "What to do in practice"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {practicalAdvice(pair.severity, pair.herbName, pair.drugName, fr)}
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {(fr
            ? [
                "N'arrêtez jamais un médicament prescrit de vous-même : un arrêt brutal peut être plus dangereux que l'interaction.",
                "Dites à votre pharmacien le nom exact de la plante et la forme prise (tisane, gélule, extrait, poudre), car la dose change le risque.",
                "Apportez la liste complète de vos médicaments et produits naturels à chaque rendez-vous.",
              ]
            : [
                "Never stop a prescribed medicine on your own — an abrupt stop can be more dangerous than the interaction.",
                "Tell your pharmacist the exact herb and the form you take (tea, capsule, extract, powder); the dose changes the risk.",
                "Bring the full list of your medicines and natural products to every appointment.",
              ]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {/* How to read the two grades. A reader cannot act on "severe · moderate
          evidence" without knowing what each axis means, and the page never
          explained it. */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {fr ? "Comment lire ces niveaux" : "How to read these grades"}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/40 p-4">
            <dt className="text-sm font-semibold text-foreground">
              {fr ? "Niveau de risque" : "Risk level"}
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              {severityExplainer(fr)}
            </dd>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <dt className="text-sm font-semibold text-foreground">
              {fr ? "Niveau de preuve" : "Evidence level"}
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              {evidenceExplainer(fr)}
            </dd>
          </div>
        </dl>
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
