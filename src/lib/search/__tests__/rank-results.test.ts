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

  it("is case-insensitive and stable within ranks", () => {
    const ranked = rankHerbResults(herbs(["b-one", "a-two"]), "zzz");
    expect(ranked.map((h) => h.name)).toEqual(["b-one", "a-two"]);
  });

  it("returns input untouched for blank terms", () => {
    const input = herbs(["B", "A"]);
    expect(rankHerbResults(input, "  ")).toBe(input);
  });
});
