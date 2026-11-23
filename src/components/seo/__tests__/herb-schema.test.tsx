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

  it("uses the caller's localized url instead of the English path", () => {
    // French pages used to declare https://herbally.app/herbs/<slug> inside
    // their own MedicalWebPage node while serving /fr/herbs/<slug>.
    const frUrl = "https://herbally.app/fr/herbs/mentha-longifolia";
    const markup = renderToStaticMarkup(
      HerbSchema({
        herb: baseHerb as unknown as Parameters<typeof HerbSchema>[0]["herb"],
        url: frUrl,
      }) as React.ReactElement
    );
    expect(extractJson(markup).url).toBe(frUrl);
  });

  it("omits generic 'Not Common' / 'Pas courant' bucket categories", () => {
    for (const bucket of ["Not Common", "Pas courant"]) {
      const json = extractJson(
        renderSchema({ ...baseHerb, herb_categories: { name: bucket } })
      );
      expect((json.about as Record<string, unknown>).category).toBeUndefined();
    }
  });
});

describe("HerbSchema reviewer attribution", () => {
  it("emits reviewedBy for a registered, named reviewer", () => {
    const json = extractJson(
      renderSchema({
        ...baseHerb,
        reviewed_by: "yasser-bheekun",
        last_reviewed: "2026-11-18T00:00:00Z",
      })
    );
    const reviewedBy = json.reviewedBy as
      { name?: string; jobTitle?: string; "@type"?: string } | undefined;
    expect(reviewedBy?.name).toBe("Yasser Bheekun");
    expect(reviewedBy?.jobTitle).toContain("OPTMQ");
    expect(reviewedBy?.["@type"]).toBe("Person");
  });

  it("resolves the reviewer by display name as well as by id", () => {
    const json = extractJson(
      renderSchema({ ...baseHerb, reviewed_by: "Yasser Bheekun" })
    );
    expect((json.reviewedBy as { name?: string } | undefined)?.name).toBe(
      "Yasser Bheekun"
    );
  });

  it("never emits the generic editorial-team string as a person", () => {
    const json = extractJson(
      renderSchema({ ...baseHerb, reviewed_by: "HerbAlly Editorial Team" })
    );
    const reviewedBy = json.reviewedBy as
      { name?: string; "@type"?: string } | undefined;
    expect(reviewedBy?.["@type"]).toBe("Organization");
    expect(reviewedBy?.name).toBe("HerbAlly editorial team");
  });

  it("omits dosage, pediatricDose, and medicalUse and forces pregnancy/nursing warnings when isDangerous is true", () => {
    const json = extractJson(
      renderToStaticMarkup(
        <HerbSchema
          herb={{
            ...baseHerb,
            slug: "atropa-belladonna-herb",
            dosage_adult: "100 mg daily",
            dosage_child: "10 mg daily",
            traditional_uses: ["Antispasmodic"],
            modern_uses: ["Topical analgesic"],
            pregnancy_safe: true,
            nursing_safe: true,
          }}
          url="https://herbally.app/herbs/atropa-belladonna-herb"
          isDangerous={true}
        />
      )
    );

    expect(json.dosage).toBeUndefined();
    expect(json.pediatricDose).toBeUndefined();
    expect(json.medicalUse).toBeUndefined();
    const safetyJson = JSON.stringify(json.safetyConsideration);
    expect(safetyJson).toContain("Not recommended during pregnancy");
    expect(safetyJson).toContain("Not recommended while nursing");
  });

  it("omits pediatricDose even when dosage_child is present on a non-dangerous herb", () => {
    const json = extractJson(
      renderToStaticMarkup(
        <HerbSchema
          herb={{
            ...baseHerb,
            dosage_adult: "500 mg daily",
            dosage_child: "100 mg daily",
          }}
          url="https://herbally.app/herbs/test-herb"
        />
      )
    );

    expect((json.dosage as { doseValue?: string } | undefined)?.doseValue).toBe(
      "500 mg daily"
    );
    expect(json.pediatricDose).toBeUndefined();
  });

  it("omits reviewedBy and does not override dateModified with last_reviewed when isClinicallyReviewed is false", () => {
    const json = extractJson(
      renderToStaticMarkup(
        <HerbSchema
          herb={{
            ...baseHerb,
            reviewed_by: "Yasser Bheekun",
            last_reviewed: "2026-06-23",
          }}
          url="https://herbally.app/herbs/test-herb"
          dateModified="2026-11-22"
          isClinicallyReviewed={false}
        />
      )
    );

    expect(
      (json.reviewedBy as { "@type"?: string } | undefined)?.["@type"]
    ).toBe("Organization");
    expect(json.dateModified).toBe("2026-11-22");
  });
});
