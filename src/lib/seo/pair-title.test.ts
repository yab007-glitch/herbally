import { describe, it, expect } from "vitest";
import {
  pairTitle,
  pairTitleMeta,
  TITLE_MAX,
  TITLE_SUFFIX,
} from "./pair-title";
import { renderedTitleLength } from "./fit-title";

const rendered = (t: string) => t + TITLE_SUFFIX;
const resolvedTitle = (m: ReturnType<typeof pairTitleMeta>) =>
  typeof m === "string"
    ? m + TITLE_SUFFIX
    : m && typeof m === "object" && "absolute" in m
      ? m.absolute
      : "";

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

  it("strips parenthetical brand lists before truncating", () => {
    const title = pairTitle(
      "St. John's Wort Extract",
      "Sertraline Hydrochloride (Zoloft)",
      false
    );
    expect(title).toBe("St. John's Wort Extract & Sertraline Hydrochloride");
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

  it("fits very long parenthetical drug names under 60 rendered chars in both locales", () => {
    const en = resolvedTitle(
      pairTitleMeta(
        "Red Yeast Rice",
        "Strong CYP3A4 Inhibitors (Clarithromycin, Itraconazole, Protease Inhibitors)",
        false
      )
    );
    const fr = resolvedTitle(
      pairTitleMeta(
        "Levure de riz rouge",
        "Inhibiteurs puissants du CYP3A4 (clarithromycine, itraconazole)",
        true
      )
    );
    expect(renderedTitleLength(en)).toBeLessThanOrEqual(60);
    expect(renderedTitleLength(fr)).toBeLessThanOrEqual(60);
  });
});
