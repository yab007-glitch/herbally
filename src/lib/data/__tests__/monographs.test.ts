import { describe, it, expect } from "vitest";
import { monographs, getMonograph, type Monograph } from "../monographs";

describe("monographs", () => {
  describe("getMonograph", () => {
    it("returns a monograph for a known slug", () => {
      const turmeric = getMonograph("turmeric");
      expect(turmeric).not.toBeNull();
      expect(turmeric?.slug).toBe("turmeric");
      expect(turmeric?.summary).toBeTruthy();
      expect(turmeric?.mechanism).toBeTruthy();
    });

    it("returns null for an unknown slug", () => {
      expect(getMonograph("nonexistent-herb-12345")).toBeNull();
    });

    it("returns null for an empty slug", () => {
      expect(getMonograph("")).toBeNull();
    });
  });

  describe("monographs data integrity", () => {
    const slugs = Object.keys(monographs);

    it("has monographs for expected herbs", () => {
      expect(slugs.length).toBeGreaterThanOrEqual(7);
      expect(slugs).toContain("turmeric");
      expect(slugs).toContain("ginger");
      expect(slugs).toContain("ashwagandha");
      expect(slugs).toContain("garlic");
      expect(slugs).toContain("ginkgo");
    });

    it("each monograph has required fields", () => {
      for (const slug of slugs) {
        const m = monographs[slug] as Monograph;
        expect(m.slug).toBe(slug);
        expect(typeof m.summary).toBe("string");
        expect(m.summary.length).toBeGreaterThan(20);
        expect(typeof m.mechanism).toBe("string");
        expect(m.mechanism.length).toBeGreaterThan(10);
        expect(Array.isArray(m.claims)).toBe(true);
        expect(m.claims.length).toBeGreaterThan(0);
        expect(Array.isArray(m.safetyNotes)).toBe(true);
        expect(Array.isArray(m.drugInteractions)).toBe(true);
        expect(["safe", "caution", "unsafe", "insufficient"]).toContain(
          m.pregnancyCategory
        );
        expect(Array.isArray(m.keyCitations)).toBe(true);
      }
    });

    it("each claim has valid evidence level", () => {
      const validEvidence = ["A", "B", "C", "D", "trad"];
      for (const slug of slugs) {
        const m = monographs[slug] as Monograph;
        for (const claim of m.claims) {
          expect(validEvidence).toContain(claim.evidence);
          expect(typeof claim.claim).toBe("string");
          expect(claim.claim.length).toBeGreaterThan(3);
        }
      }
    });

    it("each drug interaction has valid severity", () => {
      const validSeverity = ["mild", "moderate", "severe", "contraindicated"];
      for (const slug of slugs) {
        const m = monographs[slug] as Monograph;
        for (const ix of m.drugInteractions) {
          expect(validSeverity).toContain(ix.severity);
          expect(typeof ix.drug).toBe("string");
          expect(typeof ix.detail).toBe("string");
        }
      }
    });

    it("each citation has source and title", () => {
      for (const slug of slugs) {
        const m = monographs[slug] as Monograph;
        for (const cite of m.keyCitations) {
          expect(typeof cite.source).toBe("string");
          expect(typeof cite.title).toBe("string");
          expect(cite.source.length).toBeGreaterThan(0);
          expect(cite.title.length).toBeGreaterThan(0);
        }
      }
    });
  });
});