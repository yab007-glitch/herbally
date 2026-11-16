/**
 * Category used as an import fallback bucket (~92% of the library falls into it).
 * Printing it as a prominent category pill or JSON-LD category adds noise.
 */
export const BUCKET_CATEGORY = "Not Common";

/** True when the category name is just the generic "Not Common" / "Pas courant" bucket. */
export function isBucketCategory(name: string | null | undefined): boolean {
  return !!name && /^(not common|pas courant)$/i.test(name.trim());
}
