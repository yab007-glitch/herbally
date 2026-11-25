import { describe, it, expect } from "vitest";
import {
  classifySupabaseTarget,
  checkSafetyConflicts,
  checkCatalogCardinality,
  classifyPairUrlCollisions,
  KNOWN_UNRESOLVED_PAIR_COLLISIONS,
} from "../verify-rules";

describe("classifySupabaseTarget", () => {
  it("requires exact HTTPS production origin and rejects lookalikes, custom ports/paths, and invalid URLs", () => {
    expect(classifySupabaseTarget(undefined)).toBe("missing");
    expect(classifySupabaseTarget("")).toBe("missing");
    expect(classifySupabaseTarget("not-a-url")).toBe("invalid");
    expect(classifySupabaseTarget("https://placeholder.supabase.co")).toBe(
      "placeholder"
    );
    expect(
      classifySupabaseTarget("https://pnvltmyixympgammxvoo.supabase.co")
    ).toBe("legacy-hosted");
    expect(classifySupabaseTarget("https://api.herbally.app")).toBe(
      "production"
    );
    expect(classifySupabaseTarget("https://api.herbally.app/")).toBe(
      "production"
    );
    expect(classifySupabaseTarget("http://api.herbally.app")).toBe("custom");
    expect(classifySupabaseTarget("https://api.herbally.app:8443")).toBe(
      "custom"
    );
    expect(classifySupabaseTarget("https://api.herbally.app.evil.com")).toBe(
      "custom"
    );
    expect(
      classifySupabaseTarget("https://evil.com/?next=https://api.herbally.app")
    ).toBe("custom");
    expect(classifySupabaseTarget("https://evil.com/api.herbally.app")).toBe(
      "custom"
    );
    expect(classifySupabaseTarget("https://user:pass@api.herbally.app")).toBe(
      "custom"
    );
    expect(classifySupabaseTarget("http://127.0.0.1:54321")).toBe("custom");
  });
});

describe("checkCatalogCardinality", () => {
  it("flags zero or under-minimum categories, herbs, and interactions", () => {
    const emptyErrors = checkCatalogCardinality({
      categories: 0,
      herbs: 0,
      interactions: 0,
    });
    expect(emptyErrors).toHaveLength(3);

    const lowErrors = checkCatalogCardinality({
      categories: 10,
      herbs: 12,
      interactions: 3,
    });
    expect(lowErrors.map((e) => e.field).sort()).toEqual([
      "drug_interactions",
      "herbs",
    ]);

    expect(
      checkCatalogCardinality({
        categories: 12,
        herbs: 3122,
        interactions: 670,
      })
    ).toEqual([]);
  });
});

