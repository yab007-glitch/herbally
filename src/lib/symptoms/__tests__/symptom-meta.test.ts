import { describe, it, expect } from "vitest";
import {
  SYMPTOM_SLUGS,
  symptomMatchKeyword,
  symptomMeta,
  symptomQueryKeywords,
} from "../symptom-meta";

describe("symptom meta", () => {
  it("defines non-empty db and fr keywords for every slug", () => {
    for (const slug of SYMPTOM_SLUGS) {
      const meta = symptomMeta[slug];
      expect(meta.dbKeyword.length).toBeGreaterThan(0);
      expect(meta.frKeyword.length).toBeGreaterThan(0);
    }
  });

  it("returns the French keyword on French pages", () => {
    expect(symptomMatchKeyword("anxiety", "fr")).toBe("anxiété");
  });

  it("returns the database keyword on English pages", () => {
    expect(symptomMatchKeyword("anxiety", "en")).toBe("anxiety");
  });

  it("shows a readable phrase, not the database slug shape", () => {
    // dbKeyword is "blood-pressure" for the Supabase overlap query; the page
    // must not print that hyphenated form as if it were a word.
    expect(symptomMatchKeyword("bloodPressure", "en")).toBe("blood pressure");
    expect(symptomMatchKeyword("bloodPressure", "fr")).toBe(
      "tension artérielle"
    );
  });

  it("falls back to the slug for an unknown symptom", () => {
    expect(symptomMatchKeyword("unknown", "fr")).toBe("unknown");
  });
});

describe("symptomQueryKeywords", () => {
  it("includes the stored plain-word form of hyphenated display keys", () => {
    expect(symptomQueryKeywords("bloodPressure")).toContain("blood pressure");
    expect(symptomQueryKeywords("diabetes")).toContain("diabetes");
    expect(symptomQueryKeywords("diabetes")).toContain("blood sugar");
  });

  it("matches every hub on at least one stored keyword", () => {
    for (const slug of SYMPTOM_SLUGS) {
      expect(symptomQueryKeywords(slug).length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unknown hub", () => {
    expect(symptomQueryKeywords("unknown")).toEqual([]);
  });
});
