import { siteUrl } from "@/lib/seo/site-url";
import { getReviewer, type Reviewer } from "@/lib/data/reviewers";
import { normalizeDosage } from "@/lib/herbs/normalize-dosage";
import { stripPediatricDosageSentences } from "@/lib/herbs/regulatory-evidence";
import { stripFieldLabels } from "@/lib/herbs/clean-faq";
import { isBucketCategory } from "@/lib/herbs/category";
import { resolvePregnancyNursingStatus } from "@/lib/herbs/canonical-safety";

interface Herb {
  name: string;
  scientific_name: string;
  description?: string | null;
  slug: string;
  active_compounds?: string[] | null;
  traditional_uses?: string[] | null;
  modern_uses?: string[] | null;
  dosage_adult?: string | null;
  dosage_child?: string | null;
  pregnancy_safe?: boolean | null;
  nursing_safe?: boolean | null;
  pregnancy_safe_oral?: boolean | null;
  pregnancy_safe_topical?: boolean | null;
  nursing_safe_oral?: boolean | null;
  nursing_safe_topical?: boolean | null;
  provenance?: unknown;
  contraindications?: string[] | null;
  side_effects?: string[] | null;
  herb_categories?: { name: string } | null;
  reviewed_by?: string | null;
  reviewer_credentials?: string | null;
  last_reviewed?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  evidence_level?: string | null;
}

interface HerbSchemaProps {
  herb: Herb;
  /**
   * Canonical URL for this page. Pass the localized one: French pages used to
   * declare the English URL inside their own MedicalWebPage node.
   */
  url?: string;
  /** Latest ISO modification timestamp for MedicalWebPage.dateModified. */
  dateModified?: string;
  /** True when the herb is in the lethal/poisonous registry. */
  isDangerous?: boolean;
  /**
   * False when an entry is unreviewed or needs re-review so structured data
   * omits `reviewedBy` / `last_reviewed`. Defaults true for standalone callers.
   */
  isClinicallyReviewed?: boolean;
  /** DB-resolved clinical reviewer (optional; falls back to static `getReviewer`). */
  resolvedReviewer?: Reviewer | null;
  /** Primary source URLs verified for non-toxic monographs. */
  citationUrls?: string[];
}

/**
 * Guard a value that callers assume is string[] before calling .join().
 * `translations` is unvalidated jsonb, so a field can arrive as a bare string
 * (which passes a `.length > 0` check but has no .join) — see HERBALLY-9.
 */
function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

