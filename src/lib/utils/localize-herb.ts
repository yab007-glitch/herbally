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
  const t = fr<HerbFr>(herb.translations);
  if (!t) return herb;
  return {
    ...herb,
    name: t.name || herb.name,
    common_names:
      toStringArray(t.common_names)?.length
        ? (toStringArray(t.common_names) as string[])
        : herb.common_names,
    description: t.description || herb.description,
    traditional_uses:
      toStringArray(t.traditional_uses) ?? herb.traditional_uses,
    modern_uses: toStringArray(t.modern_uses) ?? herb.modern_uses,
    dosage_adult: t.dosage_adult || herb.dosage_adult,
    dosage_child: t.dosage_child || herb.dosage_child,
    preparation_notes: t.preparation_notes || herb.preparation_notes,
    contraindications:
      toStringArray(t.contraindications) ?? herb.contraindications,
    side_effects: toStringArray(t.side_effects) ?? herb.side_effects,
  };
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
