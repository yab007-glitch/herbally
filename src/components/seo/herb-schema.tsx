import { siteUrl } from "@/lib/seo/site-url";
import { getReviewer } from "@/lib/data/reviewers";
import { normalizeDosage } from "@/lib/herbs/normalize-dosage";
import { stripFieldLabels } from "@/lib/herbs/clean-faq";
import { isBucketCategory } from "@/lib/herbs/category";

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
}: HerbSchemaProps) {
  const reviewer = isClinicallyReviewed ? getReviewer(herb.reviewed_by) : null;
  const activeCompounds = asArray(herb.active_compounds);
  const traditionalUses = asArray(herb.traditional_uses);
  const contraindications = asArray(herb.contraindications);
  const sideEffects = asArray(herb.side_effects);
  const pregnancySafety = isDangerous
    ? "Not recommended during pregnancy"
    : herb.pregnancy_safe !== null && herb.pregnancy_safe !== undefined
      ? herb.pregnancy_safe
        ? "Generally safe during pregnancy"
        : "Not recommended during pregnancy"
      : undefined;
  const breastfeedingSafety = isDangerous
    ? "Not recommended while nursing"
    : herb.nursing_safe !== null && herb.nursing_safe !== undefined
      ? herb.nursing_safe
        ? "Generally safe while nursing"
        : "Not recommended while nursing"
      : undefined;
  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: herb.name,
    alternateName: herb.scientific_name,
    description: herb.description ?? undefined,
    url: url ?? `${siteUrl()}/herbs/${herb.slug}`,
    ...(dateModified && { dateModified }),
    mainEntity: {
      "@type": "MedicalSubstance",
      name: herb.name,
      alternateName: herb.scientific_name,
      description: herb.description ?? undefined,
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
      description: herb.description ?? undefined,
      ...(herb.herb_categories?.name &&
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
    ...(!isDangerous &&
      herb.dosage_adult && {
        dosage: {
          "@type": "MedicalDoseSchedule",
          doseValue: normalizeDosage(herb.dosage_adult),
          targetPopulation: "Adults",
        },
      }),
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: siteUrl(),
    },
    // A reviewer claim is only honest when a specific, named person is on the
    // record AND the current revision has not been invalidated for re-review.
    ...(reviewer && {
      reviewedBy: {
        "@type": "Person",
        name: reviewer.name,
        jobTitle: reviewer.credentials,
        url: reviewer.profileUrl,
        ...(reviewer.researchUrl && { sameAs: reviewer.researchUrl }),
        affiliation: reviewer.affiliations.map((a) => ({
          "@type": "Organization",
          name: a.name,
          ...(a.url && { url: a.url }),
        })),
      },
    }),
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
