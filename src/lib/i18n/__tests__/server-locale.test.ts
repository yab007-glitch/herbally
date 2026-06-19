import { describe, it, expect, vi, beforeEach } from "vitest";

const headerMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => headerMock(k),
  }),
}));

describe("getLocaleFromRequest", () => {
  beforeEach(() => headerMock.mockReset());

  it("returns 'fr' when the x-locale header is fr", async () => {
    headerMock.mockImplementation((k: string) =>
      k === "x-locale" ? "fr" : null
    );
    const { getLocaleFromRequest } = await import("../server-locale");
    expect(await getLocaleFromRequest()).toBe("fr");
  });

  it("returns 'en' when the x-locale header is en", async () => {
    headerMock.mockImplementation((k: string) =>
      k === "x-locale" ? "en" : null
    );
    const { getLocaleFromRequest } = await import("../server-locale");
    expect(await getLocaleFromRequest()).toBe("en");
  });

  it("defaults to 'en' when the header is missing/unrecognized", async () => {
    headerMock.mockReturnValue(null);
    const { getLocaleFromRequest } = await import("../server-locale");
    expect(await getLocaleFromRequest()).toBe("en");
  });
});
