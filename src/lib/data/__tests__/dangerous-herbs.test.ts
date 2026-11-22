import { describe, it, expect } from "vitest";
import { canShowDoseCalculator, isDangerousHerb } from "../dangerous-herbs";

describe("dangerous-herbs and dose calculator gate", () => {
  it("flags newly added lethal plants as dangerous", () => {
    for (const slug of [
      "atropa-belladonna-herb",
      "digitalis-purpurea-herb",
      "conium-maculatum-herb",
      "nerium-oleander",
      "mandragora-officinarum-herb",
      "ricinus-communis",
      "strychnos-nux-vomica",
      "taxus-baccata",
      "colchicum-autumnale-herb",
    ]) {
      expect(isDangerousHerb(slug)).toBe(true);
    }
    expect(isDangerousHerb("ginger")).toBe(false);
  });

  it("blocks dose calculator for lethal plants even if dosage_adult is populated", () => {
    expect(
      canShowDoseCalculator(
        "atropa-belladonna-herb",
        "Medical use only - pharmaceutical preparations"
      )
    ).toBe(false);
    expect(
      canShowDoseCalculator("conium-maculatum-herb", "Absolutely no use")
    ).toBe(false);
    expect(
      canShowDoseCalculator("ricinus-communis", "Castor oil: 15-60ml")
    ).toBe(false);
  });

  it("blocks dose calculator when dosage_adult is missing or non-dosable", () => {
    expect(canShowDoseCalculator("barosma-betulina", null)).toBe(false);
    expect(canShowDoseCalculator("barosma-betulina", "")).toBe(false);
    expect(
      canShowDoseCalculator(
        "collinsonia-canadensis-herb",
        "No modern standardized clinical dose is established"
      )
    ).toBe(false);
  });

  it("allows dose calculator for non-dangerous herbs with a recorded dose", () => {
    expect(canShowDoseCalculator("ginger", "500-1000 mg daily")).toBe(true);
  });
});
