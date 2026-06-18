import { describe, it, expect } from "vitest";
import { getComparisonHerbs, CURATED_COMPARISONS } from "../comparisons";

describe("comparisons", () => {
  const herbs = [
    {
      name: "Ginger",
      slug: "ginger",
      scientific_name: "Zingiber officinale",
      symptom_keywords: ["nausea", "digestion"],
    },
    {
      name: "Turmeric",
      slug: "turmeric",
      scientific_name: "Curcuma longa",
      symptom_keywords: ["inflammation", "pain"],
    },
    {
      name: "Chamomile",
      slug: "chamomile",
      scientific_name: "Matricaria chamomilla",
      symptom_keywords: ["anxiety", "sleep", "digestion"],
    },
    {
      name: "Valerian",
      slug: "valerian",
      scientific_name: "Valeriana officinalis",
      symptom_keywords: ["anxiety", "sleep"],
    },
    {
      name: "Ashwagandha",
      slug: "ashwagandha",
      scientific_name: "Withania somnifera",
      symptom_keywords: ["stress"],
    },
    {
      name: "Rhodiola",
      slug: "rhodiola",
      scientific_name: "Rhodiola rosea",
      symptom_keywords: ["stress", "fatigue"],
    },
    {
      name: "Garlic",
      slug: "garlic",
      scientific_name: "Allium sativum",
      symptom_keywords: ["heart", "immune"],
    },
    {
      name: "Boswellia",
      slug: "boswellia",
      scientific_name: "Boswellia serrata",
      symptom_keywords: ["inflammation", "pain"],
    },
  ];

  describe("CURATED_COMPARISONS", () => {
    it("contains curated pairings for turmeric", () => {
      expect(CURATED_COMPARISONS.turmeric).toContain("ginger");
      expect(CURATED_COMPARISONS.turmeric).toContain("boswellia");
    });

    it("contains curated pairings for ginger", () => {
      expect(CURATED_COMPARISONS.ginger).toContain("turmeric");
    });
  });

  describe("getComparisonHerbs", () => {
    it("returns curated comparisons first", () => {
      const result = getComparisonHerbs("turmeric", herbs, 3);
      expect(result.length).toBeGreaterThan(0);
      // Should include ginger from curated list
      expect(result.some((h) => h.slug === "ginger")).toBe(true);
    });

    it("returns herbs with overlapping keywords as fallback", () => {
      // Use a herb not in curated list but with symptom overlap
      const herbWithOverlap = {
        name: "Custom Herb",
        slug: "custom-herb",
        scientific_name: "Customus herbicus",
        symptom_keywords: ["inflammation"],
      };
      const allHerbs = [...herbs, herbWithOverlap];
      const result = getComparisonHerbs("custom-herb", allHerbs, 3);
      expect(result.length).toBeGreaterThan(0);
      // turmeric and boswellia both have "inflammation"
      expect(
        result.some((h) => h.slug === "turmeric" || h.slug === "boswellia")
      ).toBe(true);
    });

    it("returns empty array when no matches exist", () => {
      const isolatedHerb = {
        name: "Isolated",
        slug: "isolated",
        scientific_name: "Isolated alone",
        symptom_keywords: ["unique-symptom"],
      };
      const result = getComparisonHerbs(
        "isolated",
        [...herbs, isolatedHerb],
        3
      );
      expect(result).toEqual([]);
    });

    it("respects the limit parameter", () => {
      const result = getComparisonHerbs("turmeric", herbs, 1);
      expect(result.length).toBe(1);
    });

    it("returns empty array when herb not found in allHerbs", () => {
      const result = getComparisonHerbs("nonexistent", herbs, 3);
      expect(result).toEqual([]);
    });
  });
});
