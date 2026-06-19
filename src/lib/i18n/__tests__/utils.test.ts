import { describe, it, expect } from "vitest";
import {
  getPluralForm,
  lookupTranslation,
  lookupPluralTranslation,
} from "../utils";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

describe("getPluralForm", () => {
  it("english: 1 -> one, else -> other", () => {
    expect(getPluralForm("en", 1)).toBe("one");
    expect(getPluralForm("en", 0)).toBe("other");
    expect(getPluralForm("en", 5)).toBe("other");
  });
  it("french: 0 and 1 -> one, else -> other", () => {
    expect(getPluralForm("fr", 0)).toBe("one");
    expect(getPluralForm("fr", 1)).toBe("one");
    expect(getPluralForm("fr", 2)).toBe("other");
  });
});

describe("lookupTranslation", () => {
  it("resolves dot-notation keys", () => {
    expect(lookupTranslation(en, "home.heroTitle")).toBe(
      "Check herb-drug interactions"
    );
    expect(lookupTranslation(fr, "home.heroTitle")).toMatch(/interactions/i);
  });
  it("interpolates {param} placeholders", () => {
    expect(lookupTranslation(en, "meta.herbsFor", { symptom: "anxiety" })).toBe(
      "Herbs for anxiety"
    );
  });
  it("returns the key when not found or not a string", () => {
    expect(lookupTranslation(en, "does.not.exist")).toBe("does.not.exist");
    expect(lookupTranslation(en, "home")).toBe("home"); // object, not string
  });
  it("leaves unknown params as {param}", () => {
    expect(lookupTranslation(en, "meta.herbsFor", {})).toBe(
      "Herbs for {symptom}"
    );
  });
});

describe("lookupPluralTranslation", () => {
  it("prefers the plural form keyed by locale, falls back to base", () => {
    const dict = {
      herbs: {
        resultsFound: {
          one: "Found {count} herb",
          other: "Found {count} herbs",
        },
      },
    };
    expect(
      lookupPluralTranslation(dict as never, "en", "herbs.resultsFound", 1)
    ).toBe("Found 1 herb");
    expect(
      lookupPluralTranslation(dict as never, "en", "herbs.resultsFound", 3)
    ).toBe("Found 3 herbs");
  });
  it("falls back to the base key when no plural form exists", () => {
    const dict = { herbs: { count: "{count} herbs" } };
    expect(lookupPluralTranslation(dict as never, "en", "herbs.count", 5)).toBe(
      "5 herbs"
    );
  });
});
