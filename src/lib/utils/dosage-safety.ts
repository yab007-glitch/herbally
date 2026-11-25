/**
 * Age-eligibility gate and legacy quarantine checks for the herbal dose calculator.
 *
 * HerbAlly does not compute, extrapolate, prefill, display, persist, retrieve,
 * cache, print, or synthesize numerical herbal doses for anyone under 18 or for
 * unknown/unverified ages.
 *
 * Pediatric herbal dosing lacks validated, preparation-specific pediatric
 * evidence: historical drug-scaling formulas (Clark's, Young's, Fried's, BSA)
 * are not validated for botanical products or adult herbal dosing either.
 */

/** The youngest age for which HerbAlly permits adult reference display. */
export const MINIMUM_DOSE_AGE_YEARS = 18 as const;

/**
 * Upper sanity bound. Ages above this are typos or fabricated payloads, not
 * patients, and fail closed as unverified.
 */
export const MAXIMUM_DOSE_AGE_YEARS = 120 as const;

/** Plausible adult weight bounds (kg) when weight is supplied. */
export const MIN_ADULT_WEIGHT_KG = 20 as const;
export const MAX_ADULT_WEIGHT_KG = 350 as const;

export type DoseEligibility =
  | { status: "eligible"; ageYears: number }
  | { status: "pediatric_unavailable"; ageYears: number }
  | { status: "age_unverified" };

/**
 * Classify an age (in years) for adult reference eligibility.
 *
 * - `pediatric_unavailable` — 0 through < 18 (includes newborns/infants at 0).
 * - `eligible`              — 18 through 120 inclusive.
 * - `age_unverified`        — missing, non-finite, negative, or > 120.
 */
export function assessDoseEligibility(
  ageYears: number | null | undefined
): DoseEligibility {
  if (
    ageYears === null ||
    ageYears === undefined ||
    !Number.isFinite(ageYears) ||
    ageYears < 0 ||
    ageYears > MAXIMUM_DOSE_AGE_YEARS
  ) {
    return { status: "age_unverified" };
  }
  if (ageYears < MINIMUM_DOSE_AGE_YEARS) {
    return { status: "pediatric_unavailable", ageYears };
  }
  return { status: "eligible", ageYears };
}

/** True when age is a valid confirmed minor/infant age (0 <= age < 18). */
export function isPediatricAge(ageYears: number | null | undefined): boolean {
  return assessDoseEligibility(ageYears).status === "pediatric_unavailable";
}

/**
 * True ONLY when a patient profile represents a confirmed adult eligible for
 * calculator autofill. Child relationships, age_months profiles, <18 ages,
 * and unknown-age profiles NEVER autofill dosing fields.
 */
export function isAdultDosingEligibleProfile(profile: {
  relationship?: string | null;
  age_years?: number | null;
  age_months?: number | null;
}): boolean {
  if (!profile) return false;
  if ((profile.relationship ?? "").trim().toLowerCase() === "child") {
    return false;
  }
  if (profile.age_months !== null && profile.age_months !== undefined) {
    return false;
  }
  return assessDoseEligibility(profile.age_years).status === "eligible";
}

/**
 * True when a stored dosage_calculations row is a legacy pediatric, unknown-age,
 * or disabled-formula row that must be quarantined/redacted from display.
 */
export function isLegacyQuarantinedCalculation(row: {
  is_legacy_pediatric_quarantined?: boolean | null;
  patient_age?: number | null;
  formula_used?: string | null;
}): boolean {
  if (row.is_legacy_pediatric_quarantined === true) return true;
  if (row.formula_used && row.formula_used !== "adult_reference") return true;
  return assessDoseEligibility(row.patient_age).status !== "eligible";
}
