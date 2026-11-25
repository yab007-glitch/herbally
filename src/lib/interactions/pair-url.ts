export interface PairSlugCandidate {
  id?: string;
  herbSlug: string;
  drugName: string;
  severity?: string;
}

export interface PairUrlCollision {
  path: string;
  herbSlug: string;
  drugSlug: string;
  rows: PairSlugCandidate[];
  hasSeverityConflict: boolean;
}

/**
 * Explicit editorial canonical drug-name overrides for `/interactions/[herb]/[drug]`.
 *
 * Key: `${herbSlug}/${drugSlug}`. Value: exact `drug_name` of the single row
 * authorized for that canonical URL by clinical/editorial review.
 *
 * Must ONLY be populated from explicit clinical/editorial sign-off — never
 * automatically inferred in code.
 */
export const EDITORIAL_PAIR_CANONICAL_DRUG: Readonly<Record<string, string>> =
  {};

/**
 * Canonical herb↔drug pair URLs: `/interactions/[herb]/[drug]`.
 *
 * `drugSlug()` uses the generic/class name only — "Warfarin (Coumadin)" →
 * "warfarin", "Antidepressants (SSRIs)" → "antidepressants" — because that
 * is what people search ("turmeric and warfarin", not "warfarin-coumadin").
 */
export function drugSlug(drugName: string): string {
  const generic = drugName.split(" (")[0];
  return generic
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Canonical path for an herb↔drug pair page.
 */
export function pairPath(herbSlug: string, drugName: string): string {
  return `/interactions/${herbSlug}/${drugSlug(drugName)}`;
}

/**
 * Detect any `(herbSlug, drugSlug)` groups that contain more than one row and
 * have not been explicitly disambiguated in `EDITORIAL_PAIR_CANONICAL_DRUG`.
 */
export function findPairUrlCollisions(
  rows: PairSlugCandidate[]
): PairUrlCollision[] {
  const groups = new Map<string, PairSlugCandidate[]>();
  for (const row of rows) {
    const slug = drugSlug(row.drugName);
    const key = `${row.herbSlug}/${slug}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const collisions: PairUrlCollision[] = [];
  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    const editorialChoice = EDITORIAL_PAIR_CANONICAL_DRUG[key];
    if (editorialChoice && group.some((r) => r.drugName === editorialChoice)) {
      continue;
    }
    const [herbSlug, dSlug] = key.split("/");
    const severities = new Set(
      group.map((r) => r.severity).filter((s): s is string => Boolean(s))
    );
    collisions.push({
      path: `/interactions/${herbSlug}/${dSlug}`,
      herbSlug,
      drugSlug: dSlug,
      rows: group,
      hasSeverityConflict: severities.size > 1,
    });
  }
  return collisions;
}

/**
 * Resolve sitemap entries for `/interactions/[herb]/[drug]`.
 *
 * Unresolved collisions are excluded completely from both EN and FR sitemaps
 * because those pages render `noindex, nofollow`. Editorially resolved paths
 * derive `hasFr` and `updatedAt` solely from the single authorized row rather
 * than OR-ing across conflicting records.
 */
export function selectSitemapPairEntries<
  T extends PairSlugCandidate & { hasFr: boolean; updatedAt: string | null },
>(
  pairs: T[],
  overrides: Readonly<Record<string, string>> = EDITORIAL_PAIR_CANONICAL_DRUG
): Array<{ path: string; hasFr: boolean; updatedAt: string | null }> {
  const groups = new Map<string, T[]>();
  for (const pair of pairs) {
    const dSlug = drugSlug(pair.drugName);
    const key = `${pair.herbSlug}/${dSlug}`;
    const list = groups.get(key);
    if (list) list.push(pair);
    else groups.set(key, [pair]);
  }

  const entries: Array<{
    path: string;
    hasFr: boolean;
    updatedAt: string | null;
  }> = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      const only = group[0];
      entries.push({
        path: `/interactions/${key}`,
        hasFr: only.hasFr,
        updatedAt: only.updatedAt,
      });
      continue;
    }

    const editorialChoice = overrides[key];
    if (!editorialChoice) {
      // Unresolved collision -> page is noindex; exclude from sitemap.
      continue;
    }
    const chosen = group.find((r) => r.drugName === editorialChoice);
    if (!chosen) {
      continue;
    }
    entries.push({
      path: `/interactions/${key}`,
      hasFr: chosen.hasFr,
      updatedAt: chosen.updatedAt,
    });
  }

  return entries;
}
