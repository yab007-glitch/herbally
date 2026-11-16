import { describe, expect, it } from "vitest";
import { isUsablePubmedSheet } from "./usable";

describe("isUsablePubmedSheet", () => {
  it("rejects a missing sheet", () => {
    expect(isUsablePubmedSheet(null)).toBe(false);
    expect(isUsablePubmedSheet(undefined)).toBe(false);
  });

  it("rejects a placeholder sheet with no citations", () => {
    expect(
      isUsablePubmedSheet({
        content: { summary: "No PubMed data available." },
        pmids: [],
        citations: [],
      })
    ).toBe(false);
  });

  it("rejects a sheet with no content even when citations exist", () => {
    expect(isUsablePubmedSheet({ content: null, pmids: ["123"] })).toBe(false);
  });

  it("accepts a sheet whose claims carry PMIDs", () => {
    expect(
      isUsablePubmedSheet({ content: { summary: "…" }, pmids: ["12345678"] })
    ).toBe(true);
  });

  it("accepts a legacy sheet that stored citations but no pmids array", () => {
    expect(
      isUsablePubmedSheet({
        content: { summary: "…" },
        citations: [{ pmid: "12345678" }],
      })
    ).toBe(true);
  });
});
