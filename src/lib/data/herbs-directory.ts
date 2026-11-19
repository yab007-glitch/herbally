import { unstable_cache } from "next/cache";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { localizeHerb, localizeCategoryName } from "@/lib/utils/localize-herb";
import { logger } from "@/lib/utils/logger";
import type { HerbCategory, HerbWithCategory } from "@/lib/types";

const DIRECTORY_PAGE_SIZE = 20;
const DIRECTORY_TTL_SECONDS = 900;

const DIRECTORY_CARD_SELECT = [
  "id",
  "slug",
  "name",
  "scientific_name",
  "common_names",
  "description",
  "traditional_uses",
  "dosage_adult",
  "pregnancy_safe",
  "nursing_safe",
  "updated_at",
  "image_url",
  "evidence_level",
  "provenance",
  "translations",
  "category_id",
  "herb_categories(id,name,name_fr,slug,sort_order,description,icon,created_at)",
].join(",");

async function fetchDefaultDirectoryPage(
  locale: string,
  sort: "name" | "evidence"
): Promise<{ herbs: HerbWithCategory[]; total: number }> {
  const supabase = getAnonClient();
  if (!supabase) {
    throw new Error("Supabase anonymous client unavailable");
  }

  const { data, count, error } = await supabase
    .from("herbs")
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
    localizeHerb(h, locale)
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
  ["herbs-directory-p1-v1"],
  { revalidate: DIRECTORY_TTL_SECONDS, tags: ["herbs-directory"] }
);

export const getCachedHerbCategories = unstable_cache(
  async (locale: string) => fetchCategoriesList(locale),
  ["herbs-categories-v1"],
  { revalidate: DIRECTORY_TTL_SECONDS, tags: ["herbs-directory"] }
);
