import { describe, it, expect } from "vitest";
import { resolveSheetContent } from "./sheet-content";

const english = {
  title: "Ginger — PubMed-Compiled Information Sheet",
  summary: "English summary.",
  background: "English background.",
  citedPmids: ["123"],
};

describe("resolveSheetContent", () => {
  it("returns English on an English page", () => {
    const r = resolveSheetContent(english, "en");
    expect(r.content).toBe(english);
    expect(r.translated).toBe(false);
  });

  it("returns English when no translation exists", () => {
    const r = resolveSheetContent(english, "fr");
    expect(r.content).toBe(english);
    expect(r.translated).toBe(false);
  });

  it("prefers the French translation on a French page", () => {
    const withFr = {
      ...english,
      fr: {
        title: "Gingembre — Fiche d'information compilée à partir de PubMed",
        summary: "Résumé français.",
        citedPmids: ["123"],
      },
    };
    const r = resolveSheetContent(withFr, "fr");
    expect(r.translated).toBe(true);
    expect((r.content as { summary: string }).summary).toBe("Résumé français.");
  });

  it("falls back to English for a stub translation", () => {
    const stub = { ...english, fr: { citedPmids: ["123"] } };
    const r = resolveSheetContent(stub, "fr");
    expect(r.translated).toBe(false);
    expect(r.content?.summary).toBe("English summary.");
  });

  it("falls back to English for null, array or missing content", () => {
    expect(resolveSheetContent({ ...english, fr: null }, "fr").translated).toBe(
      false
    );
    expect(
      resolveSheetContent({ ...english, fr: ["x"] }, "fr").translated
    ).toBe(false);
    expect(resolveSheetContent(null, "fr").content).toBeNull();
    expect(resolveSheetContent(undefined, "fr").content).toBeNull();
  });
});
