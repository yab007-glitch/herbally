import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RegulatoryEvidenceSection,
  formatDoseText,
  isCrossContaminatedRisk,
  isGarbageOrHomeopathicDose,
  isPediatricOnlyOrTaggedDose,
  stripPediatricDosageSentences,
  type RegulatoryEvidence,
} from "../regulatory-evidence";

const makeEvidence = (
  overrides: Partial<RegulatoryEvidence> = {}
): RegulatoryEvidence => ({
  herb_slug: "chamomile",
  source: "Health Canada LNHPD",
  source_licence: "Open Government Licence – Canada",
  purposes: ["Used in Herbal Medicine to help relieve mild digestive upset."],
  doses: [{ text: "1-2 g tea three times daily", population: "Adults" }],
  risks: ["Stop use if hypersensitivity/allergy occurs."],
  products_sampled: 3,
  source_urls: ["https://health-products.canada.ca/lnhpd-bdpsnh/"],
  retrieved_at: "2026-11-22T00:00:00Z",
  ...overrides,
});

describe("regulatory-evidence hygiene helpers", () => {
  it("filters placeholder TBA doses, zero-only doses, and homeopathic units when homeopathic", () => {
    expect(
      isGarbageOrHomeopathicDose({ text: "Quantity Unit TBA" }, false)
    ).toBe(true);
    expect(
      isGarbageOrHomeopathicDose(
        { text: "2 capsules", population: "Sub Pop to be created" },
        false
      )
    ).toBe(true);
    expect(isGarbageOrHomeopathicDose({ text: "0 Oil" }, false)).toBe(true);
    expect(
      isGarbageOrHomeopathicDose({ text: "3–5 globule 3× daily" }, true)
    ).toBe(true);
    expect(
      isGarbageOrHomeopathicDose({ text: "300 mg twice daily" }, false)
    ).toBe(false);
  });

  it("formats zero-lower-bound ranges cleanly in EN and FR", () => {
    expect(formatDoseText("0–2 capsules daily", "en")).toBe(
      "up to 2 capsules daily"
    );
    expect(formatDoseText("0-2 capsules", "fr")).toBe("jusqu'à 2 capsules");
  });

  it("filters pediatric doses including age_minimum=0, EN/FR tokens, and dosage sentences while preserving organ-toxicity and child-poisoning warnings", () => {
    expect(
      isPediatricOnlyOrTaggedDose({ text: "Take 1 drop", age_minimum: 0 })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({ text: "Newborn / toddler tea: 5 ml" })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({ text: "Moins de 18 ans : 2 ml" })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({ text: "1 cup daily", age_minimum: 18 })
    ).toBe(false);
    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg daily. Pediatric dosage for children 6-12 years: 200 mg twice daily."
      )
    ).toBe("Adults: 500 mg daily.");

    expect(
      isCrossContaminatedRisk(
        "ashwagandha",
        "Rare cases of liver injury associated with green tea extract."
      )
    ).toBe(true);
    expect(
      isCrossContaminatedRisk(
        "green-tea",
        "Rare cases of liver injury associated with green tea extract."
      )
    ).toBe(false);
    expect(
      isCrossContaminatedRisk(
        "dandelion",
        "Rare cases of liver injury with dark urine and jaundice; discontinue and consult a clinician."
      )
    ).toBe(false);
    expect(
      isCrossContaminatedRisk(
        "ginger",
        "May cause choking if swallowed without sufficient water (psyllium)."
      )
    ).toBe(true);
    expect(
      isCrossContaminatedRisk(
        "dandelion",
        "There is enough drug in this package to seriously harm a child."
      )
    ).toBe(false);
  });
});

