import { describe, expect, it } from "vitest";
import {
  computeStackAlerts,
  highestSeverityOf,
  sortStackMatches,
  type StackMatchItem,
} from "../stack";

function match(overrides: Partial<StackMatchItem>): StackMatchItem {
  return {
    herbInput: "Ginger",
    herbSlug: "ginger",
    herbName: "Ginger",
    drugInput: "warfarin",
    drugName: "Warfarin (Coumadin)",
    drugSlug: "warfarin",
    severity: "moderate",
    description: "May increase bleeding risk with anticoagulants.",
    mechanism: "Additive antiplatelet activity.",
    evidenceLevel: "moderate-evidence",
    source: "NCCIH",
    sourceUrl: "https://www.nccih.nih.gov/health/ginger",
    pairUrl: "/interactions/ginger/warfarin",
    ...overrides,
  };
}

describe("stack helpers", () => {
  it("sorts matches worst severity first", () => {
    const sorted = sortStackMatches([
      match({ herbName: "Valerian", severity: "mild" }),
      match({ herbName: "St. John's Wort", severity: "contraindicated" }),
      match({ herbName: "Garlic", severity: "severe" }),
    ]);
    expect(sorted.map((m) => m.severity)).toEqual([
      "contraindicated",
      "severe",
      "mild",
    ]);
    expect(highestSeverityOf(sorted)).toBe("contraindicated");
  });

  it("flags cumulative bleeding risk across two or more distinct herbs", () => {
    const alerts = computeStackAlerts(
      [
        match({ herbName: "Garlic", herbSlug: "garlic" }),
        match({ herbName: "Ginkgo", herbSlug: "ginkgo-biloba" }),
      ],
      "en"
    );
    expect(alerts.some((a) => a.code === "bleeding_overlap")).toBe(true);
  });

  it("localizes alerts into French when locale is fr", () => {
    const alerts = computeStackAlerts(
      [
        match({
          herbName: "Valériane",
          description: "Risque de sédation additive.",
          mechanism: "Potentiation GABAergique du système nerveux central.",
          drugName: "Lorazépam",
        }),
        match({
          herbName: "Kava",
          description: "Augmente la somnolence et la dépression du SNC.",
          mechanism: "Effets dépresseurs cumulatifs sur le SNC.",
          drugName: "Alprazolam",
        }),
      ],
      "fr"
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].code).toBe("sedation_overlap");
    expect(alerts[0].title).toContain("Sédation");
  });
});
