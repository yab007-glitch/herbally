import { describe, it, expect } from "vitest";
import { matchInteractionPair, drugInputSlug } from "../check";

const pairs = [
  { drugName: "Warfarin (Coumadin)", drugSlug: "warfarin" },
  { drugName: "Antidepressants (SSRIs)", drugSlug: "antidepressants" },
  { drugName: "Aspirin", drugSlug: "aspirin" },
  { drugName: "Clopidogrel (Plavix)", drugSlug: "clopidogrel" },
];

describe("drugInputSlug", () => {
  it("slugifies free text the same way pair URLs do", () => {
    expect(drugInputSlug("Warfarin")).toBe("warfarin");
    expect(drugInputSlug("blood thinners like warfarin")).toBe(
      "blood-thinners-like-warfarin"
    );
  });
});

describe("matchInteractionPair", () => {
  it("matches an exact generic name, case-insensitively", () => {
    expect(matchInteractionPair("warfarin", pairs)?.drugName).toBe(
      "Warfarin (Coumadin)"
    );
    expect(matchInteractionPair("WARFARIN", pairs)?.drugName).toBe(
      "Warfarin (Coumadin)"
    );
  });

  it("matches a whole token inside a longer phrase", () => {
    expect(
      matchInteractionPair("blood thinners like warfarin", pairs)?.drugName
    ).toBe("Warfarin (Coumadin)");
    expect(
      matchInteractionPair("SSRI antidepressants", pairs)?.drugName
    ).toBe("Antidepressants (SSRIs)");
  });

  it("matches a class name typed with extra words", () => {
    expect(
      matchInteractionPair("ssri-antidepressants", pairs)?.drugName
    ).toBe("Antidepressants (SSRIs)");
  });

  it("returns null for an unknown drug — never a guess", () => {
    expect(matchInteractionPair("metformin", pairs)).toBeNull();
    expect(matchInteractionPair("some made-up drug", pairs)).toBeNull();
  });

  it("returns null for empty input or an empty pair list", () => {
    expect(matchInteractionPair("", pairs)).toBeNull();
    expect(matchInteractionPair("warfarin", [])).toBeNull();
  });

  it("matches singular/plural forms of a class name", () => {
    expect(matchInteractionPair("antidepressant", pairs)?.drugName).toBe(
      "Antidepressants (SSRIs)"
    );
  });

  it("does not match on a short shared fragment", () => {
    // "asp" must not match "aspirin" via containment.
    expect(matchInteractionPair("asp", pairs)).toBeNull();
  });
});
