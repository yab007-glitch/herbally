import { describe, it, expect } from "vitest";
import { pairTitle, TITLE_MAX, TITLE_SUFFIX } from "./pair-title";

const rendered = (t: string) => t + TITLE_SUFFIX;

describe("pairTitle", () => {
  it("keeps the rendered title within 60 characters for a typical pair", () => {
    const title = pairTitle("Turmeric", "Sulfasalazine", false);
    expect(rendered(title).length).toBeLessThanOrEqual(60);
    expect(title).toContain("Turmeric");
    expect(title).toContain("Sulfasalazine");
  });

  it("drops the long suffix rather than the pair names", () => {
    const title = pairTitle("Ginger", "Warfarin (Coumadin)", false);
    expect(rendered(title).length).toBeLessThanOrEqual(60);
    expect(title).toBe("Ginger & Warfarin (Coumadin) Interaction");
  });

  it("falls back to the shortest candidate for very long names", () => {
    const title = pairTitle(
      "St. John's Wort Extract",
      "Sertraline Hydrochloride (Zoloft)",
      false
    );
    expect(title).toBe(
      "St. John's Wort Extract & Sertraline Hydrochloride (Zoloft) Interaction"
    );
  });

  it("uses the French suffix and shorter fallbacks in French", () => {
    const title = pairTitle("Gingembre", "Warfarin (Coumadin)", true);
    expect(title).toBe("Gingembre et Warfarin (Coumadin) : interaction");
    expect(rendered(title).length).toBeLessThanOrEqual(60);
  });

  it("budgets for the template suffix, not the bare 60", () => {
    expect(TITLE_MAX).toBe(60 - TITLE_SUFFIX.length);
    expect(pairTitle("A", "B", false).length).toBeLessThanOrEqual(TITLE_MAX);
  });
});
