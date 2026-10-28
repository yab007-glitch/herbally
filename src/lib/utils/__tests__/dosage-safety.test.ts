import { describe, it, expect } from "vitest";
import {
  assessDoseEligibility,
  monthsToYears,
  MINIMUM_DOSE_AGE_YEARS,
  MAXIMUM_DOSE_AGE_YEARS,
} from "../dosage-safety";

describe("assessDoseEligibility", () => {
  it("blocks every age below 18", () => {
    expect(MINIMUM_DOSE_AGE_YEARS).toBe(18);
    for (const age of [0.01, 0.5, 1, 2, 6, 8, 11.9, 12, 15, 17, 17.999]) {
      expect(assessDoseEligibility(age)).toEqual({
        status: "minor",
        ageYears: age,
      });
    }
  });

  it("blocks a newborn expressed in months (18 months)", () => {
    const ageYears = monthsToYears(18);
    expect(ageYears).toBe(1.5);
    expect(assessDoseEligibility(ageYears).status).toBe("minor");
  });

  it("blocks 215 months (just under 18 years) but allows 216 months", () => {
    expect(assessDoseEligibility(monthsToYears(215)).status).toBe("minor");
    expect(assessDoseEligibility(monthsToYears(215.9)).status).toBe("minor");
    expect(assessDoseEligibility(monthsToYears(216)).status).toBe("eligible");
  });

  it("allows exactly 18 years and older", () => {
    for (const age of [18, 18.5, 30, 65, MAXIMUM_DOSE_AGE_YEARS]) {
      expect(assessDoseEligibility(age)).toEqual({
        status: "eligible",
        ageYears: age,
      });
    }
  });

  it("treats missing, non-numeric, zero and negative ages as invalid (not minor)", () => {
    for (const value of [
      undefined,
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      -1,
      -17,
    ]) {
      const result = assessDoseEligibility(value as number | null | undefined);
      expect(result.status).toBe("invalid_age");
    }
  });

  it("treats implausibly old ages as invalid rather than adult", () => {
    expect(assessDoseEligibility(MAXIMUM_DOSE_AGE_YEARS + 1).status).toBe(
      "invalid_age"
    );
    expect(assessDoseEligibility(1000).status).toBe("invalid_age");
  });

  it("does not mutate or round the supplied age", () => {
    expect(assessDoseEligibility(17.9999)).toEqual({
      status: "minor",
      ageYears: 17.9999,
    });
  });
});

describe("monthsToYears", () => {
  it("converts 12 months to 1 year", () => {
    expect(monthsToYears(12)).toBe(1);
  });

  it("converts 216 months to 18 years", () => {
    expect(monthsToYears(216)).toBe(18);
  });

  it("returns NaN for non-finite input", () => {
    expect(Number.isNaN(monthsToYears(Number.NaN))).toBe(true);
  });
});
