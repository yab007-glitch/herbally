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
import { buttonVariants } from "@/components/ui/button-variants";
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
import {
  InteractionDataUnavailableError,
  InteractionUrlCollisionError,
  isStubSupabase,
} from "@/lib/interactions/errors";
import { pairPath } from "@/lib/interactions/pair-url";
import { siteUrl } from "@/lib/seo/site-url";
import { pairTitleMeta } from "@/lib/seo/pair-title";
import { getLocale } from "@/lib/i18n/page-locale";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { cn } from "@/lib/utils";
import { isCalculatorBlockedSlug } from "@/lib/data/dangerous-herbs";
import {
  classifyInteractionEvidence,
  getClinicalActionDisplay,
} from "@/lib/interactions/evidence";
import {
  getInteractionPreparationContext,
  sanitizeContradictoryEvidenceNote,
} from "@/lib/interactions/preparation-context";
import { classifyMedicationScope } from "@/lib/interactions/medication-scope";

// ISR, same reasoning as herbs/[slug]: the locale is a root param now, so
// on-demand static generation no longer throws. Pairs outside the prerendered
// set are generated on demand and cached. Three days: interaction data changes
// only through imports, and each revalidation costs an ISR write plus DB reads.
export const revalidate = 259200;

type Props = { params: Promise<{ herb: string; drug: string }> };

