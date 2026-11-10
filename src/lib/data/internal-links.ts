import { unstable_cache } from "next/cache";
import { getAnonClient } from "@/lib/supabase/anonymous";

/**
 * Internal links between herb pages.
 *
 * The library is 2,700 pages deep and a detail page linked to almost no other
 * herb — a crawl dead-end where link equity goes nowhere, which is measurable
 * and was measured: 42 links out, one of them to a sibling herb.
 *
 * Two rails fix that without inventing relevance:
 *
 *  - **A–Z neighbours** are guaranteed. Every herb has exactly two, so the
 *    whole library becomes a crawlable chain from any entry point. They are
 *    not a recommendation, they are structure.
 *  - **Same-category peers** are real relevance, but one category ("Not
 *    Common") holds 91% of the library, so membership is not enough on its
 *    own — this rail is capped and excludes that bucket.
 *
 * Cached per page for a day, tagged so a herb edit can purge its own links.
 */

export interface LinkHerb {
  slug: string;
  name: string;
  scientific_name?: string | null;
}

/** Category used as a dumping ground; membership means nothing. */
export const BUCKET_CATEGORY = "Not Common";

async function fetchNeighbours(name: string) {
  const supabase = getAnonClient();
  if (!supabase) return { prev: null, next: null };

  const [prev, next] = await Promise.all([
    supabase
      .from("herbs")
      .select("slug, name, scientific_name")
      .eq("is_published", true)
      .lt("name", name)
      .order("name", { ascending: false })
      .limit(1),
    supabase
      .from("herbs")
      .select("slug, name, scientific_name")
      .eq("is_published", true)
      .gt("name", name)
      .order("name", { ascending: true })
      .limit(1),
  ]);

  return {
    prev: (prev.data?.[0] as LinkHerb) ?? null,
    next: (next.data?.[0] as LinkHerb) ?? null,
  };
}

export const getAlphabeticalNeighbours = unstable_cache(
  async (name: string, _slug: string) => {
    try {
      return await fetchNeighbours(name);
    } catch {
      // A dead link rail must never fail a page render.
      return { prev: null, next: null };
    }
  },
  ["herb-a-z-neighbours"],
  { revalidate: 86400, tags: ["herb-links"] }
);

/** Herbs sharing a symptom keyword — the relevance signal that actually varies. */
async function fetchSymptomPeers(slug: string, keywords: string[] | null) {
  const supabase = getAnonClient();
  if (!supabase || !keywords?.length) return [];
  const { data } = await supabase
    .from("herbs")
    .select("slug, name, scientific_name")
    .eq("is_published", true)
    .contains("symptom_keywords", keywords.slice(0, 2))
    .neq("slug", slug)
    .limit(6);
  return (data ?? []) as LinkHerb[];
}

export const getSymptomPeers = unstable_cache(
  async (slug: string, keywords: string[] | null) => {
    try {
      return await fetchSymptomPeers(slug, keywords);
    } catch {
      return [];
    }
  },
  ["herb-symptom-peers"],
  { revalidate: 86400, tags: ["herb-links"] }
);
