import { describe, expect, it } from "vitest";
import {
  cleanBotanicalIngredientName,
  extractLnhpdArray,
  formatLnhpdStatus,
  normalizeNpnInput,
  parseLnhpdArray,
} from "../lnhpd";

describe("Health Canada LNHPD helpers", () => {
  it("normalizes 8-digit NPN and DIN-HM strings", () => {
    expect(normalizeNpnInput("80000001")).toBe("80000001");
    expect(normalizeNpnInput("NPN 8001-0538")).toBe("80010538");
    expect(normalizeNpnInput("DIN-HM 8003 5032")).toBe("80035032");
    expect(normalizeNpnInput("1234")).toBeNull();
    expect(normalizeNpnInput("abc")).toBeNull();
  });

  it("extracts arrays from bare list or { data: [...] } envelopes", () => {
    expect(extractLnhpdArray([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(extractLnhpdArray({ metadata: {}, data: [{ id: 2 }] })).toEqual([
      { id: 2 },
    ]);
    expect(extractLnhpdArray(null)).toEqual([]);
  });

  it("parseLnhpdArray distinguishes valid empty arrays from unrecognized payload shapes", () => {
    expect(parseLnhpdArray([])).toEqual({ ok: true, rows: [] });
    expect(parseLnhpdArray({ metadata: {}, data: [] })).toEqual({
      ok: true,
      rows: [],
    });
    expect(parseLnhpdArray({})).toEqual({ ok: false });
    expect(parseLnhpdArray(null)).toEqual({ ok: false });
    expect(parseLnhpdArray("maintenance")).toEqual({ ok: false });
    expect(parseLnhpdArray({ error: "busy" })).toEqual({ ok: false });
    expect(parseLnhpdArray({ data: "unexpected" })).toEqual({ ok: false });
  });

  it("strips botanical taxonomic authorities and subspecies", () => {
    expect(
      cleanBotanicalIngredientName("Linum usitatissimum L. subsp. sativa")
    ).toBe("Linum usitatissimum");
    expect(
      cleanBotanicalIngredientName("Hypericum perforatum (St. John's wort)")
    ).toBe("Hypericum perforatum");
    expect(cleanBotanicalIngredientName("Camellia sinensis")).toBe(
      "Camellia sinensis"
    );
  });

  it("formats status labels cleanly in English and French", () => {
    expect(formatLnhpdStatus(1, "en")).toEqual({
      active: true,
      label: "Active licence",
    });
    expect(formatLnhpdStatus(0, "fr")).toEqual({
      active: false,
      label: "Discontinué / inactif",
    });
  });
});