export function HerbSchema({
  herb,
  url,
  dateModified,
  isDangerous = false,
  isClinicallyReviewed = true,
  resolvedReviewer,
  citationUrls,
}: HerbSchemaProps) {
  const candidateReviewer =
    resolvedReviewer !== undefined
      ? resolvedReviewer
      : (getReviewer(herb.reviewed_by) ?? null);
  const reviewer =
    isClinicallyReviewed &&
    candidateReviewer &&
    candidateReviewer.role === "clinical" &&
    candidateReviewer.consentRecorded &&
    candidateReviewer.publicAttributionAllowed &&
    candidateReviewer.licenceNumberVerified !== false
      ? candidateReviewer
      : null;
  const activeCompounds = asArray(herb.active_compounds);
  const traditionalUses = asArray(herb.traditional_uses);
  const contraindications = asArray(herb.contraindications);
  const sideEffects = asArray(herb.side_effects);
  const safetyStatus = resolvePregnancyNursingStatus(herb, herb.provenance);
  const pregnancyVerdict =
    isDangerous || safetyStatus.pregnancy === "not_recommended"
      ? "not_recommended"
      : safetyStatus.pregnancy;
  const nursingVerdict =
    isDangerous || safetyStatus.nursing === "not_recommended"
      ? "not_recommended"
      : safetyStatus.nursing;
  const pregnancySafety =
    pregnancyVerdict === "safe"
      ? "Generally safe during pregnancy"
      : pregnancyVerdict === "not_recommended"
        ? "Not recommended during pregnancy"
        : undefined;
  const breastfeedingSafety =
    nursingVerdict === "safe"
      ? "Generally safe while nursing"
      : nursingVerdict === "not_recommended"
        ? "Not recommended while nursing"
        : undefined;
  const schema = {
    "@context": "https://schema.org",
    "@type": isClinicallyReviewed ? "MedicalWebPage" : "WebPage",
    name: herb.name,
    alternateName: herb.scientific_name,
    description: isDangerous
      ? "Poisonous botanical quarantined from herbal medicine use. Contains lethal toxins; do not ingest or use."
      : (herb.description ?? undefined),
    url: url ?? `${siteUrl()}/herbs/${herb.slug}`,
    ...(dateModified && { dateModified }),
    ...(!isDangerous &&
      citationUrls &&
      citationUrls.length > 0 && { citation: citationUrls }),
    mainEntity: {
      "@type": "MedicalSubstance",
      name: herb.name,
      alternateName: herb.scientific_name,
      ...(activeCompounds.length > 0 && {
        chemicalComposition: activeCompounds.join(", "),
      }),
      ...(!isDangerous &&
        traditionalUses.length > 0 && {
          medicalUse: traditionalUses.join("; "),
        }),
    },
    about: {
      "@type": "HealthTopic",
      name: herb.name,
      ...(!isDangerous &&
        herb.herb_categories?.name &&
        !isBucketCategory(herb.herb_categories.name) && {
          category: herb.herb_categories.name,
        }),
    },
    safetyConsideration: {
      "@type": "MedicalWarning",
      ...(pregnancySafety && { pregnancySafety }),
      ...(breastfeedingSafety && { breastfeedingSafety }),
      ...(contraindications.length > 0 && {
        contraindication: contraindications.map(stripFieldLabels).join("; "),
      }),
      ...(sideEffects.length > 0 && {
        adverseEffect: sideEffects.map(stripFieldLabels).join("; "),
      }),
    },
    ...(() => {
      if (isDangerous || !herb.dosage_adult) return {};
      const cleanedDose = stripPediatricDosageSentences(herb.dosage_adult);
      if (!cleanedDose) return {};
      return {
        dosage: {
          "@type": "MedicalDoseSchedule",
          doseValue: normalizeDosage(cleanedDose),
          targetPopulation: "Adults",
        },
      };
    })(),
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: siteUrl(),
    },
    // Emit reviewedBy ONLY when the record is clinically reviewed by a verified
    // clinical reviewer (never attribute editorial compilation as clinical review).
    ...(isClinicallyReviewed && reviewer && reviewer.role === "clinical"
      ? {
          reviewedBy: {
            "@type": "Person",
            name: reviewer.name,
            jobTitle: reviewer.licenceJurisdiction
              ? `${reviewer.credentials} · ${reviewer.licenceJurisdiction}`
              : reviewer.credentials,
            url: reviewer.profileUrl,
            ...(reviewer.researchUrl && { sameAs: reviewer.researchUrl }),
            ...((reviewer.affiliations?.length ?? 0) > 0 && {
              affiliation: reviewer.affiliations.map((a) => ({
                "@type": "Organization",
                name: a.name,
                ...(a.url && { url: a.url }),
              })),
            }),
          },
        }
      : {}),
    // The accountable author. This is a real, credentialed person and the
    // single strongest honest trust signal the page can carry; "HerbAlly
    // Editorial Team" told a rater nothing.
    author: {
      "@type": "Person",
      name: "Yasser Bheekun",
      jobTitle: "Medical Laboratory Technologist",
      hasCredential: [
        {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "certification",
          name: "OPTMQ — Ordre professionnel des technologistes médicaux du Québec",
        },
        {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "certification",
          name: "CSMLS — Canadian Society for Medical Laboratory Science",
        },
      ],
      url: `${siteUrl()}/editorial-policy`,
    },
    ...(isClinicallyReviewed &&
      herb.last_reviewed && {
        dateModified: herb.last_reviewed,
      }),
    // datePublished must be stable. Emitting new Date() on every regeneration
    // makes every herb look freshly published daily — a classic thin-content /
    // freshness-spam signal that erodes trust for the 335 crawled-not-indexed
    // pages. Prefer created_at, fall back to last_reviewed/updated_at.
    ...(herb.created_at || herb.last_reviewed || herb.updated_at
      ? {
          datePublished:
            herb.created_at ?? herb.last_reviewed ?? herb.updated_at,
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
