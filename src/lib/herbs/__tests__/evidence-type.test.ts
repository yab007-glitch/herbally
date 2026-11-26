import { describe, expect, it } from "vitest";
import { classifyStudyEvidenceType } from "../evidence-type";

describe("classifyStudyEvidenceType", () => {
  it("never classifies in-vitro or computational studies as anecdotal", () => {
    const lab = classifyStudyEvidenceType(
      "Antiproliferative activity",
      "Abrus seed extract showed cytotoxicity in HeLa cell line in vitro.",
      "D"
    );
    expect(lab.type).toBe("in_vitro_lab");
    expect(lab.labelEn).toBe("Laboratory (in vitro)");

    const silico = classifyStudyEvidenceType(
      "Target screening",
      "Molecular docking and in silico network pharmacology analysis.",
      "D"
    );
    expect(silico.type).toBe("in_silico_computational");
    expect(silico.labelEn).toBe("Computational (in silico)");
  });

  it("distinguishes animal preclinical and human clinical trials cleanly", () => {
    expect(
      classifyStudyEvidenceType(
        "Blood glucose",
        "Oral extract reduced glucose in diabetic rats.",
        "C"
      ).type
    ).toBe("preclinical_animal");

    expect(
      classifyStudyEvidenceType(
        "Osteoarthritis",
        "Randomized double-blind placebo-controlled trial showed symptom reduction.",
        "A"
      ).type
    ).toBe("human_clinical");
  });
});
