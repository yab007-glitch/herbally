import { describe, expect, it } from "vitest";
import { SUBSTANCE_MIN, isIndexable, substanceOf } from "../indexable";

describe("herb indexability", () => {
  it("counts description, recorded uses and dosage as substance", () => {
    expect(
      substanceOf({
        description: "a".repeat(200),
        traditional_uses: ["b".repeat(100), "c".repeat(50)],
        dosage_adult: "d".repeat(50),
      })
    ).toBe(400);
  });

  it("lets a published monograph or a regulator record carry a short page", () => {
    expect(substanceOf({ hasMonograph: true })).toBe(400);
    expect(substanceOf({ hasRegulatory: true })).toBe(300);
    expect(isIndexable({ hasMonograph: true })).toBe(true);
  });

  it("does not index a page below the substance line", () => {
    expect(isIndexable({ description: "a".repeat(SUBSTANCE_MIN - 1) })).toBe(
      false
    );
  });

  it("does not let views exempt a thin page", () => {
    // The counter is crawler-inflated: cay-xao-tam-phan held 1,638 views on a
    // 175-character record. Views are not an input to the rule at all.
    expect(substanceOf({ description: "a".repeat(260) })).toBeLessThan(
      SUBSTANCE_MIN
    );
    expect(isIndexable({ description: "a".repeat(260) })).toBe(false);
  });
});
