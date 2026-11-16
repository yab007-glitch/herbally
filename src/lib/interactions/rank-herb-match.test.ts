import { describe, expect, it } from "vitest";
import { rankHerbMatches, slugifyHerbTerm } from "./rank-herb-match";

const turmeric = {
  slug: "turmeric",
  name: "Turmeric",
  scientific_name: "Curcuma longa",
};
const javaTurmeric = {
  slug: "java-turmeric",
  name: "Turmeric",
  scientific_name: "Curcuma xanthorrhiza",
};
const ginger = {
  slug: "ginger",
  name: "Ginger",
  scientific_name: "Zingiber officinale",
};

describe("slugifyHerbTerm", () => {
  it("turns a display name into a slug", () => {
    expect(slugifyHerbTerm("Turmeric (Curcuma longa)")).toBe(
      "turmeric-curcuma-longa"
    );
  });
});

describe("rankHerbMatches", () => {
  it("returns undefined for no candidates", () => {
    expect(rankHerbMatches([], "turmeric")).toBeUndefined();
  });

  it("prefers the row whose slug is the query when names collide", () => {
    // The production bug: .limit(20) order is unspecified, so the first
    // exact-name row could be Java turmeric and the answer described the
    // wrong species.
    expect(rankHerbMatches([javaTurmeric, turmeric], "Turmeric")).toBe(
      turmeric
    );
  });

  it("keeps the existing exact-name match when no slug matches", () => {
    expect(rankHerbMatches([ginger, turmeric], "Zingiber officinale")).toBe(
      ginger
    );
  });

  it("matches scientific names case-insensitively", () => {
    expect(rankHerbMatches([ginger], "zINGIBER officinale")).toBe(ginger);
  });

  it("falls back to a name prefix match", () => {
    expect(rankHerbMatches([ginger], "Ging")).toBe(ginger);
  });

  it("never invents a herb: an unmatched query keeps the first DB candidate", () => {
    // The caller's ILIKE already filtered the rows, so rows[0] is the old
    // fallback and stays the last resort.
    expect(rankHerbMatches([ginger], "not-a-herb")).toBe(ginger);
  });
});
