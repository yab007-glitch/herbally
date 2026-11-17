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

describe("matchInteractionPair drug classes", () => {
  // St. John's Wort stores its four SSRI pairs as the individual drugs, so a
  // reader typing the class must still be told about the contraindication.
  const stJohnsWortPairs = [
    {
      drugName: "Sertraline (Zoloft)",
      drugSlug: "sertraline",
      severity: "contraindicated",
    },
    {
      drugName: "Fluoxetine (Prozac)",
      drugSlug: "fluoxetine",
      severity: "contraindicated",
    },
    {
      drugName: "Paroxetine (Paxil)",
      drugSlug: "paroxetine",
      severity: "contraindicated",
    },
    {
      drugName: "Citalopram (Celexa)",
      drugSlug: "citalopram",
      severity: "contraindicated",
    },
    {
      drugName: "Warfarin (Coumadin)",
      drugSlug: "warfarin",
      severity: "moderate",
    },
  ];

  it("resolves a class to the herb's own member rows", () => {
    const match = matchInteractionPair(
      "SSRI antidepressants",
      stJohnsWortPairs
    );
    expect(match?.severity).toBe("contraindicated");
    expect(["sertraline", "fluoxetine", "paroxetine", "citalopram"]).toContain(
      match?.drugSlug
    );
  });

  it("prefers the stored class row over its members", () => {
    const withClassRow = [
      {
        drugName: "Antidepressants (SSRIs)",
        drugSlug: "antidepressants",
        severity: "contraindicated",
      },
      ...stJohnsWortPairs,
    ];
    expect(
      matchInteractionPair("SSRI antidepressants", withClassRow)?.drugSlug
    ).toBe("antidepressants");
  });

  it("answers 'blood thinners' with the most serious thinner the herb holds", () => {
    const turmericPairs = [
      {
        drugName: "Warfarin (Coumadin)",
        drugSlug: "warfarin",
        severity: "severe",
      },
      { drugName: "Aspirin", drugSlug: "aspirin", severity: "moderate" },
      {
        drugName: "Clopidogrel (Plavix)",
        drugSlug: "clopidogrel",
        severity: "moderate",
      },
    ];
    expect(
      matchInteractionPair("blood thinners", turmericPairs)?.drugName
    ).toBe("Warfarin (Coumadin)");
    expect(matchInteractionPair("blood thinner", turmericPairs)?.drugName).toBe(
      "Warfarin (Coumadin)"
    );
  });

  it("keeps a drug the reader named above a more severe sibling", () => {
    const turmericPairs = [
      {
        drugName: "Warfarin (Coumadin)",
        drugSlug: "warfarin",
        severity: "severe",
      },
      { drugName: "Aspirin", drugSlug: "aspirin", severity: "moderate" },
    ];
    expect(matchInteractionPair("aspirin", turmericPairs)?.drugName).toBe(
      "Aspirin"
    );
  });

  it("does not invent a class member the herb does not have", () => {
    expect(matchInteractionPair("statins", stJohnsWortPairs)).toBeNull();
    expect(matchInteractionPair("antibiotics", stJohnsWortPairs)).toBeNull();
  });
});
