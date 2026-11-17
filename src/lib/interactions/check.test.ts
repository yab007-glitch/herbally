import { describe, expect, it } from "vitest";
import { drugInputSlug, matchInteractionPair } from "./check";

const pairs = [
  { drugName: "Warfarin (Coumadin)", drugSlug: "warfarin" },
  { drugName: "Fluoxetine (Prozac)", drugSlug: "fluoxetine" },
  { drugName: "Antidepressants (SSRIs)", drugSlug: "antidepressants" },
  { drugName: "Ibuprofen (Advil)", drugSlug: "ibuprofen" },
  { drugName: "Levothyroxine (Synthroid)", drugSlug: "levothyroxine" },
  { drugName: "Immunosuppressants (general)", drugSlug: "immunosuppressants" },
];

describe("matchInteractionPair bilingual support", () => {
  it("strips diacritics when slugifying French drug names", () => {
    expect(drugInputSlug("fluoxétine")).toBe("fluoxetine");
    expect(drugInputSlug("lévothyroxine")).toBe("levothyroxine");
    expect(drugInputSlug("ibuprofène")).toBe("ibuprofene");
  });

  it("matches accented and French medication terms", () => {
    expect(matchInteractionPair("fluoxétine", pairs)?.drugSlug).toBe(
      "fluoxetine"
    );
    expect(matchInteractionPair("warfarine", pairs)?.drugSlug).toBe("warfarin");
    expect(matchInteractionPair("antidépresseurs", pairs)?.drugSlug).toBe(
      "antidepressants"
    );
    expect(matchInteractionPair("immunosuppresseurs", pairs)?.drugSlug).toBe(
      "immunosuppressants"
    );
    expect(matchInteractionPair("ibuprofène", pairs)?.drugSlug).toBe(
      "ibuprofen"
    );

    const multiDrugPairs = [
      {
        drugName: "Antidiabetic medications (Metformin, Insulin)",
        drugSlug: "antidiabetic-medications",
      },
      {
        drugName: "Anticoagulants and Antiplatelets (Warfarin, Aspirin)",
        drugSlug: "anticoagulants-and-antiplatelets",
      },
    ];
    expect(matchInteractionPair("metformine", multiDrugPairs)?.drugSlug).toBe(
      "antidiabetic-medications"
    );
    expect(matchInteractionPair("aspirine", multiDrugPairs)?.drugSlug).toBe(
      "anticoagulants-and-antiplatelets"
    );
  });
});
