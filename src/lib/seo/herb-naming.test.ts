import { describe, expect, it } from "vitest";
import { hasDistinctCommonName } from "./herb-naming";

describe("hasDistinctCommonName", () => {
  it("is true when the herb has a vernacular name", () => {
    expect(
      hasDistinctCommonName({
        name: "Gingembre",
        scientific_name: "Zingiber officinale",
      })
    ).toBe(true);
  });

  it("is false when the name is the binomial itself", () => {
    expect(
      hasDistinctCommonName({
        name: "Silybum marianum",
        scientific_name: "Silybum marianum",
      })
    ).toBe(false);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(
      hasDistinctCommonName({
        name: "  alpinia officinarum ",
        scientific_name: "Alpinia officinarum",
      })
    ).toBe(false);
  });

  it("treats a missing binomial as distinct rather than crashing", () => {
    expect(hasDistinctCommonName({ name: "Ail", scientific_name: "" })).toBe(
      true
    );
  });
});
