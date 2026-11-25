import { describe, it, expect } from "vitest";
import {
  assessDoseEligibility,
  isAdultDosingEligibleProfile,
  isLegacyQuarantinedCalculation,
  isPediatricAge,
  MINIMUM_DOSE_AGE_YEARS,
  MAXIMUM_DOSE_AGE_YEARS,
  MIN_ADULT_WEIGHT_KG,
  MAX_ADULT_WEIGHT_KG,
} from "../dosage-safety";

describe("assessDoseEligibility", () => {
  it("classifies 0 and every age below 18 as pediatric_unavailable", () => {
    expect(MINIMUM_DOSE_AGE_YEARS).toBe(18);
    for (const age of [0, 0.01, 0.5, 1, 2, 6, 8, 11.9, 12, 15, 17, 17.999]) {
      expect(assessDoseEligibility(age)).toEqual({
        status: "pediatric_unavailable",
        ageYears: age,
      });
      expect(isPediatricAge(age)).toBe(true);
    }
  });

  it("allows exactly 18 years through 120 inclusive", () => {
    for (const age of [18, 18.5, 30, 65, MAXIMUM_DOSE_AGE_YEARS]) {
      expect(assessDoseEligibility(age)).toEqual({
        status: "eligible",
        ageYears: age,
      });
      expect(isPediatricAge(age)).toBe(false);
    }
  });

  it("treats missing, non-finite, negative, and >120 ages as age_unverified (fail closed)", () => {
    for (const value of [
      undefined,
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0.1,
      -1,
      -17,
      MAXIMUM_DOSE_AGE_YEARS + 0.01,
      MAXIMUM_DOSE_AGE_YEARS + 1,
      1000,
    ]) {
      const result = assessDoseEligibility(value as number | null | undefined);
      expect(result.status).toBe("age_unverified");
    }
  });

  it("exports adult weight plausibility bounds", () => {
    expect(MIN_ADULT_WEIGHT_KG).toBe(20);
    expect(MAX_ADULT_WEIGHT_KG).toBe(350);
  });
});

describe("isAdultDosingEligibleProfile", () => {
  it("rejects child relationships, age_months profiles, minors, and unknown-age profiles", () => {
    expect(
      isAdultDosingEligibleProfile({
        relationship: "child",
        age_years: null,
        age_months: 18,
      })
    ).toBe(false);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "child",
        age_years: 20,
        age_months: null,
      })
    ).toBe(false);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "self",
        age_years: null,
        age_months: 6,
      })
    ).toBe(false);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "self",
        age_years: 12,
        age_months: null,
      })
    ).toBe(false);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "self",
        age_years: null,
        age_months: null,
      })
    ).toBe(false);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "self",
        age_years: 0,
        age_months: null,
      })
    ).toBe(false);
  });

  it("accepts verified adult non-child profiles without age_months", () => {
    expect(
      isAdultDosingEligibleProfile({
        relationship: "self",
        age_years: 30,
        age_months: null,
      })
    ).toBe(true);
    expect(
      isAdultDosingEligibleProfile({
        relationship: "partner",
        age_years: 18,
        age_months: null,
      })
    ).toBe(true);
  });
});

describe("isLegacyQuarantinedCalculation", () => {
  it("flags legacy minor, zero-age, null-age, >120, fried_rule, and explicitly quarantined rows", () => {
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: 8,
        formula_used: "clarks_rule",
      })
    ).toBe(true);
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: 0,
        formula_used: "youngs_rule",
      })
    ).toBe(true);
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: null,
        formula_used: "clarks_rule",
      })
    ).toBe(true);
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: 35,
        formula_used: "fried_rule",
      })
    ).toBe(true);
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: 35,
        formula_used: "adult_reference",
        is_legacy_pediatric_quarantined: true,
      })
    ).toBe(true);
  });

  it("quarantines ALL non-adult_reference formulas even on adult ages", () => {
    for (const formula of ["fried_rule", "clarks_rule", "youngs_rule", "bsa"]) {
      expect(
        isLegacyQuarantinedCalculation({
          patient_age: 35,
          formula_used: formula,
        })
      ).toBe(true);
    }
    expect(
      isLegacyQuarantinedCalculation({
        patient_age: 35,
        formula_used: "adult_reference",
        is_legacy_pediatric_quarantined: false,
      })
    ).toBe(false);
  });
});
