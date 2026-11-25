import type { InteractionPair } from "./pairs";

/**
 * Thrown when an interaction or herb-resolution lookup cannot complete
 * because the database or Supabase client is unavailable. Callers must treat
 * this as an unavailable/5xx condition — never as "no interaction found".
 */
export class InteractionDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InteractionDataUnavailableError";
  }
}

/**
 * Thrown when multiple distinct `drug_interactions` rows map to the same
 * canonical `/interactions/[herb]/[drug]` URL without an editorial disambiguation.
 * Callers must fail safely (surface all colliding records or refuse to choose
 * a single severity by code).
 */
export class InteractionUrlCollisionError extends Error {
  readonly herbSlug: string;
  readonly drugSlug: string;
  readonly pairs: InteractionPair[];

  constructor(herbSlug: string, drugSlug: string, pairs: InteractionPair[]) {
    super(
      `Interaction URL collision for /interactions/${herbSlug}/${drugSlug} (${pairs.length} rows)`
    );
    this.name = "InteractionUrlCollisionError";
    this.herbSlug = herbSlug;
    this.drugSlug = drugSlug;
    this.pairs = pairs;
  }
}

/**
 * True when running under the CI placeholder Supabase config where no real
 * database exists and unavailable lookups should resolve cleanly to 404.
 */
export function isStubSupabase(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(
    "placeholder.supabase.co"
  );
}
