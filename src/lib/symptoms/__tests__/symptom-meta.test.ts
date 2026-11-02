import { describe, it, expect } from "vitest";
import {
  SYMPTOM_SLUGS,
  symptomMatchKeyword,
  symptomMeta,
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
