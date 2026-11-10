import { describe, expect, it } from "vitest";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

/**
 * Guards the herb meta-description templates.
 *
 * Every one of the ~2,700 /herbs/* pages built its description from these
 * strings. `{uses}` was spliced in as a clause, so the live English snippet read
 * "What is Turmeric in English (Indian Saffron, Haldi, Golden Spice)? Uses for
 * In Ayurvedic medicine, traditional…" — broken grammar in the one piece of
 * copy that decides whether someone clicks. The French templates never had it.
 */

// Stand-ins for real values: a common-name list, a binomial, and a clause-style
// "uses" string, i.e. the shape that used to break the sentence.
const NAME = "Turmeric";
const SCIENTIFIC = "Curcuma longa";
const COMMON = "Indian Saffron, Haldi";
const BODY = "A rhizome used in cooking and traditional medicine.";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => vars[key] ?? `{${key}}`
  );
}

const EN_TEMPLATES = [
  ["descWithNames", { name: NAME, scientific: SCIENTIFIC, common: COMMON }],
  ["descFromBody", { body: BODY, name: NAME, scientific: SCIENTIFIC }],
  ["descFallback", { name: NAME, scientific: SCIENTIFIC }],
] as const;

describe("herb meta descriptions", () => {
  it.each(EN_TEMPLATES)("builds a sentence from %s", (key, vars) => {
    const rendered = fill(
      (en.herbMeta as Record<string, string>)[key],
      vars as Record<string, string>
    );

    // No unfilled placeholder survived, and no scaffolding leaked into the copy.
    expect(rendered).not.toMatch(/\{\w+\}/);
    expect(rendered).not.toMatch(/\bin English\b/i);
    // "Uses for In Ayurvedic medicine" — the exact defect.
    expect(rendered).not.toMatch(/\buses for\s+[A-Z]/);
    // A meta description is a sentence, not a keyword dump.
    expect(rendered).toMatch(/[a-z0-9]/);
    expect(rendered.length).toBeGreaterThan(80);
  });

  it("keeps descriptions under the length search results actually show", () => {
    const rendered = EN_TEMPLATES.map(([key, vars]) =>
      fill(
        (en.herbMeta as Record<string, string>)[key],
        vars as Record<string, string>
      )
    );
    for (const text of rendered) {
      // ~160 characters is the practical cut-off; longer is truncated away.
      expect(text.length).toBeLessThanOrEqual(200);
    }
  });

  it("does not carry the broken English phrasing into French", () => {
    const frMeta = fr.herbMeta as Record<string, string>;
    for (const key of ["descWithNames", "descFromBody", "descFallback"]) {
      expect(frMeta[key]).not.toMatch(/\bin English\b/i);
      expect(frMeta[key]).not.toContain("{uses}");
    }
  });
});
