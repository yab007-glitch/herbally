import { describe, it, expect } from "vitest";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import {
  fitTitle,
  fitsWithSuffix,
  renderedTitleLength,
  SITE_SUFFIX,
  RENDERED_TITLE_MAX,
} from "./fit-title";

function effectiveRenderedLength(result: ReturnType<typeof fitTitle>): number {
  const raw =
    typeof result === "string"
      ? `${result}${SITE_SUFFIX}`
      : (result as { absolute: string }).absolute;
  return renderedTitleLength(raw);
}

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

  it("keeps rendered HTML length <= 60 for long binomials while keeping the name", () => {
    const longBinomial =
      "Sophora japonica Quercetin-Phosphatidylcholine complex";
    const result1 = fitTitle([
      `${longBinomial}: Benefits, Dosage, Safety, Evidence`,
      `${longBinomial}: Benefits and Safety`,
      longBinomial,
    ]);
    expect(result1).toEqual({ absolute: longBinomial });
    expect(effectiveRenderedLength(result1)).toBeLessThanOrEqual(
      RENDERED_TITLE_MAX
    );

    const extraLongBinomial =
      "Phyllanthus emblica, Terminalia chebula, Terminalia bellirica";
    const result2 = fitTitle([
      `${extraLongBinomial}: Benefits, Dosage, Safety, Evidence`,
      `${extraLongBinomial}: Benefits and Safety`,
      extraLongBinomial,
    ]);
    const text2 = (result2 as { absolute: string }).absolute;
    expect(text2.startsWith("Phyllanthus emblica")).toBe(true);
    expect(text2.length).toBeLessThanOrEqual(RENDERED_TITLE_MAX);
    expect(effectiveRenderedLength(result2)).toBeLessThanOrEqual(
      RENDERED_TITLE_MAX
    );
  });

  it("keeps rendered HTML length <= 60 for long common names while keeping the herb name", () => {
    const longCommon =
      "Extraordinarily Long Traditional Appalachian Mountain Botanical Root";
    const sci = "Aristolochia serpentaria";
    const result = fitTitle([
      `${longCommon} (${sci}): Benefits, Dosage, Safety, Evidence`,
      `${longCommon} (${sci}): Benefits and Safety`,
      `${longCommon} (${sci})`,
      longCommon,
    ]);
    const text = (result as { absolute: string }).absolute;
    expect(text.startsWith("Extraordinarily Long Traditional")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(RENDERED_TITLE_MAX);
    expect(effectiveRenderedLength(result)).toBeLessThanOrEqual(
      RENDERED_TITLE_MAX
    );
  });

  it("accounts for HTML entity expansion on apostrophes and ampersands in EN and FR", () => {
    const cases: string[][] = [
      [
        "Cat's Claw (Uncaria tomentosa): Benefits, Dosage, Safety, Evidence",
        "Cat's Claw (Uncaria tomentosa): Benefits and Safety",
        "Cat's Claw (Uncaria tomentosa)",
        "Cat's Claw",
      ],
      [
        "Za'atar (Origanum syriacum): Benefits, Dosage, Safety, Evidence",
        "Za'atar (Origanum syriacum): Benefits and Safety",
        "Za'atar (Origanum syriacum)",
        "Za'atar",
      ],
      [
        "Ajuga remota: Benefits, Dosage, Safety, Evidence",
        "Ajuga remota: Benefits and Safety",
        "Ajuga remota",
      ],
      [
        "Mountain St. John's Wort (Hypericum montanum): Benefits, Dosage, Safety, Evidence",
        "Mountain St. John's Wort (Hypericum montanum): Benefits and Safety",
        "Mountain St. John's Wort (Hypericum montanum)",
        "Mountain St. John's Wort",
      ],
      [
        "Griffe d'ours (Arctostaphylos uva-ursi) : bienfaits, posologie et précautions",
        "Griffe d'ours (Arctostaphylos uva-ursi) : bienfaits et précautions",
        "Griffe d'ours (Arctostaphylos uva-ursi)",
        "Griffe d'ours",
      ],
    ];

    for (const candidates of cases) {
      const result = fitTitle(candidates);
      expect(effectiveRenderedLength(result)).toBeLessThanOrEqual(
        RENDERED_TITLE_MAX
      );
    }
  });

  it("keeps EN and FR homePage titles branded (with HerbAlly) and <= 60 chars", () => {
    for (const homeTitle of [enDict.meta.homeTitle, frDict.meta.homeTitle]) {
      const result = fitTitle([homeTitle]);
      expect(typeof result).toBe("string");
      expect(`${result}${SITE_SUFFIX}`).toContain("HerbAlly");
      expect(effectiveRenderedLength(result)).toBeLessThanOrEqual(
        RENDERED_TITLE_MAX
      );
    }
  });
});
