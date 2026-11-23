import { describe, it, expect } from "vitest";
import {
  canShowDoseCalculator,
  isCalculatorBlockedSlug,
  isDangerousHerb,
} from "../dangerous-herbs";

describe("dangerous-herbs and dose calculator gate", () => {
  it("flags lethal, carcinogenic, cyanogenic, and cardiac-glycoside plants as dangerous", () => {
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
      "pokeroot",
      "lamiaceae-pennyroyal",
      "sassafras",
      "betel-nut",
      "ignatia-amara",
      "abrus-precatorius",
      "bitter-almond",
      "gobernadora",
      "ephedra-sinica",
      "cinchona",
      "secale-cornutum",
    ]) {
      expect(isDangerousHerb(slug)).toBe(true);
    }
    expect(isDangerousHerb("ginger")).toBe(false);
    expect(isDangerousHerb("ashwagandha")).toBe(false);
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
    expect(
      canShowDoseCalculator("secale-cornutum", "1-2 g traditionally")
    ).toBe(false);
  });

  it("blocks topical-only and non-scalable herbs via isCalculatorBlockedSlug", () => {
    for (const slug of ["comfrey", "tea-tree", "kava", "aloe-vera-leaf"]) {
      expect(isCalculatorBlockedSlug(slug)).toBe(true);
      expect(canShowDoseCalculator(slug, "Apply thinly twice daily")).toBe(
        false
      );
    }
  });

  it("blocks homeopathic, topical, controlled, and non-dosable dosage_adult strings", () => {
    expect(canShowDoseCalculator("barosma-betulina", null)).toBe(false);
    expect(canShowDoseCalculator("barosma-betulina", "")).toBe(false);
    expect(
      canShowDoseCalculator(
        "collinsonia-canadensis-herb",
        "No modern standardized clinical dose is established"
      )
    ).toBe(false);
    expect(
      canShowDoseCalculator("chamomile", "1–4 pellet three times daily")
    ).toBe(false);
    expect(canShowDoseCalculator("chamomile", "10–15 drops(s) daily")).toBe(
      false
    );
    expect(canShowDoseCalculator("chamomile", "For topical only use")).toBe(
      false
    );
    expect(canShowDoseCalculator("chamomile", "Controlled substance")).toBe(
      false
    );
  });

  it("allows dose calculator for non-dangerous herbs with a recorded dose", () => {
    expect(canShowDoseCalculator("ginger", "500-1000 mg daily")).toBe(true);
    expect(
      canShowDoseCalculator("ashwagandha", "300-600 mg root extract daily")
    ).toBe(true);
  });
});
