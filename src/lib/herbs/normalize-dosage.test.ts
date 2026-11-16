import { describe, expect, it } from "vitest";
import { normalizeDosage } from "./normalize-dosage";

describe("normalizeDosage", () => {
  it("pluralises a range", () => {
    expect(normalizeDosage("3–5 granule 2–3× daily")).toBe(
      "3–5 granules 2–3× daily"
    );
  });

  it("keeps a single unit singular", () => {
    expect(normalizeDosage("1 granule daily")).toBe("1 granule daily");
  });

  it("pluralises a whole number above one", () => {
    expect(normalizeDosage("12 granule daily")).toBe("12 granules daily");
  });

  it("leaves other text untouched", () => {
    expect(normalizeDosage("500 mg twice daily")).toBe("500 mg twice daily");
  });
});
