export const DOSAGE_FORMULAS = {
  clarks_rule: {
    name: "Clark's Rule",
    description:
      "Weight-based reference calculation. Adult reference weight is 68 kg.",
    formula: "Reference Dose = (Weight in kg / 68) x Adult Dose",
    bestFor: "Adults, weight-based reference",
    requires: ["weight"],
  },
  youngs_rule: {
    name: "Young's Rule",
    description:
      "Age-based reference calculation. Less accurate than weight-based methods.",
    formula: "Reference Dose = (Age / (Age + 12)) x Adult Dose",
    bestFor: "Adults, age-based reference",
    requires: ["age"],
  },
  bsa: {
    name: "BSA Method (Mosteller)",
    description: "Body surface area reference calculation.",
    formula:
      "Dose = (BSA / 1.73) x Adult Dose, where BSA = sqrt(Height x Weight / 3600)",
    bestFor: "Adults when height and weight are known",
    requires: ["weight", "height"],
  },
  fried_rule: {
    name: "Fried's Rule",
    description:
      "Age-in-months reference method. Not applicable to adults 18 and over.",
    formula: "Reference Dose = (Age in months / 150) x Adult Dose",
    bestFor: "Not applicable to adults 18+",
    requires: ["age_months"],
  },
} as const;

export type FormulaKey = keyof typeof DOSAGE_FORMULAS;
