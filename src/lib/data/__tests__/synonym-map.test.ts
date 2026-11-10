import { describe, it, expect } from "vitest";
import { expandQueryToKeywords } from "../synonym-map";

describe("expandQueryToKeywords bidirectional sleep/insomnia", () => {
  it("expands insomnia to sleep, not just sleep to insomnia", () => {
    const keywords = expandQueryToKeywords("insomnia anxiety");
    expect(keywords).toContain("sleep");
    expect(keywords).toContain("insomnia");
    expect(keywords).toContain("anxiety");
  });

  it("still expands sleep to insomnia", () => {
    const keywords = expandQueryToKeywords("sleep");
    expect(keywords).toContain("insomnia");
    expect(keywords).toContain("sleep");
  });

  it("expands the reverse-only targets sedative and nervine", () => {
    expect(expandQueryToKeywords("sedative")).toContain("sleep");
    expect(expandQueryToKeywords("nervine")).toContain("calm");
  });
});
