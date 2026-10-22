import { describe, it, expect, vi, beforeEach } from "vitest";

const rootLocaleMock = vi.fn();
vi.mock("next/root-params", () => ({
  locale: async () => rootLocaleMock(),
}));

describe("getLocale (root param)", () => {
  beforeEach(() => rootLocaleMock.mockReset());

  it("returns the fr root param", async () => {
    rootLocaleMock.mockReturnValue("fr");
    const { getLocale } = await import("../page-locale");
    expect(await getLocale()).toBe("fr");
  });

  it("returns the en root param", async () => {
    rootLocaleMock.mockReturnValue("en");
    const { getLocale } = await import("../page-locale");
    expect(await getLocale()).toBe("en");
  });

  it("falls back to the default locale for an unknown segment", async () => {
    rootLocaleMock.mockReturnValue("de");
    const { getLocale } = await import("../page-locale");
    expect(await getLocale()).toBe("en");
  });

  it("falls back when the root param is missing", async () => {
    rootLocaleMock.mockReturnValue(undefined);
    const { getLocale } = await import("../page-locale");
    expect(await getLocale()).toBe("en");
  });
});