describe("classifyPairUrlCollisions", () => {
  it("allows only exact known fail-safe collisions while blocking changed or newly introduced collisions", () => {
    const knownSage = {
      path: "/interactions/sage/anticonvulsants",
      herbSlug: "sage",
      drugSlug: "anticonvulsants",
      hasSeverityConflict: true,
      rows: [
        {
          id: "1",
          herbSlug: "sage",
          drugName: "Anticonvulsants",
          severity: "moderate",
        },
        {
          id: "2",
          herbSlug: "sage",
          drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
          severity: "severe",
        },
      ],
    };

    const resExact = classifyPairUrlCollisions(
      [knownSage],
      [KNOWN_UNRESOLVED_PAIR_COLLISIONS[0]]
    );
    expect(resExact.blocking).toEqual([]);
    expect(resExact.knownFailSafe).toHaveLength(1);
    expect(resExact.staleInventory).toEqual([]);

    // Changed row count (3 rows instead of 2) -> must block
    const changedRows = {
      ...knownSage,
      rows: [
        ...knownSage.rows,
        {
          id: "3",
          herbSlug: "sage",
          drugName: "Anticonvulsants (Extra)",
          severity: "mild",
        },
      ],
    };
    const resChangedCount = classifyPairUrlCollisions(
      [changedRows],
      [KNOWN_UNRESOLVED_PAIR_COLLISIONS[0]]
    );
    expect(resChangedCount.blocking).toHaveLength(1);

    // Changed severity on sage/anticonvulsants -> must block
    const changedSeverity = {
      ...knownSage,
      rows: [{ ...knownSage.rows[0], severity: "mild" }, knownSage.rows[1]],
    };
    const resChangedSev = classifyPairUrlCollisions(
      [changedSeverity],
      [KNOWN_UNRESOLVED_PAIR_COLLISIONS[0]]
    );
    expect(resChangedSev.blocking).toHaveLength(1);

    // Brand new collision -> must block
    const newCollision = {
      path: "/interactions/turmeric/warfarin",
      herbSlug: "turmeric",
      drugSlug: "warfarin",
      hasSeverityConflict: true,
      rows: [
        {
          id: "a",
          herbSlug: "turmeric",
          drugName: "Warfarin",
          severity: "moderate",
        },
        {
          id: "b",
          herbSlug: "turmeric",
          drugName: "Warfarin (Coumadin)",
          severity: "severe",
        },
      ],
    };
    const resNew = classifyPairUrlCollisions(
      [knownSage, newCollision],
      [KNOWN_UNRESOLVED_PAIR_COLLISIONS[0]]
    );
    expect(resNew.blocking).toHaveLength(1);
    expect(resNew.blocking[0].path).toBe("/interactions/turmeric/warfarin");

    // Resolved known collision absent from DB -> flagged in staleInventory
    const resStale = classifyPairUrlCollisions(
      [],
      [KNOWN_UNRESOLVED_PAIR_COLLISIONS[0]]
    );
    expect(resStale.staleInventory).toEqual([
      "/interactions/sage/anticonvulsants",
    ]);
  });

  it("enforces exact reviewed signatures on all 6 known collisions and blocks non-sage name or severity mutations", () => {
    expect(KNOWN_UNRESOLVED_PAIR_COLLISIONS).toHaveLength(6);
    for (const spec of KNOWN_UNRESOLVED_PAIR_COLLISIONS) {
      expect(spec.expectedSignatures).toHaveLength(spec.expectedRowCount);
    }

    const nonSageCollisions = [
      {
        path: "/interactions/rhodiola/antidepressants",
        herbSlug: "rhodiola",
        drugSlug: "antidepressants",
        hasSeverityConflict: false,
        rows: [
          {
            id: "r1",
            herbSlug: "rhodiola",
            drugName: "Antidepressants (SSRIs)",
            severity: "moderate",
          },
          {
            id: "r2",
            herbSlug: "rhodiola",
            drugName: "Antidepressants (MAOIs, SSRIs, SNRIs)",
            severity: "moderate",
          },
        ],
      },
      {
        path: "/interactions/astragalus/immunosuppressants",
        herbSlug: "astragalus",
        drugSlug: "immunosuppressants",
        hasSeverityConflict: true,
        rows: [
          {
            id: "a1",
            herbSlug: "astragalus",
            drugName: "Immunosuppressants",
            severity: "moderate",
          },
          {
            id: "a2",
            herbSlug: "astragalus",
            drugName:
              "Immunosuppressants (Cyclosporine, Tacrolimus, Prednisone)",
            severity: "severe",
          },
        ],
      },
      {
        path: "/interactions/cats-claw/immunosuppressants",
        herbSlug: "cats-claw",
        drugSlug: "immunosuppressants",
        hasSeverityConflict: true,
        rows: [
          {
            id: "cc1",
            herbSlug: "cats-claw",
            drugName: "Immunosuppressants",
            severity: "moderate",
          },
          {
            id: "cc2",
            herbSlug: "cats-claw",
            drugName: "Immunosuppressants (Cyclosporine, Tacrolimus)",
            severity: "severe",
          },
        ],
      },
      {
        path: "/interactions/cordyceps/immunosuppressants",
        herbSlug: "cordyceps",
        drugSlug: "immunosuppressants",
        hasSeverityConflict: false,
        rows: [
          {
            id: "co1",
            herbSlug: "cordyceps",
            drugName: "Immunosuppressants",
            severity: "moderate",
          },
          {
            id: "co2",
            herbSlug: "cordyceps",
            drugName: "Immunosuppressants (Cyclosporine, Prednisone)",
            severity: "moderate",
          },
        ],
      },
      {
        path: "/interactions/evening-primrose/phenothiazines",
        herbSlug: "evening-primrose",
        drugSlug: "phenothiazines",
        hasSeverityConflict: false,
        rows: [
          {
            id: "ep1",
            herbSlug: "evening-primrose",
            drugName: "Phenothiazines (Chlorpromazine, Fluphenazine)",
            severity: "severe",
          },
          {
            id: "ep2",
            herbSlug: "evening-primrose",
            drugName: "Phenothiazines (Chlorpromazine)",
            severity: "severe",
          },
        ],
      },
    ];

    const exact = classifyPairUrlCollisions(nonSageCollisions);
    expect(exact.blocking).toEqual([]);
    expect(exact.knownFailSafe).toHaveLength(5);

    // Mutate drugName on rhodiola/antidepressants -> must block
    const mutatedName = nonSageCollisions.map((col, idx) =>
      idx === 0
        ? {
            ...col,
            rows: [
              {
                ...col.rows[0],
                drugName: "Antidepressants (SSRIs, Bupropion)",
              },
              col.rows[1],
            ],
          }
        : col
    );
    const nameRes = classifyPairUrlCollisions(mutatedName);
    expect(nameRes.blocking.map((b) => b.path)).toEqual([
      "/interactions/rhodiola/antidepressants",
    ]);

    // Mutate severity on astragalus/immunosuppressants -> must block
    const mutatedSeverity = nonSageCollisions.map((col, idx) =>
      idx === 1
        ? {
            ...col,
            rows: [
              col.rows[0],
              { ...col.rows[1], severity: "contraindicated" },
            ],
          }
        : col
    );
    const sevRes = classifyPairUrlCollisions(mutatedSeverity);
    expect(sevRes.blocking.map((b) => b.path)).toEqual([
      "/interactions/astragalus/immunosuppressants",
    ]);

    // Mutate severity on evening-primrose/phenothiazines -> must block
    const mutatedEp = nonSageCollisions.map((col, idx) =>
      idx === 4
        ? {
            ...col,
            rows: [col.rows[0], { ...col.rows[1], severity: "moderate" }],
          }
        : col
    );
    const epRes = classifyPairUrlCollisions(mutatedEp);
    expect(epRes.blocking.map((b) => b.path)).toEqual([
      "/interactions/evening-primrose/phenothiazines",
    ]);
  });
});

