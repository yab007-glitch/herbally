import type { Database } from "./database";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type HerbCategory = Tables<"herb_categories">;
export type Herb = Tables<"herbs">;
export type DrugInteraction = Tables<"drug_interactions">;
export type UserMedication = Tables<"user_medications">;
export type InteractionCheck = Tables<"interaction_checks">;
export type DosageCalculation = Tables<"dosage_calculations">;

export type UserRole = "user" | "admin";
export type InteractionSeverity =
  | "mild"
  | "moderate"
  | "severe"
  | "contraindicated";
export type DosageForm =
  | "capsule"
  | "tablet"
  | "tincture"
  | "tea"
  | "powder"
  | "essential_oil"
  | "extract"
  | "topical"
  | "other";
export type FormulaType = "clarks_rule" | "youngs_rule" | "bsa" | "fried_rule";

// Extended types with joins
export type HerbWithCategory = Herb & {
  herb_categories: HerbCategory | null;
};

export type HerbWithInteractions = Herb & {
  herb_categories: HerbCategory | null;
  drug_interactions: DrugInteraction[];
};

export type InteractionCheckWithHerb = InteractionCheck & {
  herbs: Herb | null;
};

export type DosageCalculationWithHerb = DosageCalculation & {
  herbs: Herb | null;
};

/**
 * Discriminated union so callers get compile-time narrowing:
 *   - on the `success: true` branch, `error` is not accessible and `data` is
 *     `T | undefined` (optional, since void actions legitimately carry no
 *     payload);
 *   - on the `success: false` branch, `error` is a required string (callers
 *     can read `result.error` without a null check) and `data` is not
 *     accessible.
 *
 * The previous loose shape (`error?: string`) let failure responses omit
 * `error`, so callers reading `result.error` after a `!success` check could
 * surface `undefined` to users; the union makes that a compile error.
 */
export type ActionResponse<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
