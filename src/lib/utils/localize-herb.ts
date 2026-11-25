import type { Herb, DrugInteraction, HerbCategory } from "@/lib/types";
import { stripPediatricDosageSentences } from "@/lib/herbs/regulatory-evidence";
import { shouldSuppressPublicAdultDose } from "@/lib/data/dangerous-herbs";

interface HerbFr {
  name?: string;
  common_names?: string[];
  description?: string;
  traditional_uses?: string[];
  modern_uses?: string[];
  dosage_adult?: string;
  dosage_child?: string;
  preparation_notes?: string;
  contraindications?: string[];
  side_effects?: string[];
}

interface InteractionFr {
  drug_name?: string;
  description?: string;
  mechanism?: string;
}

function fr<T>(translations: unknown): T | null {
  if (!translations || typeof translations !== "object") return null;
  return ((translations as Record<string, unknown>).fr as T) ?? null;
}

/** Return the French display name stored in `translations.fr.name`, if non-empty. */
export function extractFrenchHerbName(translations: unknown): string | null {
  const name = fr<HerbFr>(translations)?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * Coerce a translation field into a string[].
 *
 * `translations` is an unvalidated jsonb column, so a translated array field
 * sometimes arrives as a bare string (the AI translation pipeline emitted one
 * for 21 entries and counting). Passing that through used to crash every
 * consumer that calls `.join()` — most visibly `herb-schema.tsx`, which threw
 * `a.contraindications.join is not a function` on the server and silently
 * dropped the JSON-LD block from those pages (HERBALLY-9, -A, -7).
 *
 * A non-empty string is treated as a single-element array; anything else that
 * is not an array is discarded so the English source value is kept.
 */
function toStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const strings = value.filter((v): v is string => typeof v === "string");
    return strings.length ? strings : null;
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return null;
}

function sanitizeStringArrayField(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return typeof value === "string"
      ? stripPediatricDosageSentences(value) || null
      : value;
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => stripPediatricDosageSentences(item))
    .filter((item) => item.length > 0);
}

/**
 * Strip quarantined pediatric dosing fields (`dosage_child`,
 * `translations.fr.dosage_child`) and pediatric dosing sentences from public
 * herb records before serialization or rendering.
 */
export function redactPublicHerbFields<T extends Herb>(herb: T): T {
  const slug = typeof herb.slug === "string" ? herb.slug : "";
  const rawTranslations =
    herb.translations && typeof herb.translations === "object"
      ? (herb.translations as Record<string, unknown>)
      : null;
  let cleanedTranslations = herb.translations;
  if (
    rawTranslations &&
    typeof rawTranslations.fr === "object" &&
    rawTranslations.fr
  ) {
    const frObj = { ...(rawTranslations.fr as Record<string, unknown>) };
    delete frObj.dosage_child;
    if (typeof frObj.dosage_adult === "string") {
      frObj.dosage_adult =
        stripPediatricDosageSentences(frObj.dosage_adult) || null;
    }
    if (typeof frObj.description === "string") {
      frObj.description = stripPediatricDosageSentences(frObj.description);
    }
    if (typeof frObj.preparation_notes === "string") {
      frObj.preparation_notes =
        stripPediatricDosageSentences(frObj.preparation_notes) || null;
    }
    for (const arrKey of [
      "traditional_uses",
      "modern_uses",
      "contraindications",
      "side_effects",
      "effets_secondaires",
    ]) {
      if (arrKey in frObj && frObj[arrKey] != null) {
        frObj[arrKey] = sanitizeStringArrayField(frObj[arrKey]);
      }
    }
    cleanedTranslations = {
      ...rawTranslations,
      fr: frObj,
    } as T["translations"];
  }

  const safeAdultDosage =
    slug && shouldSuppressPublicAdultDose(slug)
      ? null
      : herb.dosage_adult
        ? stripPediatricDosageSentences(herb.dosage_adult) || null
        : null;

  return {
    ...herb,
    dosage_child: null,
    dosage_adult: safeAdultDosage,
    description:
      typeof herb.description === "string"
        ? stripPediatricDosageSentences(herb.description)
        : herb.description,
    preparation_notes:
      typeof herb.preparation_notes === "string"
        ? stripPediatricDosageSentences(herb.preparation_notes) || null
        : herb.preparation_notes,
    ...(Array.isArray(herb.traditional_uses)
      ? {
          traditional_uses: sanitizeStringArrayField(
            herb.traditional_uses
          ) as string[],
        }
      : {}),
    ...(Array.isArray(herb.modern_uses)
      ? { modern_uses: sanitizeStringArrayField(herb.modern_uses) as string[] }
      : {}),
    ...(Array.isArray(herb.contraindications)
      ? {
          contraindications: sanitizeStringArrayField(
            herb.contraindications
          ) as string[],
        }
      : {}),
    ...(Array.isArray(herb.side_effects)
      ? {
          side_effects: sanitizeStringArrayField(herb.side_effects) as string[],
        }
      : {}),
    translations: cleanedTranslations,
  };
}

