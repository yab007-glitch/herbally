import { getAnonClient } from "@/lib/supabase/anonymous";
import { symptomMeta, SYMPTOM_SLUGS } from "./symptom-meta";

/**
 * Which symptom hubs have at least one published herb behind them.
 *
 * Four hubs (bloodPressure, hormonal, prostate, diabetes) match nothing, so
 * their whole body is "No herbs found for this condition yet" — the shape
 * Google files as a soft 404. Both the sitemap and each hub's `robots` tag need
 * that answer, and asking per page cost the build 60-second timeouts: reading
 * the row count inside `generateMetadata` added a second Supabase round-trip per
 * hub, which saturated the connection pool during static generation and took
 * every symptom prerender down with it (deploy 9sPshC6T, 2026-11-02).
 *
 * So the answer is computed once per process from a single column, memoised on
 * the promise, and bounded by a timeout. Callers fail **open**: unknown means
 * "assume populated", because hiding a real page is worse than indexing a thin
 * one.
 */

const COVERAGE_TIMEOUT_MS = 8_000;
const PAGE_SIZE = 1000;

let coverage: Promise<Set<string> | null> | null = null;

async function load(): Promise<Set<string> | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  const keywords = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select("symptom_keywords")
      .eq("is_published", true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) return null;
    const rows = (data ?? []) as Array<{ symptom_keywords: string[] | null }>;
    if (rows.length === 0) break;
    for (const row of rows) {
      for (const keyword of row.symptom_keywords ?? []) keywords.add(keyword);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return keywords;
}

/** Every `symptom_keywords` value currently used by a published herb. */
export function getPopulatedSymptomKeywords(): Promise<Set<string> | null> {
  if (!coverage) {
    coverage = Promise.race([
      load(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), COVERAGE_TIMEOUT_MS)
      ),
    ]).catch(() => null);
  }
  return coverage;
}

/**
 * True when this hub has herbs, or when coverage could not be determined.
 * Only a definite "no published herb carries this keyword" returns false.
 */
export async function isSymptomHubPopulated(slug: string): Promise<boolean> {
  const meta = symptomMeta[slug];
  if (!meta) return false;
  const known = await getPopulatedSymptomKeywords();
  if (!known) return true;
  return known.has(meta.dbKeyword);
}

/** Hub slugs to omit from the sitemap. Empty when coverage failed. */
export async function getEmptySymptomHubs(): Promise<string[]> {
  const known = await getPopulatedSymptomKeywords();
  if (!known) return [];
  const empty = SYMPTOM_SLUGS.filter(
    (slug) => !known.has(symptomMeta[slug].dbKeyword)
  );
  // Only report the ones that actually exist in the keyword map, so a typo in
  // the metadata cannot silently drop a hub that has content.
  return empty.filter((slug) => symptomMeta[slug]);
}

/** Test seam: forget the memoised set. */
export function resetSymptomCoverageCache(): void {
  coverage = null;
}
