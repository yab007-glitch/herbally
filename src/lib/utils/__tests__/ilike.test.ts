import { describe, it, expect } from "vitest";
import { escapeForIlike, sanitizeFilterValue } from "../ilike";

describe("escapeForIlike", () => {
  it("escapes %, _ and backslash", () => {
    expect(escapeForIlike("50%_off")).toBe("50\\%\\_off");
    expect(escapeForIlike("a\\b")).toBe("a\\\\b");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeForIlike("ginger")).toBe("ginger");
  });
});

describe("sanitizeFilterValue — L2 PostgREST .or() filter injection", () => {
  it("escapes ILIKE wildcards (delegates to escapeForIlike)", () => {
    expect(sanitizeFilterValue("100%")).toBe("100\\%");
    expect(sanitizeFilterValue("a_b")).toBe("a\\_b");
  });

  it("strips PostgREST filter delimiters , . ( ) so they can't inject a clause", () => {
    // A comma would terminate the current filter clause and let the attacker
    // append an arbitrary next clause; a dot separates column.operator.value.
    // (% is escaped to \% by escapeForIlike and survives — it's a literal
    // percent in the ILIKE pattern, no longer a wildcard.)
    expect(sanitizeFilterValue("warfarin,other.ilike.%x%")).toBe(
      "warfarinotherilike\\%x\\%"
    );
    expect(sanitizeFilterValue("warfarin(other)")).toBe("warfarinother");
  });

  it("drops parens in branded drug names but keeps the generic matchable", () => {
    // "Warfarin (Coumadin)" -> "Warfarin Coumadin" (parens dropped, spaces kept).
    const sanitized = sanitizeFilterValue("Warfarin (Coumadin)");
    expect(sanitized).toBe("Warfarin Coumadin");
    expect(sanitized).toContain("Warfarin");
  });
});