describe("RegulatoryEvidenceSection", () => {
  it("withholds LNHPD homeopathic doses and claims when isDangerous is true", () => {
    const ev = makeEvidence({
      herb_slug: "atropa-belladonna-herb",
      purposes: ["Relief of occasional fever symptoms (homeopathic dilution)"],
      doses: [{ text: "5 globules 3x daily", population: "Children" }],
    });

    render(<RegulatoryEvidenceSection evidence={ev} locale="en" isDangerous />);

    expect(
      screen.getByText(/ultra-diluted homeopathic preparations/i)
    ).toBeDefined();
    expect(screen.queryByText(/5 globules/)).toBeNull();
    expect(screen.queryByText(/occasional fever/)).toBeNull();
  });

  it("filters pediatric text, TBA, zero-only, and cross-contaminated risks from rendered output", () => {
    const ev = makeEvidence({
      herb_slug: "serrapeptase",
      doses: [
        { text: "Quantity Unit TBA" },
        { text: "0 Oil", population: "Sub Pop to be created" },
        { text: "1 teaspoon for children 2–5 years" },
        { text: "0–2 capsules daily", population: "Adults" },
      ],
      risks: [
        "Rare cases of liver injury associated with green tea extract-containing products.",
        "There is enough drug in this package to seriously harm a child.",
        "Stop use if hypersensitivity occurs.",
      ],
    });

    render(<RegulatoryEvidenceSection evidence={ev} locale="en" />);

    expect(screen.queryByText(/Quantity Unit TBA/)).toBeNull();
    expect(screen.queryByText(/0 Oil/)).toBeNull();
    expect(screen.queryByText(/for children/)).toBeNull();
    expect(screen.queryByText(/green tea extract/i)).toBeNull();
    // Genuine child-poisoning warnings must be preserved, not stripped.
    expect(screen.getByText(/seriously harm a child/i)).toBeDefined();
    expect(screen.getByText(/up to 2 capsules daily/)).toBeDefined();
    expect(
      screen.getByText(/Stop use if hypersensitivity occurs/)
    ).toBeDefined();
  });

  it("preserves adult-inclusive dosing while removing pediatric-only entries and 18-month ages", () => {
    expect(
      isPediatricOnlyOrTaggedDose({
        text: "2–4 g daily",
        population: "Adults and children 12+",
      })
    ).toBe(false);
    expect(
      isPediatricOnlyOrTaggedDose({
        text: "18 months: 5 ml",
      })
    ).toBe(true);
    expect(
      stripPediatricDosageSentences(
        "Adults: 2 g daily. For children 18 months: 2 ml. Keep out of reach of children."
      )
    ).toBe("Adults: 2 g daily. Keep out of reach of children.");
  });

  it("retains sanitized adult doses for non-dangerous calculator-blocked herbs such as senna-leaf and calendula", () => {
    const ev = makeEvidence({
      herb_slug: "senna-leaf",
      purposes: ["Short-term relief of occasional constipation"],
      doses: [
        { text: "15–30 mg sennosides at bedtime", population: "Adults" },
        { text: "Children 2-11 years: 7.5 mg", population: "Children" },
      ],
    });

    render(
      <RegulatoryEvidenceSection
        evidence={ev}
        locale="en"
        isDangerous={false}
      />
    );
    expect(screen.getByText(/15–30 mg sennosides at bedtime/)).toBeDefined();
    expect(screen.queryByText(/7\.5 mg/)).toBeNull();
  });

  it("preserves adult-inclusive senna/fennel/pelargonium prose while stripping adolescent/child clauses and mixed warning+dose prescriptions", () => {
    const sennaEn =
      "Adults and adolescents over 12 years: herbal tea or preparation equivalent to 10–30 mg hydroxyanthracene derivatives (calculated as sennoside B) once daily at night; use lowest effective dose. Contraindicated under 12 years.";
    const cleanedSennaEn = stripPediatricDosageSentences(sennaEn);
    expect(cleanedSennaEn).toContain("10–30 mg");
    expect(cleanedSennaEn).toContain("Contraindicated under 12 years.");
    expect(cleanedSennaEn).not.toMatch(/adolescents over 12/i);

    const aloeEn =
      "Stimulant laxative (adults and adolescents over 12 years): standardized preparation equivalent to 10–30 mg hydroxyanthracene derivatives (calculated as aloin) once daily at night; use lowest effective dose short-term. Contraindicated under 12 years.";
    const cleanedAloeEn = stripPediatricDosageSentences(aloeEn);
    expect(cleanedAloeEn).toContain("Stimulant laxative (adults):");
    expect(cleanedAloeEn).toContain("10–30 mg");
    expect(cleanedAloeEn).not.toMatch(/adolescents over 12/i);

    const pelargoniumEn =
      "Dry extract corresponding to ~20 mg (or 1.5 ml liquid extract / tincture, e.g., EPs 7630) up to 3 times daily for adults and adolescents over 12 years.";
    const cleanedPelargonium = stripPediatricDosageSentences(pelargoniumEn);
    expect(cleanedPelargonium).toContain("~20 mg");
    expect(cleanedPelargonium).not.toMatch(/adolescents over 12/i);

    const fennelEn =
      "Adults and adolescents: 1.5 g crushed fennel fruit in 250 ml boiling water (steep 15 minutes) 3 times daily (4.5 g/day); children 4–12 years: 1.0 g in 100 ml boiling water 3 times daily (3.0 g/day).";
    const cleanedFennelEn = stripPediatricDosageSentences(fennelEn);
    expect(cleanedFennelEn).toContain("1.5 g crushed fennel fruit");
    expect(cleanedFennelEn).toContain("4.5 g/day");
    expect(cleanedFennelEn).not.toContain("1.0 g");
    expect(cleanedFennelEn).not.toMatch(/children 4–12/i);

    const fennelFr =
      "Adultes et adolescents : 1,5 g de fruits de fenouil dans 250 ml d'eau bouillante (infuser 15 min) 3 fois par jour (4,5 g/jour) ; enfants de 4 à 12 ans : 1,0 g dans 100 ml d'eau bouillante 3 fois par jour (3,0 g/jour).";
    const cleanedFennelFr = stripPediatricDosageSentences(fennelFr);
    expect(cleanedFennelFr).toContain("1,5 g de fruits de fenouil");
    expect(cleanedFennelFr).not.toContain("1,0 g");
    expect(cleanedFennelFr).not.toMatch(/enfants de 4/i);

    const sennaFr =
      "Selon les indications, elle peut être utilisée à court terme chez les adolescents de 12 à 17 ans et les adultes de 18 ans et plus.";
    const cleanedSennaFr = stripPediatricDosageSentences(sennaFr);
    expect(cleanedSennaFr).toContain("adultes de 18 ans et plus");
    expect(cleanedSennaFr).not.toMatch(/adolescents de 12/i);

    // Mixed warning + prescriptive pediatric dose MUST NOT keep the dose
    const mixedSemicolon = stripPediatricDosageSentences(
      "Give a 5-year-old 250 mg; toxic in overdose."
    );
    expect(mixedSemicolon).not.toContain("250 mg");
    expect(mixedSemicolon).toContain("toxic in overdose");

    const mixedComma = stripPediatricDosageSentences(
      "Give a 5-year-old 250 mg, toxic in overdose."
    );
    expect(mixedComma).not.toContain("250 mg");

    // Genuine warning mentioning child quantity stays intact
    expect(
      stripPediatricDosageSentences(
        "Children who ingest 5 g may develop allergic reactions."
      )
    ).toContain("Children who ingest 5 g");
    expect(
      stripPediatricDosageSentences("Never give 5 ml to a child.")
    ).toContain("Never give 5 ml to a child.");

    const followOnDose = stripPediatricDosageSentences(
      "Never give children 5 ml; give 10 ml."
    );
    expect(followOnDose).toContain("Never give children 5 ml");
    expect(followOnDose).not.toContain("10 ml");

    const switchToAdult = stripPediatricDosageSentences(
      "Never give children 5 ml; adults take 10 ml."
    );
    expect(switchToAdult).toContain("Never give children 5 ml");
    expect(switchToAdult).toContain("adults take 10 ml");
  });

  it("enforces the 18-year pediatric boundary (strips 6-18, 0-18, under-18 while preserving adults 18+/18 years and older and numeric mg ranges)", () => {
    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg daily. Children 6-18 years: 100 mg daily."
      )
    ).toBe("Adults: 500 mg daily.");

    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg daily. Under 18 years: 100 mg daily."
      )
    ).toBe("Adults: 500 mg daily.");

    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg daily. Under-18: 100 mg daily."
      )
    ).toBe("Adults: 500 mg daily.");

    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg daily. 0-18 years: 50 mg daily."
      )
    ).toBe("Adults: 500 mg daily.");

    expect(
      stripPediatricDosageSentences("Adults: 500 mg daily. 0-18: 50 mg daily.")
    ).toBe("Adults: 500 mg daily.");

    expect(
      stripPediatricDosageSentences(
        "Adultes : 500 mg par jour. De 6 à 18 ans : 100 mg par jour."
      )
    ).toBe("Adultes : 500 mg par jour.");

    expect(
      stripPediatricDosageSentences(
        "Adultes : 500 mg par jour. Moins de 18 ans : 100 mg."
      )
    ).toBe("Adultes : 500 mg par jour.");

    expect(
      stripPediatricDosageSentences("Adults 18 years and older: 500 mg daily.")
    ).toBe("Adults 18 years and older: 500 mg daily.");

    expect(stripPediatricDosageSentences("Adults (18+): 500 mg daily.")).toBe(
      "Adults (18+): 500 mg daily."
    );

    expect(stripPediatricDosageSentences("18+ years: 500 mg daily.")).toBe(
      "18+ years: 500 mg daily."
    );

    expect(
      stripPediatricDosageSentences("Adultes de 18 ans et plus : 500 mg.")
    ).toBe("Adultes de 18 ans et plus : 500 mg.");

    // Dose range "6-18 mg" must not be misclassified as an age range
    expect(stripPediatricDosageSentences("Take 6-18 mg daily.")).toBe(
      "Take 6-18 mg daily."
    );

    expect(
      isPediatricOnlyOrTaggedDose({ population: "0-18", text: "100 mg daily" })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "Children 6-18 years",
        text: "100 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "Under-18",
        text: "100 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "Adults 18 years and older",
        age_minimum: 18,
        text: "500 mg daily",
      })
    ).toBe(false);
    expect(
      isPediatricOnlyOrTaggedDose({
        text: "18+: 500 mg daily",
      })
    ).toBe(false);

    // Combined adult+under-18 cleanup & boundary phrases
    expect(
      stripPediatricDosageSentences(
        "Adults and adolescents 12 years and older: 15-30 mg daily."
      )
    ).toBe("Adults: 15-30 mg daily.");

    expect(
      stripPediatricDosageSentences(
        "Adults and children 6-18 years: 100 mg daily."
      )
    ).toBe("Adults: 100 mg daily.");

    expect(
      stripPediatricDosageSentences("Adults 12-18 years: 200 mg daily.")
    ).toBe("");

    expect(stripPediatricDosageSentences("Adults (12-18): 200 mg daily.")).toBe(
      ""
    );

    expect(
      stripPediatricDosageSentences("Adults up to 18: 100 mg daily.")
    ).toBe("");

    expect(
      stripPediatricDosageSentences("Adults 18 and under: 100 mg daily.")
    ).toBe("");

    expect(
      stripPediatricDosageSentences("Adults 18 or younger: 100 mg daily.")
    ).toBe("");

    expect(stripPediatricDosageSentences("Adults ≤18: 100 mg daily.")).toBe("");

    expect(stripPediatricDosageSentences("Up to 18: 100 mg daily.")).toBe("");
    expect(stripPediatricDosageSentences("18 and under: 100 mg daily.")).toBe(
      ""
    );
    expect(stripPediatricDosageSentences("18 or younger: 100 mg daily.")).toBe(
      ""
    );
    expect(stripPediatricDosageSentences("≤18: 100 mg daily.")).toBe("");

    expect(
      stripPediatricDosageSentences(
        "Adults 18+ (not studied in 6-18 years): 500 mg daily."
      )
    ).toBe("Adults 18+ (not studied in 6-18 years): 500 mg daily.");

    expect(stripPediatricDosageSentences("Adults over 18: 500 mg daily.")).toBe(
      "Adults over 18: 500 mg daily."
    );

    expect(
      stripPediatricDosageSentences("Adults: take up to 18 mg daily.")
    ).toBe("Adults: take up to 18 mg daily.");

    expect(
      isPediatricOnlyOrTaggedDose({
        population: "Adults 12-18 years",
        text: "200 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "Up to 18",
        text: "100 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "18 and under",
        text: "100 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "18 or younger",
        text: "100 mg daily",
      })
    ).toBe(true);
    expect(
      isPediatricOnlyOrTaggedDose({
        population: "≤18",
        text: "100 mg daily",
      })
    ).toBe(true);
  });

  it("preserves non-dose childSafety and minorSideEffects warning phrasing while still stripping prescriptive pediatric/minor doses and keeping adult dosing", () => {
    expect(
      stripPediatricDosageSentences("Children should not take this product.")
    ).toBe("Children should not take this product.");
    expect(
      stripPediatricDosageSentences("Children must not take this product.")
    ).toBe("Children must not take this product.");
    expect(
      stripPediatricDosageSentences("Not for use in children under 12 years.")
    ).toBe("Not for use in children under 12 years.");
    expect(
      stripPediatricDosageSentences("Not suitable for children or adolescents.")
    ).toBe("Not suitable for children or adolescents.");
    expect(stripPediatricDosageSentences("Do not use in children.")).toBe(
      "Do not use in children."
    );
    expect(stripPediatricDosageSentences("Do not take in children.")).toBe(
      "Do not take in children."
    );
    expect(
      stripPediatricDosageSentences(
        "Les enfants ne doivent pas prendre ce produit."
      )
    ).toBe("Les enfants ne doivent pas prendre ce produit.");
    expect(stripPediatricDosageSentences("Ne convient pas aux enfants.")).toBe(
      "Ne convient pas aux enfants."
    );

    expect(
      stripPediatricDosageSentences(
        "Minor side effects: mild nausea if you take on an empty stomach."
      )
    ).toBe("Minor side effects: mild nausea if you take on an empty stomach.");
    expect(
      stripPediatricDosageSentences(
        "Minor side effects: mild stomach upset; children should not take this product."
      )
    ).toBe(
      "Minor side effects: mild stomach upset; children should not take this product."
    );

    expect(
      stripPediatricDosageSentences(
        "Children should not take this product. Children 6-12 years: 100 mg daily."
      )
    ).toBe("Children should not take this product.");

    const negatedThenPrescriptive = stripPediatricDosageSentences(
      "Children should not take 100 mg; give 50 mg instead."
    );
    expect(negatedThenPrescriptive).toContain(
      "Children should not take 100 mg"
    );
    expect(negatedThenPrescriptive).not.toContain("50 mg");

    expect(stripPediatricDosageSentences("Give a minor 50 mg daily.")).toBe("");
    expect(stripPediatricDosageSentences("Minors: 50 mg daily.")).toBe("");

    expect(
      stripPediatricDosageSentences(
        "Adults: 500 mg twice daily. Children should not take this product."
      )
    ).toBe(
      "Adults: 500 mg twice daily. Children should not take this product."
    );
  });
});
