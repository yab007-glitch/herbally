import {
  narrativeSections,
  type NarrativeCopy,
  type NarrativeInput,
} from "@/lib/herbs/narrative";
import { herbPageCopy, type CopyLocale } from "@/lib/i18n/herb-page-copy";
import { normalizeDosage } from "@/lib/herbs/normalize-dosage";
import { isDangerousHerb } from "@/lib/data/dangerous-herbs";
import { HerbNarrativeView } from "@/components/herbs/herb-narrative-view";

/**
 * The recorded facts, in sentences.
 *
 * Nothing here is generated prose: every paragraph is a restatement of a field
 * the entry already holds (see src/lib/herbs/narrative.ts). The point is that a
 * reader gets an answer in full sentences instead of a column of fragments, and
 * Google gets text that differs from the next entry — which is what the entry
 * currently lacks.
 */
export function HerbNarrative({
  herb,
  interactionCount,
  locale = "en",
  isDangerous,
}: {
  herb: {
    slug?: string;
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
  isDangerous?: boolean;
}) {
  const copy: NarrativeCopy = herbPageCopy(locale).narrative;
  const dangerous =
    isDangerous ?? (herb.slug ? isDangerousHerb(herb.slug) : false);
  const sections = narrativeSections(
    {
      name: herb.name,
      traditionalUses: herb.traditional_uses,
      modernUses: herb.modern_uses,
      dosageAdult: herb.dosage_adult
        ? normalizeDosage(herb.dosage_adult)
        : herb.dosage_adult,
      contraindications: herb.contraindications,
      sideEffects: herb.side_effects,
      pregnancySafe: herb.pregnancy_safe,
      nursingSafe: herb.nursing_safe,
      interactionCount,
      regulator: regulatorName(herb.provenance, locale),
      isDangerous: dangerous,
    } satisfies NarrativeInput,
    copy
  );

  if (sections.length === 0) return null;

  return <HerbNarrativeView title={copy.title} sections={sections} />;
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
