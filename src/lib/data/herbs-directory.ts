import { unstable_cache } from "next/cache";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { localizeHerb, localizeCategoryName } from "@/lib/utils/localize-herb";
import { parseProvenance } from "@/lib/types/provenance";
import { logger } from "@/lib/utils/logger";
import type { HerbCategory, HerbWithCategory } from "@/lib/types";

const DIRECTORY_PAGE_SIZE = 20;
const DIRECTORY_TTL_SECONDS = 900;

export interface DirectoryHerbCard {
  id: string;
  slug: string;
  name: string;
  scientific_name: string;
  description: string;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  traditional_uses: string[] | null;
  herb_categories: { name: string } | null;
  image_url: string | null;
  evidence_level: string | null;
  provenance: {
    verification_method: string;
    verification_status: string | null;
    verified_source_count: number;
    verified_sources: string[];
    verified_by: string | null;
    review_status: string | null;
    reviewed_by_name: string | null;
    reviewed_on: string | null;
    review_role?: "editorial" | "clinical" | null;
    bulk_editorial_import?: boolean | null;
  };
}

/**
 * Strip heavy DB fields (`translations`, full `provenance.sources`/`image`,
 * `common_names`, `dosage_adult`, long arrays) after server-side localization so
 * `/herbs` does not serialize megabytes of unused JSON into RSC client props.
 */
export function compactHerbForDirectory(
  herb: HerbWithCategory
): DirectoryHerbCard {
  const p = parseProvenance(herb.provenance ?? null);
  const rawDesc = (herb.description ?? "").trim();
  const shortDesc =
    rawDesc.length > 200 ? `${rawDesc.slice(0, 197).trimEnd()}...` : rawDesc;

  return {
    id: herb.id,
    slug: herb.slug,
    name: herb.name,
    scientific_name: herb.scientific_name,
    description: shortDesc,
    pregnancy_safe: herb.pregnancy_safe,
    nursing_safe: herb.nursing_safe,
    traditional_uses: herb.traditional_uses?.[0]
      ? [herb.traditional_uses[0]]
      : null,
    herb_categories: herb.herb_categories?.name
      ? { name: herb.herb_categories.name }
      : null,
    image_url: herb.image_url ?? null,
    evidence_level: herb.evidence_level ?? null,
    provenance: {
      verification_method: p.verification_method,
      verification_status: p.verification_status,
      verified_source_count: p.verified_source_count,
      verified_sources: p.verified_sources,
      verified_by: p.verified_by,
      review_status: p.review_status,
      reviewed_by_name: p.reviewed_by_name,
      reviewed_on: p.reviewed_on,
      review_role: p.review_role ?? null,
      bulk_editorial_import: p.bulk_editorial_import ?? null,
    },
  };
}

const DIRECTORY_CARD_SELECT = [
  "id",
  "slug",
  "name",
  "scientific_name",
  "description",
  "traditional_uses",
  "pregnancy_safe",
  "nursing_safe",
  "image_url",
  "evidence_level",
  "provenance",
  "translations",
  "category_id",
  "herb_categories(id,name,name_fr,slug,sort_order)",
].join(",");

async function fetchDefaultDirectoryPage(
  locale: string,
  sort: "name" | "evidence"
): Promise<{ herbs: DirectoryHerbCard[]; total: number }> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new Error("Supabase anonymous client unavailable");
  }

  const { data, count, error } = await supabase
    .from("herbs_public" as never)
    .select(DIRECTORY_CARD_SELECT, { count: "estimated" })
    .eq("is_published", true)
    .order(sort === "evidence" ? "evidence_level" : "name", { ascending: true })
    .range(0, DIRECTORY_PAGE_SIZE - 1);

  if (error) {
    logger.error("herbs_directory_cached_page_failed", {
      error: error.message,
      sort,
    });
    throw new Error(error.message);
  }

  const herbs = ((data as unknown as HerbWithCategory[]) ?? []).map((h) =>
    compactHerbForDirectory(localizeHerb(h, locale))
  );
  return { herbs, total: count ?? herbs.length };
}

async function fetchCategoriesList(
  locale: string
): Promise<(HerbCategory & { name_fr?: string | null })[]> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new Error("Supabase anonymous client unavailable");
  }

  const { data, error } = await supabase
    .from("herb_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.error("herbs_directory_cached_categories_failed", {
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data ?? []).map((cat) => ({
    ...cat,
    name: localizeCategoryName(
      cat as HerbCategory & { name_fr?: string | null },
      locale
    ),
  }));
}

export const getCachedDefaultHerbsPage = unstable_cache(
  async (locale: string, sort: "name" | "evidence") =>
    fetchDefaultDirectoryPage(locale, sort),
  ["herbs-directory-p1-v2"],
  { revalidate: DIRECTORY_TTL_SECONDS, tags: ["herbs-directory"] }
);

export const getCachedHerbCategories = unstable_cache(
  async (locale: string) => fetchCategoriesList(locale),
  ["herbs-categories-v1"],
  { revalidate: DIRECTORY_TTL_SECONDS, tags: ["herbs-directory"] }
);