/**
 * How many pair pages to pre-render at build time.
 *
 * Zero, deliberately: this is the most expensive route to generate
 * (getInteractionPair plus getRelatedPairs), and the build shares the
 * production database. Pairs are
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
type PairLookupOutcome =
  | { kind: "ok"; pair: InteractionPair }
  | { kind: "not_found" }
  | { kind: "collision"; pairs: InteractionPair[] };

const loadPair = cache(
  async (
    herb: string,
    drug: string,
    locale: string
  ): Promise<PairLookupOutcome> => {
    try {
      const pair = await getInteractionPair(herb, drug, locale);
      return pair ? { kind: "ok", pair } : { kind: "not_found" };
    } catch (err) {
      if (err instanceof InteractionUrlCollisionError) {
        return { kind: "collision", pairs: err.pairs };
      }
      if (err instanceof InteractionDataUnavailableError) {
        if (isStubSupabase()) return { kind: "not_found" };
        throw err;
      }
      throw err;
    }
  }
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
  fr: boolean,
  isClinicianApproved: boolean
): { headline: string; action: string } {
  if (!isClinicianApproved) {
    if (fr) {
      switch (severity) {
        case "contraindicated":
          return {
            headline: `${herb} + ${drug} : signal de contre-indication potentielle (dossier hérité non révisé)`,
            action: `Signal hérité classé contre-indiqué sans approbation d'un clinicien. Évitez cette association par prudence et vérifiez avec un médecin ou pharmacien.`,
          };
        case "severe":
          return {
            headline: `${herb} + ${drug} : signal de risque élevé potentiel (dossier hérité non révisé)`,
            action: `Signal hérité classé élevé sans approbation d'un clinicien. Parlez-en à votre médecin ou pharmacien avant toute association.`,
          };
        case "moderate":
          return {
            headline: `${herb} + ${drug} : interaction modérée potentielle (dossier hérité non révisé)`,
            action: `Signal hérité de prudence : demandez conseil à votre médecin ou pharmacien avant de combiner.`,
          };
        default:
          return {
            headline: `${herb} + ${drug} : interaction faible potentielle (dossier hérité non révisé)`,
            action: `Signal hérité de risque faible, mais signalez tout symptôme inhabituel à un professionnel de santé.`,
          };
      }
    }
    switch (severity) {
      case "contraindicated":
        return {
          headline: `${herb} + ${drug}: potential contraindication signal (unreviewed legacy record)`,
          action: `Legacy classification flagged as potentially contraindicated without licensed clinical sign-off. Avoid combining and confirm with a prescriber or pharmacist.`,
        };
      case "severe":
        return {
          headline: `${herb} + ${drug}: potential high-risk signal (unreviewed legacy record)`,
          action: `Legacy classification flagged as high risk without licensed clinical sign-off. Consult your prescriber or pharmacist before combining.`,
        };
      case "moderate":
        return {
          headline: `${herb} + ${drug}: potential moderate interaction (unreviewed legacy record)`,
          action: `Legacy record suggests caution — confirm with your prescriber or pharmacist before combining.`,
        };
      default:
        return {
          headline: `${herb} + ${drug}: potential mild interaction (unreviewed legacy record)`,
          action: `Legacy record notes low risk at usual doses, though clinical validation is still pending.`,
        };
    }
  }
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

function severityExplainer(fr: boolean, unreviewed: boolean): string {
  if (unreviewed) {
    return fr
      ? "Ces niveaux indiquent des signaux potentiels issus de fiches héritées non encore validées par un clinicien agréé : contre-indiqué ou grave signalent une prudence maximale et motivent une vérification prioritaire avec votre pharmacien ; modéré ou léger appellent un suivi adapté."
      : "On unreviewed legacy records, these tiers represent potential pharmacological signals awaiting licensed clinical review: contraindicated or severe flags serve as conservative prompts to consult your pharmacist before combining, while moderate and mild flags note lower-acuity monitoring cues.";
  }
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
  const outcome = await loadPair(herb, drug, locale);

  if (outcome.kind === "collision") {
    const first = outcome.pairs[0];
    return {
      title: {
        absolute: fr
          ? `${first?.herbName ?? herb} : plusieurs fiches d'interaction | HerbAlly`
          : `${first?.herbName ?? herb}: Multiple Interaction Records | HerbAlly`,
      },
      robots: { index: false, follow: false },
    };
  }

  if (outcome.kind === "not_found") {
    return {
      title: {
        absolute: fr
          ? "Interaction Non Trouvée | HerbAlly"
          : "Interaction Not Found | HerbAlly",
      },
      robots: { index: false, follow: false },
    };
  }

  const pair = outcome.pair;

  const displayDrug = fr
    ? pair.localizedDrugName || pair.drugName
    : pair.drugName;
  // 105 of the 174 pair pages ran past 60 characters with the old fixed
  // suffix, so Google cut the part that identifies the pair. The budget lives
  // in src/lib/seo/pair-title.ts and accounts for the " | HerbAlly" template
  // that the rendered <title> carries.
  const title = pairTitleMeta(pair.herbName, displayDrug, fr);
  const ogTitle =
    typeof title === "string"
      ? title
      : title && typeof title === "object" && "absolute" in title
        ? String(title.absolute)
        : `${pair.herbName} + ${displayDrug}`;
  // 133 of 174 pairs carry no citation; the old description promised sources
  // on every one of them while the body said "no primary citation recorded".
  const hasCitation = Boolean(pair.source || pair.sourceUrl);
  const description = (
    fr
      ? `Peut-on associer ${pair.herbName} (${pair.herbScientificName}) et ${displayDrug} ? Gravité ${severityLabel(pair.severity, true).toLowerCase()}, mécanisme et conduite à tenir${hasCitation ? ", avec sources." : "."}`
      : `Can you take ${pair.herbName} (${pair.herbScientificName}) with ${displayDrug}? ${severityLabel(pair.severity, false)} interaction — mechanism, evidence and what to do${hasCitation ? ", with sources." : "."}`
  ).slice(0, 158);
  const path = `/interactions/${pair.herbSlug}/${pair.drugSlug}`;
  const canonicalUrl = fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`;

  return {
    title,
    description,
    ...(pair.publicationStatus !== "published"
      ? { robots: { index: false, follow: true } }
      : {}),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${baseUrl}${path}`,
        fr: `${baseUrl}/fr${path}`,
        "x-default": `${baseUrl}${path}`,
      },
    },
    openGraph: {
      title: ogTitle,
      description,
      // The French page used to share with the English URL here.
      url: canonicalUrl,
      type: "article",
      // Restated because a child openGraph object replaces the root one.
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
    },
    // Without this the Twitter card inherited the homepage title/description.
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: ["/twitter-image"],
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
  const outcome = await loadPair(herb, drug, locale);

  if (outcome.kind === "not_found") notFound();

  if (outcome.kind === "collision") {
    const lead = outcome.pairs[0];
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { name: t("common.breadcrumbHome"), href: "/" },
            {
              name: fr
                ? "Interactions plante-médicament"
                : "Herb–Drug Interactions",
              href: "/herb-drug-interactions",
            },
            { name: `${lead.herbName} + ${drug}` },
          ]}
        />
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 text-sm dark:border-amber-800 dark:bg-amber-950/30"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">
                {fr
                  ? `${lead.herbName} : plusieurs fiches d'interaction correspondent à cette adresse`
                  : `${lead.herbName}: Multiple interaction records match this URL`}
              </h1>
              <p className="text-muted-foreground">
                {fr
                  ? "Plusieurs fiches médicament distinctes partagent ce chemin et attendent une révision éditoriale. Toutes les fiches enregistrées sont affichées ci-dessous sans en masquer aucune — vérifiez auprès d'un pharmacien."
                  : "Multiple distinct medication records share this URL and are pending editorial disambiguation. All recorded entries are shown below rather than choosing one — confirm with a pharmacist."}
              </p>
            </div>
          </div>
        </div>
        <ul className="space-y-4">
          {outcome.pairs.map((p) => {
            const label = fr ? p.localizedDrugName || p.drugName : p.drugName;
            return (
              <li
                key={p.id}
                className={cn(
                  "rounded-2xl border p-5",
                  SEVERITY_STYLE[p.severity]
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {p.herbName} + {label}
                  </h2>
                  <span className="text-xs font-semibold uppercase">
                    {severityLabel(p.severity, fr)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground/90">
                  {p.description}
                </p>
                {p.mechanism && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong>{fr ? "Mécanisme : " : "Mechanism: "}</strong>
                    {p.mechanism}
                  </p>
                )}
                {(p.sourceUrl || p.source) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {fr ? "Source : " : "Source: "}
                    {p.sourceUrl ? (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {p.source || p.sourceUrl}
                      </a>
                    ) : (
                      p.source
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const pair = outcome.pair;

  const [{ sameHerb, sameDrug }] = await Promise.all([
    getRelatedPairs(pair, locale),
  ]);
  const baseUrl = siteUrl();
  // Locale-aware: a /fr page that declares the English URL competes with its
  // own EN twin instead of pairing with it through hreflang.
  const path = `${fr ? "/fr" : ""}/interactions/${pair.herbSlug}/${pair.drugSlug}`;
  const url = `${baseUrl}${path}`;
  const displayDrug = fr
    ? pair.localizedDrugName || pair.drugName
    : pair.drugName;
  const isClinicianApproved =
    pair.clinicalActionStatus === "clinician_approved";
  const verdict = verdictCopy(
    pair.severity,
    pair.herbName,
    displayDrug,
    fr,
    isClinicianApproved
  );
  const evidenceClass = classifyInteractionEvidence({
    evidenceLevel: pair.evidenceLevel,
    evidenceTier: pair.evidenceTier ?? "unknown",
    extrapolationScope: pair.extrapolationScope ?? "unverified",
  });
  const clinicalAction = getClinicalActionDisplay({
    publicationStatus:
      (pair.publicationStatus as
        | "legacy_unreviewed"
        | "draft"
        | "clinically_verified"
        | "published"
        | "quarantined_collision"
        | "retracted_hold") ?? "legacy_unreviewed",
    clinicalActionStatus:
      (pair.clinicalActionStatus as
        | "unreviewed_blocked"
        | "draft_pending_review"
        | "clinician_approved"
        | "suspended_collision_conflict") ?? "unreviewed_blocked",
    pairSpecificClinicalAction: pair.pairSpecificClinicalAction ?? null,
    locale: fr ? "fr" : "en",
  });
  const checkerQuery = fr
    ? `Puis-je prendre ${pair.herbName} avec ${displayDrug} ?`
    : `Can I take ${pair.herbName} with ${displayDrug}?`;

  const faqs = [
    {
      question: fr
        ? `Puis-je prendre ${pair.herbName} avec ${displayDrug} ?`
        : `Can I take ${pair.herbName} with ${displayDrug}?`,
      answer: `${verdict.headline}. ${clinicalAction.text} ${pair.description}`,
    },
    {
      question: fr
        ? `Pourquoi ${pair.herbName} et ${displayDrug} interagissent-ils ?`
        : `Why do ${pair.herbName} and ${displayDrug} interact?`,
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
        type={isClinicianApproved ? "MedicalWebPage" : "WebPage"}
        title={
          fr
            ? `${pair.herbName} et ${displayDrug} : interaction, gravité et sécurité`
            : `${pair.herbName} and ${displayDrug}: Interaction, Severity & Safety`
        }
        description={pair.description}
        url={url}
        dateModified={pair.updatedAt}
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
          { name: `${pair.herbName} + ${displayDrug}`, url: path },
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
          { name: `${pair.herbName} + ${displayDrug}` },
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
          <Link
            href={`/medications/${pair.drugSlug}`}
            className="text-sm font-medium text-foreground hover:text-primary hover:underline"
          >
            {pair.localizedDrugName || pair.drugName}
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {verdict.headline}
        </h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          {pair.herbScientificName}
        </p>
      </div>

      {/* Verdict hero — qualify unreviewed legacy classifications visually so a
          conservative hazard signal never masquerades as clinician-confirmed severity */}
      <div
        className={cn(
          "rounded-2xl border p-5",
          isClinicianApproved
            ? SEVERITY_STYLE[pair.severity]
            : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        )}
        role="note"
        aria-label={severityLabel(pair.severity, fr)}
      >
        <div className="flex items-start gap-3">
          <SeverityIcon severity={pair.severity} />
          <div>
            <p className="font-semibold">
              {isClinicianApproved
                ? severityLabel(pair.severity, fr)
                : fr
                  ? `Signal ${severityLabel(pair.severity, true).toLowerCase()} potentiel — signification clinique non confirmée`
                  : `Potential ${severityLabel(pair.severity, false).toLowerCase()} signal — clinical significance not established`}
              {pair.evidenceLevel && (
                <span className="ml-2 text-xs font-normal opacity-80">
                  · {evidenceLabel(pair.evidenceLevel, fr)}
                </span>
              )}
              <span className="ml-2 text-xs font-normal opacity-90">
                · {fr ? evidenceClass.badgeFr : evidenceClass.badgeEn}
              </span>
            </p>
            <p className="mt-1 text-sm">{clinicalAction.text}</p>
            <p className="mt-1.5 text-xs opacity-85">
              {fr ? evidenceClass.explanationFr : evidenceClass.explanationEn}
            </p>
          </div>
        </div>
      </div>

      {/* 7-dimension structured interaction card */}
      {(() => {
        const prepCtx = getInteractionPreparationContext(pair.herbSlug, fr);
        const medScope = classifyMedicationScope(pair.drugName);
        const sanitizedNote = sanitizeContradictoryEvidenceNote(
          pair.evidenceNote,
          pair.severity
        );
        return (
          <>
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 text-xs sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Gravité potentielle" : "Potential severity"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {severityLabel(pair.severity, fr)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Certitude des preuves" : "Evidence certainty"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {pair.evidenceLevel
                    ? evidenceLabel(pair.evidenceLevel, fr)
                    : fr
                      ? "Limitée / préclinique"
                      : "Limited / mechanistic"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Type de preuve" : "Evidence type"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {fr ? evidenceClass.badgeFr : evidenceClass.badgeEn}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Confirmation clinique" : "Clinical confirmation"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {isClinicianApproved
                    ? fr
                      ? "Confirmée par clinicien"
                      : "Clinician-confirmed"
                    : fr
                      ? "Non confirmée (dossier hérité)"
                      : "Unestablished (legacy record)"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Portée du médicament" : "Medication scope"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {medScope === "class"
                    ? fr
                      ? "Classe thérapeutique (vérifier la molécule)"
                      : "Drug class (verify exact drug)"
                    : fr
                      ? "Molécule précise"
                      : "Single molecule"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Préparation" : "Preparation"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {prepCtx.shortLabel}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Statut de révision" : "Review status"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {pair.verifiedAt
                    ? fr
                      ? `Révisé (${pair.verifiedAt})`
                      : `Reviewed (${pair.verifiedAt})`
                    : fr
                      ? "Non révisé cliniquement"
                      : "Not clinically reviewed"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {fr ? "Source primaire" : "Primary citation"}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {pair.source || (fr ? "Pharmacologie" : "Pharmacology")}
                </dd>
              </div>
            </dl>

            <p className="-mt-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
              <strong className="text-foreground">
                {fr ? "Forme et dose : " : "Preparation & dose note: "}
              </strong>
              {prepCtx.detail}
            </p>

            {/* Keep clean sanitized note available */}
            {sanitizedNote && (
              <p className="sr-only" data-sanitized-note="true">
                {sanitizedNote}
              </p>
            )}
          </>
        );
      })()}

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
          {pair.sourceUrl ? (
            <>
              {fr ? "Source : " : "Source: "}
              <a
                href={pair.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {pair.source || pair.sourceUrl}
              </a>
            </>
          ) : // "HerbAlly database" read like a citation. It is not one: these pairs
          // came from sources the licence register refuses to cite, so the page
          // has to say plainly that no primary citation backs the claim.
          fr ? (
            "Aucune source primaire n'est enregistrée pour cette association. La gravité reflète la pharmacologie connue, pas une étude précise — à vérifier avec un pharmacien."
          ) : (
            "No primary citation is recorded for this pair. The severity reflects known pharmacology rather than a specific study — confirm with a pharmacist."
          )}
          {pair.updatedAt && (
            <>
              {" · "}
              {fr ? "Mis à jour le " : "Updated "}
              {new Date(pair.updatedAt).toLocaleDateString(
                fr ? "fr-FR" : "en-US",
                { year: "numeric", month: "long" }
              )}
            </>
          )}
          {" · "}
          {pair.verifiedAt
            ? `${fr ? "Révision clinique le " : "Clinically reviewed "}${pair.verifiedAt}`
            : fr
              ? "Statut : fiche héritée non révisée par un clinicien"
              : "Review status: legacy record — no clinician review recorded"}
        </p>
      </section>

      {/* What the cited paper actually found, when it qualifies the severity
          above. Ten pairs cite a study whose abstract reports no change — the page
          has to say that rather than let the reader assume the paper supports the
          warning. */}
      {(() => {
        const cleanEvidenceNote = sanitizeContradictoryEvidenceNote(
          pair.evidenceNote,
          pair.severity
        );
        if (!cleanEvidenceNote) return null;
        return (
          <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <h3 className="text-sm font-semibold text-foreground">
              {fr
                ? "Ce que montrent les études humaines vs ce qui reste incertain"
                : "What human studies found vs. what remains uncertain"}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {cleanEvidenceNote}
            </p>
            <p className="text-xs text-muted-foreground">
              {fr
                ? "Les résultats négatifs dans de petits essais à court terme chez des volontaires sains ne permettent pas d'écarter un risque hémorragique ou métabolique avec des extraits concentrés ni chez les patients sous traitement au long cours."
                : "Small short-term healthy-volunteer trials do not rule out clinical risk across patients, longer durations, or concentrated extracts; signal distinctions (human trials vs. case reports vs. preclinical mechanisms) are kept separate above."}
            </p>
          </section>
        );
      })()}

      {/* Clinical guidance status (no severity-templated instructions until clinician sign-off) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {fr ? "Statut de conduite clinique" : "Clinical guidance status"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {clinicalAction.text}
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
              {severityExplainer(fr, !isClinicianApproved)}
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
        <Link
          href={`/herbalist?q=${encodeURIComponent(checkerQuery)}`}
          className={buttonVariants()}
        >
          <MessageCircle className="mr-1 size-4" />
          {fr ? "Poser la question à l'herboriste IA" : "Ask the AI herbalist"}
        </Link>
        {!isCalculatorBlockedSlug(pair.herbSlug) && (
          <Link
            href={`/calculator?herb=${pair.herbSlug}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Calculator className="mr-1 size-4" />
            {fr ? "Vérifier la référence adulte" : "Check adult reference"}
          </Link>
        )}
        <Link
          href={`/herbs/${pair.herbSlug}`}
          className={buttonVariants({ variant: "ghost" })}
        >
          <ArrowLeft className="mr-1 size-4" />
          {pair.herbName}
        </Link>
        <Link
          href={`/clinical-review?targetType=interaction&slug=${pair.herbSlug}&drug=${encodeURIComponent(pair.drugName)}`}
          rel="nofollow"
          className={buttonVariants({ variant: "outline" })}
        >
          {fr
            ? "Proposer une modification clinique"
            : "Suggest a clinical edit"}
        </Link>
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
                  {p.herbName} +{" "}
                  {fr ? p.localizedDrugName || p.drugName : p.drugName}
                </Link>
              ))}
          </div>
        </section>
      )}
      {sameDrug.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              {fr
                ? `Autres plantes interagissant avec ${pair.localizedDrugName || pair.drugName}`
                : `More herbs that interact with ${pair.drugName}`}
            </h2>
            <Link
              href={`/medications/${pair.drugSlug}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {fr
                ? `Voir toutes les plantes pour ce médicament →`
                : `View full medication guide →`}
            </Link>
          </div>
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
                  {p.herbName} +{" "}
                  {fr ? p.localizedDrugName || p.drugName : p.drugName}
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
