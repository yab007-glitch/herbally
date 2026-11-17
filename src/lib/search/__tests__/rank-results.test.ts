import { describe, it, expect } from "vitest";
import { rankHerbResults } from "../rank-results";

const herbs = (names: string[]) => names.map((name) => ({ name }));

describe("rankHerbResults", () => {
  it("puts the exact name match first", () => {
    const ranked = rankHerbResults(
      herbs(["Turmeric (Javanese)", "Zedoary", "Turmeric", "Curcuma mangga"]),
      "Turmeric"
    );
    expect(ranked[0].name).toBe("Turmeric");
  });

  it("prefers prefix matches over substring matches", () => {
    const ranked = rankHerbResults(
      herbs(["Ethiopian Turmeric", "Turmeric Curcumin", "Ginger"]),
      "Turmeric"
    );
    expect(ranked.map((h) => h.name)).toEqual([
      "Turmeric Curcumin",
      "Ethiopian Turmeric",
      "Ginger",
    ]);
  });

  it("treats a typed name with missing punctuation as an exact match", () => {
    const ranked = rankHerbResults(
      herbs(["St. Johns Wort Oil", "Mountain St. John's Wort", "St. John's Wort"]),
      "st johns wort"
    );
    expect(ranked[0].name).toBe("St. John's Wort");
  });

  it("puts a name containing every typed word above a description-only match", () => {
    const ranked = rankHerbResults(
      herbs(["Zedoary", "Turmeric", "East Indian Arrowroot"]),
      "turmeric powder"
    );
    expect(ranked[0].name).toBe("Turmeric");
  });

  it("prefers the shorter partial match when the query has a qualifier", () => {
    const ranked = rankHerbResults(
      herbs(["Ethiopian Turmeric", "Turmeric"]),
      "turmeric powder"
    );
    expect(ranked.map((h) => h.name)).toEqual(["Turmeric", "Ethiopian Turmeric"]);
  });

  it("is case-insensitive and stable within ranks", () => {
    const ranked = rankHerbResults(herbs(["b-one", "a-two"]), "zzz");
    expect(ranked.map((h) => h.name)).toEqual(["b-one", "a-two"]);
  });

  it("returns input untouched for blank terms", () => {
    const input = herbs(["B", "A"]);
    expect(rankHerbResults(input, "  ")).toBe(input);
  });
});
