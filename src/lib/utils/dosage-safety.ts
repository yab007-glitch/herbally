/**
 * Age-eligibility gate for the herbal dose calculator.
 *
 * HerbAlly does not generate a numerical herbal dose for anyone under 18.
 * Pediatric herbal dosing lacks validated, product-specific evidence: the
 * historical Clark's / Young's / Fried's rules scale an *adult drug* dose by
 * weight or age and were never validated for botanical extracts, whose active
 * constituents and concentrations vary by product. The production failure this
 * module exists to prevent: a 60 kg eight-year-old received "441.2 mg
 * turmeric" from Clark's rule even though the herb's own monograph says it is
 * not recommended under 12.
 *
 * HerbalAlly therefore refuses to compute pediatric numbers at all and points
 * the caregiver to a qualified pediatric healthcare professional. Adult doses
 * (18+) remain available and are always labelled as reference estimates, never
 * as medical advice.
 *
 * This is a single source of truth shared by the client form and the server
 * action, so a direct call to `saveDosageCalculation` cannot persist a
 * pediatric calculation by bypassing the UI.
 */

/** The youngest age for which HerbAlly will compute a dose. */
export const MINIMUM_DOSE_AGE_YEARS = 18 as const;

/**
 * Upper sanity bound. Ages above this are typos or fabricated payloads, not
 * patients, and are rejected rather than treated as adults.
 */
export const MAXIMUM_DOSE_AGE_YEARS = 120 as const;

export type DoseEligibility =
  | { status: "eligible"; ageYears: number }
  | { status: "minor"; ageYears: number }
  | { status: "invalid_age" };

/**
 * Classify an age (in years) for dose calculation.
 *
 * - `minor`       — under 18: never compute a number.
 * - `eligible`    — 18 through 120 inclusive.
 * - `invalid_age` — missing, non-finite, zero/negative, or implausibly old.
 *
 * Note that `0` and negatives are deliberately `invalid_age`, not `minor`:
 * they are absent/erroneous input rather than a real infant, and the UI shows
 * a different message for them. Both are blocked either way.
 */
export function assessDoseEligibility(
  ageYears: number | null | undefined
): DoseEligibility {
  if (
    ageYears === null ||
    ageYears === undefined ||
    !Number.isFinite(ageYears) ||
    ageYears <= 0 ||
    ageYears > MAXIMUM_DOSE_AGE_YEARS
  ) {
    return { status: "invalid_age" };
  }
  if (ageYears < MINIMUM_DOSE_AGE_YEARS) {
    return { status: "minor", ageYears };
  }
  return { status: "eligible", ageYears };
}

/** Convert months to years. Non-finite input propagates as NaN. */
export function monthsToYears(months: number): number {
  return months / 12;
}

/**
 * Explain, in the calculator's own terms, why no number is shown.
 * Kept here (not in the component) so the rule and its rationale live
 * together and are unit-testable.
 */
export function isPediatricAge(ageYears: number | null | undefined): boolean {
  return assessDoseEligibility(ageYears).status === "minor";
}