/** Overlay French translations onto an herb when locale is "fr". Falls back to English fields when a translation is missing.
 * Always quarantines `dosage_child` (`null`) on public-facing objects. */
export function localizeHerb<T extends Herb>(herb: T, locale: string): T {
  const withoutChild = redactPublicHerbFields(herb);
  if (locale !== "fr") return withoutChild;
  const localized = localizeHerbCategory(withoutChild, locale);
  const t = fr<HerbFr>(herb.translations);
  if (!t) return localized;
  const record = t as unknown as Record<string, unknown>;
  const commonNames = toStringArray(frField(record, "common_names"));
  return redactPublicHerbFields({
    ...localized,
    name: t.name || herb.name,
    common_names: commonNames?.length ? commonNames : herb.common_names,
    description: t.description || herb.description,
    traditional_uses:
      toStringArray(t.traditional_uses) ?? herb.traditional_uses,
    modern_uses: toStringArray(t.modern_uses) ?? herb.modern_uses,
    dosage_adult: t.dosage_adult || herb.dosage_adult,
    dosage_child: null,
    preparation_notes: t.preparation_notes || herb.preparation_notes,
    contraindications:
      toStringArray(t.contraindications) ?? herb.contraindications,
    side_effects:
      toStringArray(frField(record, "side_effects")) ?? herb.side_effects,
  });
}

/**
 * Read a French translation field, tolerating the ad-hoc key spellings left by
 * earlier translation passes.
 *
 * Several rows carry a field under a translated key instead of the canonical
 * one — "effets_secondaires" (64 rows) or "noms_communs" (44 rows) rather than
 * "side_effects" / "common_names". The canonical key always wins; an alias is
 * read only when it is missing, so those French pages stop falling back to the
 * English text that already exists in French under another key.
 */
const FR_FIELD_ALIASES: Record<string, string[]> = {
  common_names: ["noms_communs", "nom_commun", "nom_courant", "noms_courants"],
  side_effects: [
    "effets_secondaires",
    "effets_indésirables",
    "effet_secondaires",
    "effets secondaires",
    "effets indésirables",
  ],
};

function frField(record: Record<string, unknown>, key: string): unknown {
  const direct = record[key];
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  for (const alias of FR_FIELD_ALIASES[key] ?? []) {
    const value = record[alias];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return direct;
}

/** Overlay French translation onto a drug interaction while keeping `drug_name` canonical for URLs. */
export function localizeInteraction(
  ix: DrugInteraction,
  locale: string
): DrugInteraction & { display_drug_name?: string } {
  if (locale !== "fr") return ix;
  const t = fr<InteractionFr>(ix.translations);
  if (!t) return ix;
  const frDrugName =
    typeof t.drug_name === "string" && t.drug_name.trim()
      ? t.drug_name.trim()
      : undefined;
  return {
    ...ix,
    ...(frDrugName ? { display_drug_name: frDrugName } : {}),
    description: t.description || ix.description,
    mechanism: t.mechanism !== undefined ? t.mechanism : ix.mechanism,
  };
}

/** Return French category name when available. */
export function localizeCategoryName(
  cat: HerbCategory & { name_fr?: string | null },
  locale: string
): string {
  if (locale !== "fr") return cat.name;
  return cat.name_fr || cat.name;
}

/**
 * Localize the nested category name on an herb row.
 *
 * `getHerbCategories` already served French category names to the catalogue's
 * filter pills, but the join embedded on each herb row (`herb_categories(*)`)
 * was never localized — so the French herb page showed "Anti-inflammatory" and
 * the French catalogue cards showed English category chips right next to
 * French filter pills. Splitting this out means it applies even when the herb
 * has no `translations` block of its own.
 */
function localizeHerbCategory<T extends Herb>(herb: T, locale: string): T {
  if (locale !== "fr") return herb;
  const cat = (herb as { herb_categories?: unknown }).herb_categories;
  if (!cat || typeof cat !== "object") return herb;
  const typed = cat as HerbCategory & { name_fr?: string | null };
  const name = localizeCategoryName(typed, locale);
  if (name === typed.name) return herb;
  return { ...herb, herb_categories: { ...typed, name } };
}
