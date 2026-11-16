/** Which translated explanation accompanies a result (see calculatorForm.explanations). */
export type DoseExplanationKey = "clark" | "young" | "bsa" | "fried";

export type DoseResult = {
  dose: number;
  unit: string;
  formula: string;
  /** English-only legacy text. The UI renders the localized explanation instead. */
  explanation: string;
  /** Localized explanation key + values, so /fr is never English. */
  explanationKey: DoseExplanationKey;
  explanationParams: Record<string, string | number>;
  /**
   * The uncapped formula result. The UI compares it with the adult reference
   * dose: a cap within a few percent (70 kg with Clark's Rule is only 2.9 %
   * over 68 kg) is a rounding-level no-op, and warning about it alarmed
   * ordinary adults on every page.
   */
  rawDose: number;
  /**
   * True when the raw formula result was capped at the adult reference dose.
   * Pediatric dosing formulas scale the adult dose by a fraction < 1, so a
   * computed value greater than the adult dose means implausible input — we
   * cap it rather than surface a potential overdose.
   */
  clamped: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Clamp a pediatric dose to the adult reference dose. Returns the (possibly
 * capped) rounded dose and whether clamping occurred.
 */
function clampToAdult(
  dose: number,
  adultDoseMg: number
): {
  dose: number;
  clamped: boolean;
} {
  if (Number.isFinite(dose) && adultDoseMg > 0 && dose > adultDoseMg) {
    return { dose: round1(adultDoseMg), clamped: true };
  }
  return { dose: round1(dose), clamped: false };
}

/**
 * Clark's Rule: (weight_kg / 68) x adult_dose
 * Weight-based reference calculation.
 */
export function clarksRule(
  weightKg: number,
  adultDoseMg: number,
  unit: string = "mg"
): DoseResult {
  const raw = (weightKg / 68) * adultDoseMg;
  const { dose, clamped } = clampToAdult(raw, adultDoseMg);
  return {
    dose,
    clamped,
    rawDose: raw,
    unit,
    formula: `(${weightKg} kg / 68) x ${adultDoseMg} ${unit}`,
    explanation: `Based on Clark's Rule using patient weight of ${weightKg} kg. The standard adult reference weight is 68 kg (150 lbs).`,
    explanationKey: "clark",
    explanationParams: { weight: weightKg },
  };
}

/**
 * Young's Rule: (age / (age + 12)) x adult_dose
 * Age-based reference calculation. `ageYears` MUST be in years.
 */
export function youngsRule(
  ageYears: number,
  adultDoseMg: number,
  unit: string = "mg"
): DoseResult {
  const raw = (ageYears / (ageYears + 12)) * adultDoseMg;
  const { dose, clamped } = clampToAdult(raw, adultDoseMg);
  return {
    dose,
    clamped,
    rawDose: raw,
    unit,
    formula: `(${ageYears} / (${ageYears} + 12)) x ${adultDoseMg} ${unit}`,
    explanation: `Based on Young's Rule using patient age of ${ageYears} years. This is an age-based reference calculation, less accurate than weight-based methods.`,
    explanationKey: "young",
    explanationParams: { age: ageYears },
  };
}

/**
 * BSA Method (Mosteller): (BSA / 1.73) x adult_dose
 * BSA = sqrt((height_cm x weight_kg) / 3600)
 * Most accurate method
 */
export function bsaMethod(
  heightCm: number,
  weightKg: number,
  adultDoseMg: number,
  unit: string = "mg"
): DoseResult {
  const bsa = Math.sqrt((heightCm * weightKg) / 3600);
  const raw = (bsa / 1.73) * adultDoseMg;
  const { dose, clamped } = clampToAdult(raw, adultDoseMg);
  return {
    dose,
    clamped,
    rawDose: raw,
    unit,
    formula: `(${bsa.toFixed(3)} m² / 1.73) x ${adultDoseMg} ${unit}`,
    explanation: `Based on BSA method using body surface area of ${bsa.toFixed(3)} m² (height: ${heightCm} cm, weight: ${weightKg} kg). The standard adult BSA is 1.73 m².`,
    explanationKey: "bsa",
    explanationParams: {
      bsa: bsa.toFixed(3),
      height: heightCm,
      weight: weightKg,
    },
  };
}

/**
 * Fried's Rule: (age_months / 150) x adult_dose
 * Age-in-months reference method; not applicable to adults 18+.
 */
export function friedsRule(
  ageMonths: number,
  adultDoseMg: number,
  unit: string = "mg"
): DoseResult {
  const raw = (ageMonths / 150) * adultDoseMg;
  const { dose, clamped } = clampToAdult(raw, adultDoseMg);
  return {
    dose,
    clamped,
    rawDose: raw,
    unit,
    formula: `(${ageMonths} months / 150) x ${adultDoseMg} ${unit}`,
    explanation: `Based on Fried's Rule using age of ${ageMonths} months. This method is not applicable to adults 18 and over.`,
    explanationKey: "fried",
    explanationParams: { months: ageMonths },
  };
}

/**
 * Calculate BSA using the Mosteller formula
 */
export function calculateBSA(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/**
 * Convert pounds to kilograms
 */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

/**
 * Convert kilograms to pounds
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

/**
 * Recommend the best formula based on available patient data.
 * Returns null when there is not enough data to pick a formula — callers must
 * handle this rather than silently defaulting to an age-based formula that
 * produces NaN when no age was supplied.
 */
export function recommendFormula(params: {
  ageYears?: number;
  ageMonths?: number;
  weightKg?: number;
  heightCm?: number;
}): "clarks_rule" | "youngs_rule" | "bsa" | "fried_rule" | null {
  const { ageYears, ageMonths, weightKg, heightCm } = params;

  // Infants under 2 years
  if (ageMonths !== undefined && ageMonths < 24) {
    return "fried_rule";
  }
  if (ageYears !== undefined && ageYears < 2) {
    return "fried_rule";
  }

  // If both height and weight available, BSA is most accurate
  if (weightKg && heightCm) {
    return "bsa";
  }

  // Weight-based is next best
  if (weightKg) {
    return "clarks_rule";
  }

  // Age-based only when we actually have an age to use
  if (ageYears !== undefined || ageMonths !== undefined) {
    return "youngs_rule";
  }

  // No usable patient data — caller must prompt for input.
  return null;
}
