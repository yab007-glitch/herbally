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

    it("returns empty array on 404 (no matches is expected)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await searchDrugs("aspirin");
      expect(result).toEqual([]);
    });

    it("throws on a non-2xx non-404 upstream error (M11)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(searchDrugs("aspirin")).rejects.toThrow(
        "rxnorm_search_status_500"
      );
    });

    it("returns empty array on transient network error", async () => {
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

    it("returns null on 404 (no such rxcui is expected)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await getDrugByRxcui("99999");
      expect(result).toBeNull();
    });

    it("throws on a non-2xx non-404 upstream error (M11)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(getDrugByRxcui("99999")).rejects.toThrow(
        "rxnorm_get_status_500"
      );
    });

    it("returns null on transient network error", async () => {
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

    it("returns empty array on 404 (no interactions is expected)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await getDrugInteractions("12345");
      expect(result).toEqual([]);
    });

    it("throws on a non-2xx non-404 upstream error (M11)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(getDrugInteractions("12345")).rejects.toThrow(
        "rxnorm_interactions_status_503"
      );
    });

    it("returns empty array on transient network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      const result = await getDrugInteractions("12345");
      expect(result).toEqual([]);
    });
  });
});
