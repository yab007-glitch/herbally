/**
 * Shared symptom-result shaping: de-duplication by plant and relevance
 * ordering. Used by the /api/herbs/search route, the symptom search client,
 * and the per-symptom detail page so all three agree on what "one plant"
 * means.
 *
 * Root cause of the duplicate seen in the Oct 29, 2026 walkthrough
 * ("Stachys Betonica" and "Lamiaceae Betony" both pointing to
 * Stachys betonica): the search route de-duplicated by database row `id`
 * only. Two distinct published rows can describe the same plant under
 * different common names, so both rows reached the results. De-duplicating
 * by normalized scientific name (falling back to slug, then id) collapses
 * them into one result. This is a presentation merge only — no database
 * rows are deleted or rewritten, and match criteria are unchanged.
 *
 * One hand-curated Latin-synonym exception: betony. Betonica
 * officinalis, Stachys betonica and Stachys officinalis are synonyms for
 * the same plant (RHS lists Stachys betonica as a synonym of Betonica
 * officinalis; PFAF lists both as synonyms of Stachys officinalis), so
 * rows under any of those names collapse into one result. This map is
 * deliberately tiny and hand-verified: do NOT extend it by guessing, and
 * do NOT merge on common-name similarity — without a verified synonym
 * entry, different scientific names stay separate.
 */

export interface DedupeableHerbResult {
  id?: string;
  slug: string;
  name: string;
  scientific_name: string | null;
  evidence_level?: string | null;
  matchedBy?: string;
  matchedKeywords?: string[];
  matchedInputs?: string[];
  aliases?: string[];
}

const EVIDENCE_ORDER: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  trad: 4,
};

export function evidenceRank(level: string | null | undefined): number {
  return EVIDENCE_ORDER[level ?? "C"] ?? 2;
}

/** Normalize a scientific name for comparison: case, spacing, punctuation. */
export function normalizeScientificName(
  name: string | null | undefined
): string | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

const LATIN_SYNONYM_CANONICAL: Record<string, string> = {
  "betonica officinalis": "betonica officinalis",
  "stachys betonica": "betonica officinalis",
  "stachys officinalis": "betonica officinalis",
};

function dedupeKey(herb: DedupeableHerbResult): string {
  const normalized = normalizeScientificName(herb.scientific_name);
  if (normalized) {
    return LATIN_SYNONYM_CANONICAL[normalized] ?? normalized;
  }
  return herb.slug ? `slug:${herb.slug.toLowerCase()}` : `id:${herb.id ?? ""}`;
}

function unionInOrder(
  existing: string[] | undefined,
  next: string[]
): string[] {
  const seen = new Set((existing ?? []).map((v) => v.toLowerCase()));
  const out = [...(existing ?? [])];
  for (const value of next) {
    if (!seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }
  return out;
}

/**
 * Collapse rows that resolve to the same plant into a single result.
 * Keeps the first row (callers pass evidence-sorted symptom matches
 * first, so the best-evidenced row wins the canonical slug/link) and
 * merges the rest: matched keywords/inputs are unioned, distinct
 * alternate names are kept as `aliases` (never silently dropped), and a
 * "symptom" match beats a "name" match for the merged `matchedBy`.
 */
export function dedupeSymptomResults<T extends DedupeableHerbResult>(
  results: T[]
): T[] {
  const byKey = new Map<string, T>();
  for (const herb of results) {
    const key = dedupeKey(herb);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, herb);
      continue;
    }
    const mergedAliases = unionInOrder(
      existing.aliases,
      existing.name.toLowerCase() === herb.name.toLowerCase() ? [] : [herb.name]
    );
    byKey.set(key, {
      ...existing,
      matchedBy:
        existing.matchedBy === "symptom" || herb.matchedBy === "symptom"
          ? "symptom"
          : (existing.matchedBy ?? herb.matchedBy),
      matchedKeywords: unionInOrder(
        existing.matchedKeywords,
        herb.matchedKeywords ?? []
      ),
      matchedInputs: unionInOrder(
        existing.matchedInputs,
        herb.matchedInputs ?? []
      ),
      aliases: mergedAliases.length ? mergedAliases : undefined,
    });
  }
  return [...byKey.values()];
}

/** Number of user search terms a result matched (0 for name-only matches). */
export function matchedInputCount(herb: DedupeableHerbResult): number {
  return herb.matchedInputs?.length ?? herb.matchedKeywords?.length ?? 0;
}

/**
 * Relevance order for symptom search: most matched search terms first,
 * then strongest evidence grade. Stable — ties keep their input order.
 * This only reorders existing matches; it does not add or drop any.
 */
export function sortSymptomResultsByRelevance<T extends DedupeableHerbResult>(
  results: T[]
): T[] {
  return results
    .map((herb, index) => ({ herb, index }))
    .sort((a, b) => {
      const countDiff = matchedInputCount(b.herb) - matchedInputCount(a.herb);
      if (countDiff !== 0) return countDiff;
      const evidenceDiff =
        evidenceRank(a.herb.evidence_level) -
        evidenceRank(b.herb.evidence_level);
      if (evidenceDiff !== 0) return evidenceDiff;
      return a.index - b.index;
    })
    .map(({ herb }) => herb);
}

/** Minimal shape of an herb row rendered on a symptom hub. */
export interface SymptomHerbRow {
  name: string;
  traditional_uses?: string[] | null;
  modern_uses?: string[] | null;
  translations?: unknown;
}

function translatedStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const strings = value.filter((v): v is string => typeof v === "string");
    return strings.length ? strings : null;
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return null;
}

/**
 * Overlay `translations.fr` onto a symptom-hub herb row.
 *
 * The symptom detail page selected only English columns, so every `/fr/symptoms/*`
 * page listed English herb names and English use tags inside an otherwise
 * French page. Falls back to the English value field by field when a
 * translation is missing — a missing translation must never blank a row.
 */
export function localizeSymptomHerb<T extends SymptomHerbRow>(
  row: T,
  locale: string
): T {
  if (locale !== "fr") return row;
  const translations = row.translations;
  if (!translations || typeof translations !== "object") return row;
  const fr = (translations as Record<string, unknown>).fr;
  if (!fr || typeof fr !== "object") return row;
  const t = fr as Record<string, unknown>;
  const name = typeof t.name === "string" && t.name.trim() ? t.name : row.name;
  return {
    ...row,
    name,
    traditional_uses:
      translatedStringArray(t.traditional_uses) ?? row.traditional_uses,
    modern_uses: translatedStringArray(t.modern_uses) ?? row.modern_uses,
  };
}
