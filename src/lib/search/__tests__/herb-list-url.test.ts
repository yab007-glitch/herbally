import { describe, it, expect } from "vitest";
import {
  buildHerbListUrl,
  parseHerbListPage,
} from "@/lib/search/herb-list-url";

describe("buildHerbListUrl", () => {
  it("returns the bare list URL with the results anchor by default", () => {
    expect(buildHerbListUrl({})).toBe("/herbs#herb-results");
  });

  it("keeps search and category together (search AND category)", () => {
    expect(
      buildHerbListUrl({ q: "Turmeric", category: "digestive" })
    ).toBe("/herbs?q=Turmeric&category=digestive#herb-results");
  });

  it("drops page 1 and the default sort, keeping the URL canonical", () => {
    expect(
      buildHerbListUrl({ q: "ginger", sort: "name", page: 1 })
    ).toBe("/herbs?q=ginger#herb-results");
  });

  it("keeps a non-default sort and a page above 1", () => {
    expect(
      buildHerbListUrl({ sort: "evidence", page: 3 })
    ).toBe("/herbs?sort=evidence&page=3#herb-results");
  });

  it("trims values and drops empties", () => {
    expect(
      buildHerbListUrl({ q: "  ", category: "", page: 0 })
    ).toBe("/herbs#herb-results");
  });

  it("omits the anchor when explicitly null (e.g. category pills)", () => {
    expect(buildHerbListUrl({ category: "digestive", anchor: null })).toBe(
      "/herbs?category=digestive"
    );
  });

  it("URL-encodes query values", () => {
    expect(buildHerbListUrl({ q: "St. John's Wort" })).toBe(
      "/herbs?q=St.+John%27s+Wort#herb-results"
    );
  });
});

describe("parseHerbListPage", () => {
  it("defaults to 1 and collapses invalid values to 1", () => {
    expect(parseHerbListPage(undefined)).toBe(1);
    expect(parseHerbListPage("abc")).toBe(1);
    expect(parseHerbListPage("0")).toBe(1);
    expect(parseHerbListPage("-3")).toBe(1);
  });

  it("floors and keeps valid pages", () => {
    expect(parseHerbListPage("2.9")).toBe(2);
    expect(parseHerbListPage("135")).toBe(135);
  });
});
