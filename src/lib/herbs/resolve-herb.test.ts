import { describe, expect, it, vi, beforeEach } from "vitest";
import { notFound } from "next/navigation";
import { HerbDataUnavailableError, resolveHerbOr404 } from "./resolve-herb";
import type { HerbWithInteractions } from "@/lib/types";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("resolveHerbOr404", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the herb on success", () => {
    const herb = {
      id: "h1",
      name: "Ginger",
      slug: "ginger",
    } as HerbWithInteractions;

    const result = resolveHerbOr404({ success: true, data: herb });

    expect(result).toBe(herb);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("throws (instead of 404ing) when the data source is unavailable", () => {
    expect(() =>
      resolveHerbOr404({
        success: false,
        error: "db timeout",
        reason: "unavailable",
      })
    ).toThrow(HerbDataUnavailableError);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound for a genuine miss", () => {
    expect(() =>
      resolveHerbOr404({
        success: false,
        error: "Herb not found",
        reason: "not_found",
      })
    ).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("treats a failure without a reason as not found", () => {
    expect(() =>
      resolveHerbOr404({
        success: false,
        error: "Herb not found",
      })
    ).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
