import { getAnonClient } from "@/lib/supabase/anonymous";

/**
 * Count published herbs directly from Postgres so browse-all CTAs never drift
 * behind catalog growth; returns `null` when the query fails so callers can
 * fall back to a count-free label.
 */
export async function loadPublishedHerbCount(): Promise<number | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from("herbs")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

export function formatBrowseAllHerbsLabel(
  count: number | null,
  fr: boolean
): string {
  if (count && count > 0) {
    return fr
      ? `Parcourir les ${count.toLocaleString("fr-CA")} plantes`
      : `Browse all ${count.toLocaleString("en-CA")} herbs`;
  }
  return fr ? "Parcourir toutes les plantes" : "Browse all herbs";
}
