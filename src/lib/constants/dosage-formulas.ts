export const DOSAGE_FORMULAS = {
  adult_reference: {
    name: "Unscaled Adult Reference (18+)",
    description:
      "Displays the confirmed adult monograph reference amount without pediatric or weight/age scaling.",
    formula: "Adult Reference = Stated Adult Oral Dose (no scaling)",
    bestFor: "Adults 18+ reviewing an established monograph dose",
    requires: ["age"],
  },
} as const;

export type FormulaKey = keyof typeof DOSAGE_FORMULAS;
