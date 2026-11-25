import { describe, expect, it } from "vitest";
import { matchesDrugInteraction } from "@/lib/utils/drug-match";
import {
  findCollisionsForDrug,
  findCollisionsForHerb,
  matchDrugQueryUnified,
} from "../drug-matching-unified";
import { KNOWN_UNRESOLVED_PAIR_COLLISIONS } from "@/lib/db/verify-rules";

describe("unified drug matching & class/member separation", () => {
  it("never conflates metformin with insulin", () => {
    expect(matchesDrugInteraction("metformin", "Insulin")).toBe(false);
    expect(matchesDrugInteraction("insulin", "Metformin (Glucophage)")).toBe(
      false
    );
    expect(matchesDrugInteraction("glucophage", "Insulin")).toBe(false);
    expect(matchesDrugInteraction("metformin", "Metformin (Glucophage)")).toBe(
      true
    );
    expect(matchDrugQueryUnified("metformin", "Insulin (regular)")).toBe(false);
  });

  it("matches exact generics, French names, and curated brand synonyms without class/member guesswork", () => {
    expect(matchDrugQueryUnified("Coumadin", "Anticoagulants (Warfarin)")).toBe(
      true
    );
    expect(matchDrugQueryUnified("warfarine", "Warfarin")).toBe(true);
  });

  it("exposes unresolved collision metadata across herb and drug aggregation surfaces without choosing among collisions", () => {
    expect(KNOWN_UNRESOLVED_PAIR_COLLISIONS).toHaveLength(6);

    const sageCollisions = findCollisionsForHerb("sage");
    expect(sageCollisions.length).toBeGreaterThanOrEqual(1);
    expect(sageCollisions[0].path).toBe("/interactions/sage/anticonvulsants");

    const immunosuppressantCollisions =
      findCollisionsForDrug("immunosuppressants");
    expect(immunosuppressantCollisions.length).toBe(3);
    expect(
      immunosuppressantCollisions.map(
        (c) => (c as { herbSlug?: string }).herbSlug
      )
    ).toContain("astragalus");
  });
});
