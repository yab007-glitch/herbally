import { describe, it, expect } from "vitest";
import { matchesDrugInteraction } from "../drug-match";

describe("matchesDrugInteraction — M5 token + synonym matching", () => {
  it("matches a generic name to a seed row that contains it", () => {
    expect(
      matchesDrugInteraction("Warfarin", "Anticoagulants (Warfarin)")
    ).toBe(true);
  });

  it("matches a brand name to the generic via the synonym map", () => {
    // User types brand "Coumadin"; seed row is "Anticoagulants (Warfarin)".
    expect(
      matchesDrugInteraction("Coumadin", "Anticoagulants (Warfarin)")
    ).toBe(true);
  });

  it("matches 'birth control pills' to 'Oral Contraceptives' (the M5 false-negative case)", () => {
    expect(
      matchesDrugInteraction("birth control pills", "Oral Contraceptives")
    ).toBe(true);
  });

  it("matches 'xanax' to 'Benzodiazepines (general)' via alprazolam", () => {
    expect(matchesDrugInteraction("xanax", "Benzodiazepines (general)")).toBe(
      true
    );
  });

  it("matches a class token ('ssri') to a specific SSRI row", () => {
    expect(matchesDrugInteraction("ssri", "Sertraline (Zoloft)")).toBe(true);
  });

  it("does NOT match a short token like 'na' to any drug containing 'na'", () => {
    // The old bidirectional .includes() matched "na" inside "Diphenhydramine".
    expect(matchesDrugInteraction("na", "Diphenhydramine (Benadryl)")).toBe(
      false
    );
  });

  it("returns false when the user medication is unrelated to the interaction drug", () => {
    expect(matchesDrugInteraction("Metformin", "Sertraline (Zoloft)")).toBe(
      false
    );
  });

  it("returns false for an empty/whitespace user medication", () => {
    expect(matchesDrugInteraction("   ", "Warfarin")).toBe(false);
    expect(matchesDrugInteraction("", "Warfarin")).toBe(false);
  });

  it("pluralizes/singularizes correctly (statin vs statins)", () => {
    expect(matchesDrugInteraction("statins", "Atorvastatin (Lipitor)")).toBe(
      true
    );
  });

  it("matches multi-word phrase 'blood thinner' to the anticoagulant group", () => {
    expect(
      matchesDrugInteraction("blood thinner", "Anticoagulants (Warfarin)")
    ).toBe(true);
  });
});
