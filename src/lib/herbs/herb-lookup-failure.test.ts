import { describe, it, expect, vi, beforeEach } from "vitest";
import { notFound } from "next/navigation";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { HerbDataUnavailableError, resolveHerbOr404 } from "./resolve-herb";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "en" }),
  }),
}));

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: fromMock,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const mockedNotFound = vi.mocked(notFound);

describe("herb lookup failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("query that throws becomes a retry signal, never a 404", async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.reject(new Error("connection terminated unexpectedly")),
          }),
        }),
      }),
    });

    const result = await getHerbBySlug("ginger");

    expect(result.success).toBe(false);
    expect(!result.success && result.reason).toBe("unavailable");
    expect(() => resolveHerbOr404(result)).toThrow(HerbDataUnavailableError);
    expect(mockedNotFound).not.toHaveBeenCalled();
  });

  it("missing row still 404s", async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: {
                  code: "PGRST116",
                  message:
                    "JSON object requested, multiple (or no) rows returned: 0 rows",
                },
              }),
          }),
        }),
      }),
    });

    const result = await getHerbBySlug("ginger");

    expect(result.success).toBe(false);
    expect(!result.success && result.reason).toBe("not_found");
    expect(() => resolveHerbOr404(result)).toThrow("NEXT_NOT_FOUND");
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });

  it("found row returns the herb and does not 404", async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: "h1",
                  name: "Ginger",
                  name_fr: null,
                  slug: "ginger",
                  herb_categories: null,
                  drug_interactions: [],
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const result = await getHerbBySlug("ginger");

    expect(result.success).toBe(true);
    const herb = resolveHerbOr404(result);
    expect(herb.slug).toBe("ginger");
    expect(mockedNotFound).not.toHaveBeenCalled();
  });
});
