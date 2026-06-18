import { describe, it, expect } from "vitest";
import {
  isLocalePrefixed,
  getLocaleFromPathname,
  stripLocalePrefix,
  addLocalePrefix,
  buildAlternateUrls,
} from "../routing";

describe("i18n routing helpers", () => {
  describe("isLocalePrefixed", () => {
    it.each(["/fr", "/fr/", "/fr/herbs", "/fr/herbs/ginger"])(
      "true for %s",
      (p) => expect(isLocalePrefixed(p)).toBe(true)
    );
    it.each(["/", "/herbs", "/herbs/ginger", "/frmore", "/french"])(
      "false for %s",
      (p) => expect(isLocalePrefixed(p)).toBe(false)
    );
  });

  describe("getLocaleFromPathname", () => {
    it("returns fr for /fr paths", () => {
      expect(getLocaleFromPathname("/fr")).toBe("fr");
      expect(getLocaleFromPathname("/fr/herbs")).toBe("fr");
    });
    it("returns en (default) for non-prefixed paths", () => {
      expect(getLocaleFromPathname("/")).toBe("en");
      expect(getLocaleFromPathname("/herbs")).toBe("en");
    });
  });

  describe("stripLocalePrefix", () => {
    it("strips /fr/ and /fr", () => {
      expect(stripLocalePrefix("/fr/herbs")).toBe("/herbs");
      expect(stripLocalePrefix("/fr")).toBe("/");
    });
    it("leaves non-prefixed paths unchanged", () => {
      expect(stripLocalePrefix("/herbs")).toBe("/herbs");
      expect(stripLocalePrefix("/")).toBe("/");
    });
  });

  describe("addLocalePrefix", () => {
    it("adds /fr for the default-en locale it returns the path unchanged", () => {
      expect(addLocalePrefix("/herbs", "en")).toBe("/herbs");
    });
    it("prefixes fr", () => {
      expect(addLocalePrefix("/", "fr")).toBe("/fr");
      expect(addLocalePrefix("/herbs", "fr")).toBe("/fr/herbs");
    });
  });

  describe("buildAlternateUrls", () => {
    it("builds en/fr/x-default alternates", () => {
      const urls = buildAlternateUrls("/herbs", "https://herbally.app");
      expect(urls.en).toBe("https://herbally.app/herbs");
      expect(urls.fr).toBe("https://herbally.app/fr/herbs");
      expect(urls["x-default"]).toBe("https://herbally.app/herbs");
    });
  });
});
