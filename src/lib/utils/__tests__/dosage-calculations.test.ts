import { describe, it, expect } from "vitest";
import {
  clarksRule,
  youngsRule,
  bsaMethod,
  friedsRule,
  calculateBSA,
  lbsToKg,
  kgToLbs,
  recommendFormula,
} from "../dosage-calculations";

describe("clarksRule", () => {
  it("calculates dose for a 30kg child with 500mg adult dose", () => {
    const result = clarksRule(30, 500);
    // (30/68) * 500 = 220.588... -> 220.6
    expect(result.dose).toBe(220.6);
    expect(result.unit).toBe("mg");
  });

  it("returns full adult dose for 68kg patient", () => {
    const result = clarksRule(68, 500);
    expect(result.dose).toBe(500);
  });

  it("handles zero weight", () => {
    const result = clarksRule(0, 500);
    expect(result.dose).toBe(0);
  });
});

describe("youngsRule", () => {
  it("calculates dose for a 6-year-old with 500mg adult dose", () => {
    const result = youngsRule(6, 500);
    // (6 / (6+12)) * 500 = 166.666... -> 166.7
    expect(result.dose).toBe(166.7);
    expect(result.unit).toBe("mg");
  });

  it("approaches adult dose for older children", () => {
    const result = youngsRule(12, 500);
    // (12/24) * 500 = 250
    expect(result.dose).toBe(250);
  });
});

describe("bsaMethod", () => {
  it("calculates dose using height and weight", () => {
    const result = bsaMethod(120, 30, 500);
    // BSA = sqrt((120*30)/3600) = sqrt(1) = 1.0
    // dose = (1.0/1.73) * 500 = 289.017... -> 289
    expect(result.dose).toBe(289);
    expect(result.unit).toBe("mg");
  });

  it("clamps a large adult to the adult reference dose", () => {
    // 173cm/70kg -> BSA ~= 1.83, so (bsa/1.73)*500 ~= 530, which exceeds the
    // 500mg adult reference. The pediatric clamp caps it at the adult dose.
    const result = bsaMethod(173, 70, 500);
    expect(result.dose).toBe(500);
    expect(result.clamped).toBe(true);
  });

  it("does not clamp a sub-adult BSA", () => {
    // 120cm/30kg -> BSA 1.0 -> 289mg, well below the 500mg adult dose.
    const result = bsaMethod(120, 30, 500);
    expect(result.dose).toBe(289);
    expect(result.clamped).toBe(false);
  });
});

describe("friedsRule", () => {
  it("calculates dose for a 12-month infant with 500mg adult dose", () => {
    const result = friedsRule(12, 500);
    // (12/150) * 500 = 40
    expect(result.dose).toBe(40);
    expect(result.unit).toBe("mg");
  });

  it("calculates dose for a 6-month infant", () => {
    const result = friedsRule(6, 500);
    // (6/150) * 500 = 20
    expect(result.dose).toBe(20);
  });
});

describe("calculateBSA", () => {
  it("calculates body surface area correctly", () => {
    // sqrt((120 * 30) / 3600) = sqrt(1) = 1.0
    expect(calculateBSA(120, 30)).toBe(1);
  });

  it("returns ~1.73 for standard adult", () => {
    // sqrt((180 * 80) / 3600) = sqrt(4) = 2.0
    expect(calculateBSA(180, 80)).toBe(2);
  });
});

describe("lbsToKg", () => {
  it("converts 150 lbs to ~68.0 kg", () => {
    expect(lbsToKg(150)).toBe(68);
  });

  it("handles zero", () => {
    expect(lbsToKg(0)).toBe(0);
  });
});

describe("kgToLbs", () => {
  it("converts 68 kg to ~149.9 lbs", () => {
    expect(kgToLbs(68)).toBe(149.9);
  });
});

describe("recommendFormula", () => {
  it("recommends Fried's rule for infants under 24 months", () => {
    expect(recommendFormula({ ageMonths: 12 })).toBe("fried_rule");
    expect(recommendFormula({ ageMonths: 6 })).toBe("fried_rule");
  });

  it("recommends Fried's rule for children under 2 years", () => {
    expect(recommendFormula({ ageYears: 1 })).toBe("fried_rule");
  });

  it("recommends BSA when both height and weight available", () => {
    expect(recommendFormula({ ageYears: 8, weightKg: 30, heightCm: 120 })).toBe(
      "bsa"
    );
  });

  it("recommends Clark's rule when only weight available", () => {
    expect(recommendFormula({ ageYears: 8, weightKg: 30 })).toBe("clarks_rule");
  });

  it("recommends Young's rule as fallback (age only)", () => {
    expect(recommendFormula({ ageYears: 8 })).toBe("youngs_rule");
  });
});
