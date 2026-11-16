import { describe, it, expect } from "vitest";
import {
  fitTitle,
  fitsWithSuffix,
  SITE_SUFFIX,
  RENDERED_TITLE_MAX,
} from "./fit-title";

describe("fitTitle", () => {
  it("keeps a short title as a plain string so the template adds the brand", () => {
    expect(fitTitle(["Herbs for Sleep & Insomnia"])).toBe(
      "Herbs for Sleep & Insomnia"
    );
  });

  it("prefers a candidate that fits with the suffix", () => {
    const long = "Turmeric and Sulfasalazine: Interaction, Severity & Safety";
    const short = "Turmeric & Sulfasalazine: Interaction";
    expect(fitsWithSuffix(short)).toBe(true);
    expect(fitTitle([long, short])).toBe(short);
  });

  it("renders absolute when the only fitting candidate needs the whole 60", () => {
    const title = "Herbal Dosage Calculator: Adult Reference Doses by Weight";
    expect(title.length).toBeLessThanOrEqual(RENDERED_TITLE_MAX);
    expect(fitsWithSuffix(title)).toBe(false);
    expect(fitTitle([title])).toEqual({ absolute: title });
  });

  it("falls back to the shortest candidate when nothing fits", () => {
    const longest = "A".repeat(80);
    const shortest = "A".repeat(55);
    expect(fitTitle([longest, shortest])).toEqual({ absolute: shortest });
  });

  it("never returns something the template could push past 60", () => {
    const result = fitTitle([
      "Ginger (Zingiber officinale): Benefits & Safety",
    ]);
    const rendered =
      typeof result === "string"
        ? result.length + SITE_SUFFIX.length
        : (result as { absolute: string }).absolute.length;
    expect(rendered).toBeLessThanOrEqual(RENDERED_TITLE_MAX);
  });
});