describe("checkSafetyConflicts", () => {
  it("flags pregnancy_safe=true when contraindications or dosage state pregnancy/abortifacient contraindication", () => {
    const conflicts = checkSafetyConflicts({
      name: "Pennyroyal",
      slug: "pennyroyal",
      pregnancy_safe: true,
      nursing_safe: false,
      contraindications: ["Pregnancy (abortifacient)", "Liver disease"],
      dosage_adult: "Not recommended.",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("pregnancy_safe");
  });

  it("flags nursing_safe=true when contraindications mention nursing or breastfeeding", () => {
    const conflicts = checkSafetyConflicts({
      name: "Test Herb",
      slug: "test-herb",
      pregnancy_safe: false,
      nursing_safe: true,
      contraindications: ["Breastfeeding / lactation"],
      dosage_adult: "100 mg daily",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("nursing_safe");
  });

  it("flags pregnancy_safe=true or nursing_safe=true when dosage_adult says no safe dose / contraindicated in all forms", () => {
    const conflicts = checkSafetyConflicts({
      name: "Aristolochia",
      slug: "aristolochia",
      pregnancy_safe: true,
      nursing_safe: true,
      contraindications: [],
      dosage_adult: "No safe dose — contraindicated in all forms.",
    });
    expect(conflicts.map((c) => c.field).sort()).toEqual([
      "nursing_safe",
      "pregnancy_safe",
    ]);
  });

  it("passes cleanly when pregnancy_safe/nursing_safe align with contraindications", () => {
    const conflicts = checkSafetyConflicts({
      name: "Chamomile",
      slug: "chamomile",
      pregnancy_safe: false,
      nursing_safe: false,
      contraindications: ["Pregnancy", "Ragweed allergy"],
      dosage_adult: "1-2 cups tea daily",
    });
    expect(conflicts).toEqual([]);
  });
});
