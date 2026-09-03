import { siteUrl } from "@/lib/seo/site-url";
import { getReviewer } from "@/lib/data/reviewers";

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
}

export function HerbSchema({ herb }: HerbSchemaProps) {
  const reviewer = getReviewer(herb.reviewed_by);
  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: herb.name,
    alternateName: herb.scientific_name,
    description: herb.description ?? undefined,
    url: `${siteUrl()}/herbs/${herb.slug}`,
    mainEntity: {
      "@type": "MedicalSubstance",
      name: herb.name,
      alternateName: herb.scientific_name,
      description: herb.description ?? undefined,
      ...(herb.active_compounds &&
        herb.active_compounds.length > 0 && {
          chemicalComposition: herb.active_compounds.join(", "),
        }),
      ...(herb.traditional_uses &&
        herb.traditional_uses.length > 0 && {
          medicalUse: herb.traditional_uses.join("; "),
        }),
    },
    about: {
      "@type": "HealthTopic",
      name: herb.name,
      description: herb.description ?? undefined,
      ...(herb.herb_categories?.name && {
        category: herb.herb_categories.name,
      }),
    },
    safetyConsideration: {
      "@type": "MedicalWarning",
      ...(herb.pregnancy_safe !== null &&
        herb.pregnancy_safe !== undefined && {
          pregnancySafety: herb.pregnancy_safe
            ? "Generally safe during pregnancy"
            : "Not recommended during pregnancy",
        }),
      ...(herb.nursing_safe !== null &&
        herb.nursing_safe !== undefined && {
          breastfeedingSafety: herb.nursing_safe
            ? "Generally safe while nursing"
            : "Not recommended while nursing",
        }),
      ...(herb.contraindications &&
        herb.contraindications.length > 0 && {
          contraindication: herb.contraindications.join("; "),
        }),
      ...(herb.side_effects &&
        herb.side_effects.length > 0 && {
          adverseEffect: herb.side_effects.join("; "),
        }),
    },
    ...(herb.dosage_adult && {
      dosage: {
        "@type": "MedicalDoseSchedule",
        doseValue: herb.dosage_adult,
        targetPopulation: "Adults",
      },
    }),
    ...(herb.dosage_child && {
      pediatricDose: {
        "@type": "MedicalDoseSchedule",
        doseValue: herb.dosage_child,
        targetPopulation: "Children",
      },
    }),
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: siteUrl(),
      ...(herb.reviewed_by && {
        reviewer: reviewer
          ? {
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
            }
          : {
              "@type": "Person",
              name: herb.reviewed_by,
              ...(herb.reviewer_credentials && {
                jobTitle: herb.reviewer_credentials,
              }),
            },
      }),
    },
    ...(herb.last_reviewed && {
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
