import {
  assessDoseEligibility,
  MAX_ADULT_WEIGHT_KG,
  MIN_ADULT_WEIGHT_KG,
} from "./dosage-safety";

export type DoseExplanationKey = "adult_reference";

export type DoseResult = {
  dose: number;
  unit: string;
  formula: string;
  formulaKey: "adult_reference";
  ageYears: number;
  explanation: string;
  explanationKey: DoseExplanationKey;
  explanationParams: Record<string, string | number>;
  rawDose: number;
  clamped: false;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Build an unscaled adult reference record for a confirmed adult (18..120).
 *
 * HerbAlly no longer applies pediatric weight/age scaling formulas (Clark's,
 * Young's, Fried's, or BSA dose scaling) to botanical products: those drug
 * formulas lack clinical validation for herbal extracts and previously produced
 * misleading doses. Instead, only the unscaled adult reference amount is
 * confirmed after passing the age and adult weight plausibility gates.
 */
export function buildAdultReferenceDose(params: {
  adultDose: number;
  unit?: string;
  ageYears: number;
  weightKg?: number | null;
  heightCm?: number | null;
}): DoseResult {
  const { adultDose, unit = "mg", ageYears, weightKg, heightCm } = params;
  const eligibility = assessDoseEligibility(ageYears);
  if (eligibility.status !== "eligible") {
    throw new Error(
      "Adult age (18-120 years) is required for herbal reference dosing"
    );
  }
  if (!Number.isFinite(adultDose) || adultDose <= 0) {
    throw new Error("Adult reference dose must be a positive finite number");
  }
  if (weightKg !== undefined && weightKg !== null) {
    if (
      !Number.isFinite(weightKg) ||
      weightKg < MIN_ADULT_WEIGHT_KG ||
      weightKg > MAX_ADULT_WEIGHT_KG
    ) {
      throw new Error(
        `Adult weight must be between ${MIN_ADULT_WEIGHT_KG} and ${MAX_ADULT_WEIGHT_KG} kg`
      );
    }
  }
  if (heightCm !== undefined && heightCm !== null) {
    if (!Number.isFinite(heightCm) || heightCm <= 0 || heightCm > 300) {
      throw new Error("Height must be a positive number up to 300 cm");
    }
  }

  const rounded = round1(adultDose);
  return {
    dose: rounded,
    rawDose: adultDose,
    clamped: false,
    unit,
    formulaKey: "adult_reference",
    ageYears: eligibility.ageYears,
    formula: `Unscaled adult reference (18+): ${rounded} ${unit}`,
    explanation: `Adult reference dose confirmed for age ${eligibility.ageYears} years (18+). No weight- or age-scaling formula is applied.`,
    explanationKey: "adult_reference",
    explanationParams: { age: eligibility.ageYears, dose: rounded, unit },
  };
}

/**
 * Calculate Body Surface Area (m²) using the Mosteller formula for confirmed adults (18+).
 */
export function calculateBSA(
  heightCm: number,
  weightKg: number,
  ageYears: number
): number {
  const eligibility = assessDoseEligibility(ageYears);
  if (eligibility.status !== "eligible") {
    throw new Error("Adult age (18-120 years) is required to calculate BSA");
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error("Height must be a positive number");
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Weight must be a positive number");
  }
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/** Convert pounds to kilograms. */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

/** Convert kilograms to pounds. */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}
