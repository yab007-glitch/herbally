import { describe, expect, it } from "vitest";
import {
  buildHerbNameAnchorFilter,
  buildHerbPreciseNameFilter,
  buildHerbTextOrFilter,
  normalizeMatchText,
} from "../normalize-query";

describe("normalizeMatchText", () => {
  it("folds punctuation and possessives so a typed name meets the stored one", () => {
    expect(normalizeMatchText("St. John's Wort")).toBe("st john wort");
    expect(normalizeMatchText("st johns wort")).toBe("st john wort");
  });

  it("folds accents and case", () => {
    expect(normalizeMatchText("Millepertuis")).toBe("millepertuis");
    expect(normalizeMatchText("ALOE VERA")).toBe("aloe vera");
    expect(normalizeMatchText("Café")).toBe("cafe");
  });

  it("drops a one-letter elided article instead of gluing it to the name", () => {
    expect(normalizeMatchText("l'ail")).toBe("ail");
  });

  it("keeps the binomial and drops the author citation", () => {
    expect(normalizeMatchText("Aloe vera (L.) Burm. f.")).toBe(
      "aloe vera burm"
    );
  });
});

describe("buildHerbPreciseNameFilter", () => {
  it("requires every typed word inside one name field", () => {
    expect(buildHerbPreciseNameFilter("milk thistle")).toBe(
      [
        "and(name.ilike.%milk%,name.ilike.%thistle%)",
        "and(scientific_name.ilike.%milk%,scientific_name.ilike.%thistle%)",
        "and(translations->fr->>name.ilike.%milk%,translations->fr->>name.ilike.%thistle%)",
      ].join(",")
    );
  });

  it("searches the folded token, so a typed plural meets a possessive", () => {
    expect(buildHerbPreciseNameFilter("st johns wort")).toContain(
      "and(name.ilike.%st%,name.ilike.%john%,name.ilike.%wort%)"
    );
  });

  it("still constrains a single-word query to the name fields", () => {
    expect(buildHerbPreciseNameFilter("ginkgo")).toContain(
      "and(name.ilike.%ginkgo%)"
    );
  });

  it("returns an empty filter for a blank query", () => {
    expect(buildHerbPreciseNameFilter("   ")).toBe("");
  });

  it("leaves the broad text filter untouched", () => {
    expect(buildHerbTextOrFilter("ginger")).toContain("name.ilike.%ginger%");
  });
});

describe("buildHerbNameAnchorFilter", () => {
  it("anchors a qualified query on the herb word, not the form word", () => {
    expect(buildHerbNameAnchorFilter("ginkgo leaf")).toBe(
      [
        "name.ilike.%ginkgo%",
        "scientific_name.ilike.%ginkgo%",
        "translations->fr->>name.ilike.%ginkgo%",
      ].join(",")
    );
  });

  it("keeps the head word when every word after it is a form word", () => {
    expect(buildHerbNameAnchorFilter("aloe vera juice")).toContain(
      "name.ilike.%aloe%"
    );
    expect(buildHerbNameAnchorFilter("aloe vera juice")).not.toContain("juice");
  });

  it("adds the longest meaningful word for phrasings that lead with a qualifier", () => {
    const filter = buildHerbNameAnchorFilter("st johns wort extract");
    expect(filter).toContain("name.ilike.%st%");
    expect(filter).toContain("name.ilike.%john%");
    expect(filter).not.toContain("extract");
  });

  it("declines to anchor a single-word query, which the precise filter already covers", () => {
    expect(buildHerbNameAnchorFilter("ginkgo")).toBe("");
  });
});
