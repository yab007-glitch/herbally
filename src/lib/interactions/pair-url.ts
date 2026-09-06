/**
 * Canonical herb↔drug pair URLs: `/interactions/[herb]/[drug]`.
 *
 * `drugSlug()` uses the generic/class name only — "Warfarin (Coumadin)" →
 * "warfarin", "Antidepressants (SSRIs)" → "antidepressants" — because that
 * is what people search ("turmeric and warfarin", not "warfarin-coumadin").
 * Verified collision-free across all 156 seeded pairs: no herb has two
 * drugs mapping to the same slug.
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
