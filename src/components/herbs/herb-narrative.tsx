import {
  narrativeSections,
  type NarrativeCopy,
  type NarrativeInput,
} from "@/lib/herbs/narrative";
import { herbPageCopy, type CopyLocale } from "@/lib/i18n/herb-page-copy";

/**
 * The recorded facts, in sentences.
 *
 * Nothing here is generated prose: every paragraph is a restatement of a field
 * the entry already holds (see src/lib/herbs/narrative.ts). The point is that a
 * reader gets an answer in full sentences instead of a column of fragments, and
 * Google gets text that differs from the next entry — which is what the entry
 * currently lacks.
 *
 * The sentence templates come from the locale's copy, so a French entry is
 * French throughout rather than French fields inside English sentences.
 */
export function HerbNarrative({
  herb,
  interactionCount,
  locale = "en",
}: {
  herb: {
    name: string;
    traditional_uses?: string[] | null;
    modern_uses?: string[] | null;
    dosage_adult?: string | null;
    contraindications?: string[] | null;
    side_effects?: string[] | null;
    pregnancy_safe?: boolean | null;
    nursing_safe?: boolean | null;
    provenance?: unknown;
  };
  interactionCount: number;
  locale?: CopyLocale;
}) {
  const copy: NarrativeCopy = herbPageCopy(locale).narrative;
  const sections = narrativeSections(
    {
      name: herb.name,
      traditionalUses: herb.traditional_uses,
      modernUses: herb.modern_uses,
      dosageAdult: herb.dosage_adult,
      contraindications: herb.contraindications,
      sideEffects: herb.side_effects,
      pregnancySafe: herb.pregnancy_safe,
      nursingSafe: herb.nursing_safe,
      interactionCount,
      regulator: regulatorName(herb.provenance, locale),
    } satisfies NarrativeInput,
    copy
  );

  if (sections.length === 0) return null;

  return (
    <section aria-labelledby="recorded-facts" className="space-y-5">
      <h2 id="recorded-facts" className="text-xl font-semibold text-foreground">
        {copy.title}
      </h2>
      {sections.map((section) => (
        <div key={section.heading}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section.heading}
          </h3>
          <p className="measure prose-body mt-1.5 leading-relaxed text-foreground">
            {section.body}
          </p>
        </div>
      ))}
    </section>
  );
}

/**
 * Which regulator the contraindication wording belongs to.
 *
 * Read from the entry's own provenance rather than assumed: quoting the wrong
 * authority is worse than quoting none.
 */
function regulatorName(provenance: unknown, locale: CopyLocale): string | null {
  if (!provenance || typeof provenance !== "object") return null;
  const sources = (provenance as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return null;
  const text = JSON.stringify(sources).toLowerCase();
  const fr = locale === "fr";
  if (
    text.includes("health-products.canada.ca") ||
    text.includes("health canada")
  ) {
    return fr ? "Santé Canada" : "Health Canada";
  }
  if (text.includes("ema.europa.eu")) {
    return fr
      ? "l'Agence européenne des médicaments"
      : "the European Medicines Agency";
  }
  if (text.includes("nccih.nih.gov")) {
    return fr
      ? "le Centre national américain pour la santé complémentaire et intégrative"
      : "the US National Center for Complementary and Integrative Health";
  }
  return null;
}
