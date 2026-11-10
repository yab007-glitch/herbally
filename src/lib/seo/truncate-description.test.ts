import { describe, expect, it } from "vitest";
import { truncateDescription } from "./truncate-description";

describe("truncateDescription", () => {
  it("returns short text untouched", () => {
    expect(truncateDescription("Short description.")).toBe(
      "Short description."
    );
  });

  it("never exceeds the budget", () => {
    const text = "a ".repeat(200);
    expect(truncateDescription(text, 158).length).toBeLessThanOrEqual(158);
  });

  it("cuts on a word boundary instead of mid-word", () => {
    const text =
      "Bienfaits, posologie, grossesse et interactions médicamenteuses de l’ail rose. Fiche appuyée sur les sources PubMed et calculateur de doses gratuit.";
    const out = truncateDescription(text, 100);

    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1).endsWith(" ")).toBe(false);
    // Every kept word must be a whole word from the source.
    const kept = out.slice(0, -1);
    expect(text.startsWith(kept)).toBe(true);
    expect(text.charAt(kept.length)).toBe(" ");
  });

  it("collapses newlines and repeated spaces", () => {
    expect(truncateDescription("a\n\n b   c")).toBe("a b c");
  });

  it("keeps unbroken text within budget", () => {
    expect(truncateDescription("x".repeat(300), 20).length).toBeLessThanOrEqual(
      20
    );
  });

  it("trims dangling punctuation before the ellipsis", () => {
    const out = truncateDescription("word ".repeat(40), 24);
    expect(out).not.toMatch(/[,;:.\-\u2013\u2014]…$/);
  });
});
