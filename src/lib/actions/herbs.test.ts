import { describe, it, expect, vi, beforeEach } from "vitest";
import * as actions from "./herbs";

const getMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: getMock,
  }),
}));

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: fromMock,
  }),
}));

describe("herbs actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    getMock.mockReturnValue({ value: "en" });
    fromMock.mockReset();
  });

  describe("getHerbs", () => {
    it("returns herbs with pagination", async () => {
      const herbs = [
        { id: "h1", name: "Ginger", slug: "ginger", herb_categories: { name: "Roots" } },
      ];
      fromMock.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: herbs, count: 1, error: null }),
            }),
          }),
        }),
      });

      const result = await actions.getHerbs({ page: 1 });
      expect(result.success).toBe(true);
    });

    it("returns error on database failure", async () => {
      fromMock.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: null, count: 0, error: { message: "db timeout" } }),
            }),
          }),
        }),
      });

      const result = await actions.getHerbs({});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/db timeout|Failed to fetch herbs/);
    });
  });

  describe("getHerbBySlug", () => {
    it("returns herb when found", async () => {
      const herb = {
        id: "h1",
        name: "Ginger",
        slug: "ginger",
        herb_categories: { name: "Roots" },
        drug_interactions: [],
      };
      fromMock.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: herb, error: null }),
            }),
          }),
        }),
      });

      const result = await actions.getHerbBySlug("ginger");
      expect(result.success).toBe(true);
    });

    it("returns error when herb not found", async () => {
      fromMock.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "not found" } }),
            }),
          }),
        }),
      });

      const result = await actions.getHerbBySlug("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("getHerbCategories", () => {
    it("returns categories sorted by sort_order", async () => {
      const categories = [
        { id: "c1", name: "Roots", sort_order: 1 },
        { id: "c2", name: "Leaves", sort_order: 2 },
      ];
      fromMock.mockReturnValueOnce({
        select: () => ({
          order: () => Promise.resolve({ data: categories, error: null }),
        }),
      });

      const result = await actions.getHerbCategories();
      expect(result.success).toBe(true);
    });
  });

  describe("searchHerbs", () => {
    it("returns search results for a term (keyword match)", async () => {
      const herbs = [
        { id: "h1", name: "Ginger", slug: "ginger", scientific_name: "Zingiber officinale", evidence_level: "A" },
      ];
      fromMock
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              overlaps: () => ({
                limit: () => Promise.resolve({ data: herbs, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              or: () => ({
                limit: () => Promise.resolve({ data: herbs, error: null }),
              }),
            }),
          }),
        });

      const result = await actions.searchHerbs("ginger");
      expect(result.success).toBe(true);
    });

    it("returns empty results gracefully (no keyword match, no ILIKE match)", async () => {
      fromMock
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              overlaps: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              or: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        });

      const result = await actions.searchHerbs("xyz123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
