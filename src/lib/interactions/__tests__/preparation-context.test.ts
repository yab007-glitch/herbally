import { describe, expect, it } from "vitest";
import {
  classifyEvidenceBucket,
  countEvidenceBuckets,
  getInteractionPreparationContext,
  sanitizeContradictoryEvidenceNote,
} from "../preparation-context";

describe("interaction preparation context and evidence buckets", () => {
  it("distinguishes culinary/food amounts from concentrated extracts on culinary herbs", () => {
    const ginger = getInteractionPreparationContext("ginger", false);
    expect(ginger.shortLabel).toContain("Dietary");
    expect(ginger.detail).toContain("culinary");

    const kava = getInteractionPreparationContext("kava", false);
    expect(kava.shortLabel).toContain("preparation");
  });

  it("counts evidence certainty buckets cleanly", () => {
    const counts = countEvidenceBuckets([
      { evidenceLevel: "well-documented" },
      { evidenceLevel: "moderate-evidence" },
      { evidenceLevel: "limited-evidence" },
      { evidenceLevel: "unknown" },
    ]);
    expect(counts).toEqual({
      human_clinical: 1,
      limited_or_case: 1,
      preclinical_or_theoretical: 1,
      unclassified: 1,
    });
    expect(classifyEvidenceBucket("theoretical")).toBe(
      "preclinical_or_theoretical"
    );
  });

  it("strips contradictory downgrade sentences on severe/moderate interactions while preserving valid context", () => {
    const cleaned = sanitizeContradictoryEvidenceNote(
      "Trial showed no significant PK/PD shift in healthy subjects. Grade lowered from moderate to mild.",
      "severe"
    );
    expect(cleaned).toBe(
      "Trial showed no significant PK/PD shift in healthy subjects."
    );
    expect(
      sanitizeContradictoryEvidenceNote(
        "Grade lowered from moderate to mild.",
        "mild"
      )
    ).toBe("Grade lowered from moderate to mild.");
  });
});
