import { describe, it, expect } from "vitest";
import * as dosageCalc from "../dosage-calculations";
import {
  buildAdultReferenceDose,
  calculateBSA,
  lbsToKg,
  kgToLbs,
} from "../dosage-calculations";

describe("removed pediatric & adult-scaling extrapolation helpers", () => {
  it("does not export friedsRule, recommendFormula, clarksRule, youngsRule, or bsaMethod", () => {
    const mod = dosageCalc as Record<string, unknown>;
    expect(mod.friedsRule).toBeUndefined();
    expect(mod.recommendFormula).toBeUndefined();
    expect(mod.clarksRule).toBeUndefined();
    expect(mod.youngsRule).toBeUndefined();
    expect(mod.bsaMethod).toBeUndefined();
  });
});

describe("buildAdultReferenceDose", () => {
  it("rejects under-18, age 0, null, and >120 ages", () => {
    for (const ageYears of [0, 8, 17.99, -1, 121, Number.NaN]) {
      expect(() =>
        buildAdultReferenceDose({
          adultDose: 500,
          unit: "mg",
          ageYears,
        })
      ).toThrow(/adult/i);
    }
  });

  it("rejects zero/negative/non-finite adult doses and implausible weights", () => {
    expect(() =>
      buildAdultReferenceDose({ adultDose: 0, unit: "mg", ageYears: 30 })
    ).toThrow();
    expect(() =>
      buildAdultReferenceDose({
        adultDose: 500,
        unit: "mg",
        ageYears: 30,
        weightKg: 0,
      })
    ).toThrow(/weight/i);
    expect(() =>
      buildAdultReferenceDose({
        adultDose: 500,
        unit: "mg",
        ageYears: 30,
        weightKg: 10,
      })
    ).toThrow(/weight/i);
    expect(() =>
      buildAdultReferenceDose({
        adultDose: 500,
        unit: "mg",
        ageYears: 30,
        weightKg: 500,
      })
    ).toThrow(/weight/i);
  });

  it("returns the exact unscaled adult reference dose without extrapolation for confirmed adults", () => {
    const result = buildAdultReferenceDose({
      adultDose: 500,
      unit: "mg",
      ageYears: 30,
      weightKg: 70,
    });
    expect(result.dose).toBe(500);
    expect(result.unit).toBe("mg");
    expect(result.formulaKey).toBe("adult_reference");
    expect(result.ageYears).toBe(30);
    expect(result.clamped).toBe(false);
  });
});

describe("calculateBSA", () => {
  it("enforces age >= 18 and positive adult dimensions", () => {
    expect(() => calculateBSA(120, 30, 8)).toThrow(/adult/i);
    expect(() => calculateBSA(120, 30, 0)).toThrow(/adult/i);
    expect(() => calculateBSA(0, 70, 30)).toThrow();
    expect(() => calculateBSA(170, 0, 30)).toThrow();
    expect(calculateBSA(180, 80, 30)).toBe(2);
  });
});

describe("lbsToKg / kgToLbs", () => {
  it("converts pounds and kilograms", () => {
    expect(lbsToKg(150)).toBe(68);
    expect(lbsToKg(0)).toBe(0);
    expect(kgToLbs(68)).toBe(149.9);
  });
});
