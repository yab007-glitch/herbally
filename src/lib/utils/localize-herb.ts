import type { Herb, DrugInteraction, HerbCategory } from "@/lib/types";

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

/** Overlay French translations onto an herb when locale is "fr". Falls back to English fields when a translation is missing. */
export function localizeHerb<T extends Herb>(herb: T, locale: string): T {
  if (locale !== "fr") return herb;
  const localized = localizeHerbCategory(herb, locale);
  const t = fr<HerbFr>(herb.translations);
  if (!t) return localized;
  const record = t as unknown as Record<string, unknown>;
  const commonNames = toStringArray(frField(record, "common_names"));
  return {
    ...localized,
    name: t.name || herb.name,
    common_names: commonNames?.length ? commonNames : herb.common_names,
    description: t.description || herb.description,
    traditional_uses:
      toStringArray(t.traditional_uses) ?? herb.traditional_uses,
    modern_uses: toStringArray(t.modern_uses) ?? herb.modern_uses,
    dosage_adult: t.dosage_adult || herb.dosage_adult,
    dosage_child: t.dosage_child || herb.dosage_child,
    preparation_notes: t.preparation_notes || herb.preparation_notes,
    contraindications:
      toStringArray(t.contraindications) ?? herb.contraindications,
    side_effects:
      toStringArray(frField(record, "side_effects")) ?? herb.side_effects,
  };
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

/** Overlay French translation onto a drug interaction. */
export function localizeInteraction(
  ix: DrugInteraction,
  locale: string
): DrugInteraction {
  if (locale !== "fr") return ix;
  const t = fr<InteractionFr>(ix.translations);
  if (!t) return ix;
  return {
    ...ix,
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
