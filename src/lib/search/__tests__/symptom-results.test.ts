import { describe, it, expect } from "vitest";
import {
  dedupeSymptomResults,
  sortSymptomResultsByRelevance,
  normalizeScientificName,
  type DedupeableHerbResult,
} from "../symptom-results";

const herb = (
  overrides: Partial<DedupeableHerbResult> & { name: string }
): DedupeableHerbResult => ({
  id: overrides.id ?? "1",
  slug: "slug",
  scientific_name: null,
  evidence_level: "C",
  ...overrides,
});

describe("normalizeScientificName", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(normalizeScientificName("  Stachys   betonica. ")).toBe(
      "stachys betonica"
    );
    expect(normalizeScientificName(null)).toBeNull();
    expect(normalizeScientificName("")).toBeNull();
  });
});

describe("dedupeSymptomResults", () => {
  it("collapses the walkthrough duplicate: two names, one scientific name", () => {
    const results = dedupeSymptomResults([
      herb({
        id: "a",
        slug: "stachys-betonica",
        name: "Stachys Betonica",
        scientific_name: "Stachys betonica",
        matchedBy: "symptom",
        matchedKeywords: ["sleep"],
        matchedInputs: ["sleep"],
      }),
      herb({
        id: "b",
        slug: "lamiaceae-betony",
        name: "Lamiaceae Betony",
        scientific_name: "Stachys betonica",
        matchedBy: "symptom",
        matchedKeywords: ["anxiety"],
        matchedInputs: ["anxiety"],
      }),
    ]);
    expect(results).toHaveLength(1);
    // First (best-evidenced) row keeps the canonical slug/link.
    expect(results[0].slug).toBe("stachys-betonica");
    // Nothing is silently dropped: inputs are unioned, alias is kept.
    expect(results[0].matchedInputs).toEqual(["sleep", "anxiety"]);
    expect(results[0].aliases).toEqual(["Lamiaceae Betony"]);
  });

  it("prefers a symptom match over a name match for the merged row", () => {
    const results = dedupeSymptomResults([
      herb({
        id: "a",
        slug: "x",
        name: "Betony",
        scientific_name: "Stachys betonica",
        matchedBy: "name",
      }),
      herb({
        id: "b",
        slug: "y",
        name: "Betony",
        scientific_name: "Stachys betonica",
        matchedBy: "symptom",
      }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].matchedBy).toBe("symptom");
  });

  it("falls back to slug when no scientific name exists", () => {
    const results = dedupeSymptomResults([
      herb({ id: "a", slug: "same", name: "One", scientific_name: null }),
      herb({ id: "b", slug: "same", name: "One", scientific_name: null }),
      herb({ id: "c", slug: "other", name: "Two", scientific_name: null }),
    ]);
    expect(results.map((h) => h.id)).toEqual(["a", "c"]);
  });

  it("collapses the hand-curated betony Latin synonyms into one plant", () => {
    const results = dedupeSymptomResults([
      herb({
        id: "a",
        slug: "stachys-betonica",
        name: "Stachys Betonica",
        scientific_name: "Betonica officinalis",
        matchedBy: "symptom",
        matchedInputs: ["anxiety"],
      }),
      herb({
        id: "b",
        slug: "lamiaceae-betony",
        name: "Lamiaceae Betony",
        scientific_name: "Stachys betonica",
        matchedBy: "symptom",
        matchedInputs: ["sleep"],
      }),
      herb({
        id: "c",
        slug: "betony-third",
        name: "Betony",
        scientific_name: "Stachys officinalis",
        matchedBy: "symptom",
        matchedInputs: ["anxiety"],
      }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("stachys-betonica");
    expect(results[0].matchedInputs).toEqual(["anxiety", "sleep"]);
    expect(results[0].aliases).toEqual(["Lamiaceae Betony", "Betony"]);
  });

  it("keeps genuinely different plants separate", () => {
    const results = dedupeSymptomResults([
      herb({ id: "a", slug: "a", name: "A", scientific_name: "Stachys sylvatica" }),
      herb({ id: "b", slug: "b", name: "B", scientific_name: "Betonica officinalis" }),
    ]);
    expect(results).toHaveLength(2);
  });
});

describe("sortSymptomResultsByRelevance", () => {
  it("orders by matched inputs first, then evidence grade", () => {
    const sorted = sortSymptomResultsByRelevance([
      herb({ id: "a", name: "A", evidence_level: "A", matchedInputs: ["sleep"] }),
      herb({
        id: "b",
        name: "B",
        evidence_level: "C",
        matchedInputs: ["sleep", "anxiety"],
      }),
      herb({
        id: "c",
        name: "C",
        evidence_level: "B",
        matchedInputs: ["sleep"],
      }),
      herb({ id: "d", name: "D", evidence_level: "A", matchedInputs: [] }),
    ]);
    expect(sorted.map((h) => h.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("is stable for equal relevance and evidence", () => {
    const sorted = sortSymptomResultsByRelevance([
      herb({ id: "a", name: "A", matchedInputs: ["sleep"] }),
      herb({ id: "b", name: "B", matchedInputs: ["sleep"] }),
    ]);
    expect(sorted.map((h) => h.id)).toEqual(["a", "b"]);
  });
});
