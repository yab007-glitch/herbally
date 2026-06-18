import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchDrugs,
  getDrugByRxcui,
  getDrugInteractions,
} from "../rxnorm-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("rxnorm-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchDrugs", () => {
    it("returns parsed drug list on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          approximateGroup: {
            candidate: [
              { rxcui: "12345", name: "Warfarin", score: "100" },
              { rxcui: "12346", name: "Warfarin Sodium", score: "95" },
            ],
          },
        }),
      });

      const result = await searchDrugs("warfarin");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        rxcui: "12345",
        name: "Warfarin",
        synonym: "Warfarin",
      });
    });

    it("returns empty array when API returns non-ok", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await searchDrugs("aspirin");
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network failure"));
      const result = await searchDrugs("aspirin");
      expect(result).toEqual([]);
    });

    it("returns empty array when no candidates", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          approximateGroup: {},
        }),
      });
      const result = await searchDrugs("xyznonexistent");
      expect(result).toEqual([]);
    });

    it("URL-encodes the search term", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          approximateGroup: { candidate: [] },
        }),
      });
      await searchDrugs("vitamin c");
      expect(fetchMock.mock.calls[0][0]).toContain(
        encodeURIComponent("vitamin c")
      );
    });
  });

  describe("getDrugByRxcui", () => {
    it("returns drug name on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: { name: "Warfarin 5mg" },
        }),
      });

      const result = await getDrugByRxcui("12345");
      expect(result).toBe("Warfarin 5mg");
    });

    it("returns null when API non-ok", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false });
      const result = await getDrugByRxcui("99999");
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      const result = await getDrugByRxcui("12345");
      expect(result).toBeNull();
    });
  });

  describe("getDrugInteractions", () => {
    it("returns interaction groups on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interactionTypeGroup: [{ interactionType: [] }],
        }),
      });

      const result = await getDrugInteractions("12345");
      expect(result).toHaveLength(1);
    });

    it("returns empty array when API non-ok", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false });
      const result = await getDrugInteractions("12345");
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      const result = await getDrugInteractions("12345");
      expect(result).toEqual([]);
    });
  });
});
