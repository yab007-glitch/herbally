import { describe, it, expect } from "vitest";
import { matchGuidesForHerb } from "../match-herb-guides";

describe("matchGuidesForHerb", () => {
  it("matches blood thinners, surgery, and LiverTox guides for warfarin/LiverTox herbs", () => {
    const guides = matchGuidesForHerb({
      slug: "turmeric",
      interactions: [{ drug_name: "Warfarin (Coumadin)" }],
      sources: [{ source: "LiverTox" }],
    });
    const slugs = guides.map((g) => g.slug);
    expect(slugs).toContain("herbs-and-blood-thinners");
    expect(slugs).toContain("herbs-to-stop-before-surgery");
    expect(slugs).toContain("liver-safety-and-herbal-supplements");
    expect(guides).toHaveLength(3);
  });

  it("matches pregnancy and Health Canada guides when unsafe in pregnancy with LNHPD record", () => {
    const guides = matchGuidesForHerb({
      slug: "barosma-betulina",
      interactions: [{ drug_name: "Lithium" }],
      sources: [],
      pregnancySafe: false,
      hasRegulatory: true,
    });
    const slugs = guides.map((g) => g.slug);
    expect(slugs).toContain("pregnancy-and-herbal-teas");
    expect(slugs).toContain("how-to-read-health-canada-npn");
  });

  it("falls back to core interaction/evidence guides when no specialized trigger hits", () => {
    const guides = matchGuidesForHerb({
      slug: "chamomile",
      interactions: [],
      sources: [],
    });
    const slugs = guides.map((g) => g.slug);
    expect(slugs).toContain("how-to-read-herb-evidence");
    expect(guides.length).toBeGreaterThanOrEqual(1);
    expect(guides.length).toBeLessThanOrEqual(3);
  });
});
