import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HerbSchema } from "../herb-schema";

/**
 * Regression tests for HERBALLY-9 / -A / -7.
 *
 * herb-schema.tsx called `.join()` on fields that `translations` (an
 * unvalidated jsonb column) can supply as bare strings. A string passes the
 * `.length > 0` guard but has no `.join`, so the component threw during render
 * and Next.js silently dropped the entire JSON-LD block from those pages.
 */
const baseHerb = {
  name: "Mentha longifolia",
  scientific_name: "Mentha longifolia",
  slug: "mentha-longifolia",
  description: "A mint species.",
  active_compounds: ["pulegone"],
  traditional_uses: ["digestive support"],
  contraindications: ["pregnancy (high doses)"],
  side_effects: ["GI upset"],
  pregnancy_safe: false,
  nursing_safe: true,
  dosage_adult: "1-2g",
  dosage_child: null,
  herb_categories: { name: "Mints" },
  reviewed_by: null,
  reviewer_credentials: null,
  last_reviewed: null,
  updated_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  evidence_level: "C",
};

function renderSchema(herb: Record<string, unknown>): string {
  return renderToStaticMarkup(
    HerbSchema({
      herb: herb as unknown as Parameters<typeof HerbSchema>[0]["herb"],
    }) as React.ReactElement
  );
}

function extractJson(markup: string): Record<string, unknown> {
  const match = markup.match(/>([\s\S]*)</);
  return JSON.parse(match![1].replace(/\\u003c/g, "<"));
}

describe("HerbSchema", () => {
  it("renders a MedicalWebPage schema for a well-formed herb", () => {
    const json = extractJson(renderSchema(baseHerb));
    expect(json["@type"]).toBe("MedicalWebPage");
    expect(json.name).toBe("Mentha longifolia");
  });

  it("does not throw when array fields arrive as bare strings", () => {
    // The exact malformed shape found in the database.
    const malformed = {
      ...baseHerb,
      traditional_uses: "Rét digestifs, Fièvre",
      contraindications: "Grossesse en fortes doses - pulegone",
      side_effects: "Effets secondaires limités",
      active_compounds: "pulegone",
    };
    expect(() => renderSchema(malformed)).not.toThrow();
  });

  it("still emits the joined values when given bare strings", () => {
    const malformed = {
      ...baseHerb,
      contraindications: "Grossesse en fortes doses - pulegone",
    };
    const json = extractJson(renderSchema(malformed));
    const safety = json.safetyConsideration as Record<string, unknown>;
    expect(safety.contraindication).toBe(
      "Grossesse en fortes doses - pulegone"
    );
  });

  it("omits fields entirely when the value is empty or unusable", () => {
    const empty = {
      ...baseHerb,
      contraindications: "",
      side_effects: null,
      traditional_uses: 42,
    };
    const json = extractJson(renderSchema(empty));
    const safety = json.safetyConsideration as Record<string, unknown>;
    const mainEntity = json.mainEntity as Record<string, unknown>;
    expect(safety.contraindication).toBeUndefined();
    expect(safety.adverseEffect).toBeUndefined();
    expect(mainEntity.medicalUse).toBeUndefined();
  });

  it("filters non-string entries out of arrays", () => {
    const mixed = {
      ...baseHerb,
      contraindications: ["pregnancy", 123, null, "liver disease"],
    };
    const json = extractJson(renderSchema(mixed));
    const safety = json.safetyConsideration as Record<string, unknown>;
    expect(safety.contraindication).toBe("pregnancy; liver disease");
  });
});
