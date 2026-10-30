import { describe, it, expect } from "vitest";
import { rankHerbSearchResults } from "../herb-search-union";

describe("rankHerbSearchResults", () => {
  it("unions keyword and name matches instead of hiding names behind keywords", () => {
    const ids = rankHerbSearchResults({
      query: "Turmeric",
      keywordMatches: [
        { id: "k1", name: "Some Herb", evidence_level: "A" },
      ],
      nameMatches: [{ id: "t1", name: "Turmeric" }],
      sort: "evidence",
    });
    expect(ids).toEqual(["t1", "k1"]);
  });

  it("puts an exact name match first even when it is not a keyword match", () => {
    const ids = rankHerbSearchResults({
      query: "turmeric",
      keywordMatches: [
        { id: "a", name: "Ashwagandha", evidence_level: "A" },
        { id: "b", name: "Basil", evidence_level: "B" },
      ],
      nameMatches: [
        { id: "t", name: "Turmeric" },
        { id: "u", name: "Turmeric Root" },
      ],
      sort: "evidence",
    });
    expect(ids[0]).toBe("t");
    // Exact first, then keyword matches in evidence order, then other names.
    expect(ids).toEqual(["t", "a", "b", "u"]);
  });

  it("de-duplicates by id, first occurrence wins", () => {
    const ids = rankHerbSearchResults({
      query: "sleep",
      keywordMatches: [{ id: "v", name: "Valerian", evidence_level: "C" }],
      nameMatches: [{ id: "v", name: "Valerian" }],
      sort: "name",
    });
    expect(ids).toEqual(["v"]);
  });

  it("orders remaining matches by name when sort is name", () => {
    const ids = rankHerbSearchResults({
      query: "calm",
      keywordMatches: [
        { id: "z", name: "Zebra Herb", evidence_level: "A" },
        { id: "a", name: "Apple Herb", evidence_level: "D" },
      ],
      nameMatches: [],
      sort: "name",
    });
    expect(ids).toEqual(["a", "z"]);
  });

  it("orders keyword matches by evidence when sort is evidence", () => {
    const ids = rankHerbSearchResults({
      query: "calm",
      keywordMatches: [
        { id: "d", name: "D Herb", evidence_level: "D" },
        { id: "a", name: "A Herb", evidence_level: "A" },
      ],
      nameMatches: [{ id: "n", name: "Name Herb" }],
      sort: "evidence",
    });
    expect(ids).toEqual(["a", "d", "n"]);
  });

  it("returns an empty list for a blank query", () => {
    expect(
      rankHerbSearchResults({
        query: "   ",
        keywordMatches: [{ id: "a", name: "A", evidence_level: "A" }],
        nameMatches: [],
        sort: "name",
      })
    ).toEqual([]);
  });
});
