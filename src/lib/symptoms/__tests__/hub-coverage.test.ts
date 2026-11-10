import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmptySymptomHubs,
  getPopulatedSymptomKeywords,
  isSymptomHubPopulated,
  resetSymptomCoverageCache,
} from "../hub-coverage";

const rangeMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => ({
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          eqMock(column, value);
          return { range: rangeMock };
        },
      }),
    }),
  }),
}));

describe("symptom hub coverage", () => {
  beforeEach(() => {
    // mockReset, not clearAllMocks: queued mockResolvedValueOnce results
    // survive a clear and leak into the next test.
    rangeMock.mockReset();
    resetSymptomCoverageCache();
  });

  it("collects the keywords of every published herb, one page at a time", async () => {
    rangeMock
      .mockResolvedValueOnce({
        data: [{ symptom_keywords: ["anxiety", "sleep"] }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const keywords = await getPopulatedSymptomKeywords();

    expect(keywords).toEqual(new Set(["anxiety", "sleep"]));
    // Only published rows count: a draft herb must not make a hub look full.
    expect(eqMock).toHaveBeenCalledWith("is_published", true);
  });

  it("reports a hub with no matching herb as empty, and a matching one as full", async () => {
    rangeMock
      .mockResolvedValueOnce({
        data: [{ symptom_keywords: ["anxiety"] }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    expect(await isSymptomHubPopulated("anxiety")).toBe(true);
    // No row carries any of this hub's keywords — the soft-404 shape.
    expect(await isSymptomHubPopulated("prostate")).toBe(false);
    expect(await getEmptySymptomHubs()).toContain("prostate");
    expect(await getEmptySymptomHubs()).not.toContain("anxiety");
  });

  it("counts a hub populated when a synonym keyword exists", async () => {
    rangeMock
      .mockResolvedValueOnce({
        data: [{ symptom_keywords: ["blood pressure"] }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    // The hub's display key is "blood-pressure"; the stored tag has a space.
    expect(await isSymptomHubPopulated("bloodPressure")).toBe(true);
    expect(await getEmptySymptomHubs()).not.toContain("bloodPressure");
  });

  it("fails open when the database errors", async () => {
    rangeMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    // Unknown coverage must never hide a page or noindex a hub.
    expect(await getPopulatedSymptomKeywords()).toBeNull();
    expect(await isSymptomHubPopulated("prostate")).toBe(true);
    expect(await getEmptySymptomHubs()).toEqual([]);
  });

  it("reads the database once per process, not once per page", async () => {
    rangeMock.mockResolvedValue({ data: [], error: null });

    await isSymptomHubPopulated("anxiety");
    await isSymptomHubPopulated("sleep");
    await getEmptySymptomHubs();

    // 52 hub prerenders used to mean 52 extra queries; this is the fix.
    expect(rangeMock).toHaveBeenCalledTimes(1);
  });
});
