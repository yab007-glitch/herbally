import { describe, expect, it } from "vitest";
import { aggregateMedications } from "../medications";
import type { InteractionPair } from "../pairs";

function makePair(overrides: Partial<InteractionPair>): InteractionPair {
  return {
    id: overrides.id ?? "p-1",
    herbSlug: overrides.herbSlug ?? "ginger",
    herbName: overrides.herbName ?? "Ginger",
    herbScientificName: overrides.herbScientificName ?? "Zingiber officinale",
    drugName: overrides.drugName ?? "Warfarin (Coumadin)",
    localizedDrugName: overrides.localizedDrugName,
    drugSlug: overrides.drugSlug ?? "warfarin",
    severity: overrides.severity ?? "moderate",
    description: overrides.description ?? "May increase bleeding risk.",
    mechanism: overrides.mechanism ?? "Antiplatelet effect",
    evidenceLevel: overrides.evidenceLevel ?? "clinical",
    source: overrides.source ?? "NCCIH",
    sourceUrl: overrides.sourceUrl ?? "https://nccih.nih.gov",
    evidenceNote: overrides.evidenceNote ?? null,
    updatedAt: overrides.updatedAt ?? "2026-11-18T00:00:00.000Z",
    hasFr: overrides.hasFr ?? true,
  };
}

describe("aggregateMedications", () => {
  it("groups interactions by drugSlug, computes severity counts, and sorts herbs by severity", () => {
    const pairs: InteractionPair[] = [
      makePair({
        id: "1",
        herbSlug: "chamomile",
        herbName: "Chamomile",
        severity: "mild",
        updatedAt: "2026-10-01T00:00:00.000Z",
      }),
      makePair({
        id: "2",
        herbSlug: "st-johns-wort",
        herbName: "St. John's Wort",
        severity: "contraindicated",
        drugName: "Warfarin (Coumadin)",
        updatedAt: "2026-11-19T00:00:00.000Z",
      }),
      makePair({
        id: "3",
        herbSlug: "ginkgo-biloba",
        herbName: "Ginkgo",
        severity: "severe",
        drugName: "Warfarin",
        hasFr: false,
      }),
      makePair({
        id: "4",
        herbSlug: "st-johns-wort",
        herbName: "St. John's Wort",
        drugName: "Sertraline (Zoloft)",
        drugSlug: "sertraline",
        severity: "contraindicated",
      }),
    ];

    const grouped = aggregateMedications(pairs);
    expect(grouped.size).toBe(2);

    const warfarin = grouped.get("warfarin")!;
    expect(warfarin.totalInteractions).toBe(3);
    expect(warfarin.drugName).toBe("Warfarin (Coumadin)");
    expect(warfarin.highestSeverity).toBe("contraindicated");
    expect(warfarin.countsBySeverity).toEqual({
      contraindicated: 1,
      severe: 1,
      moderate: 0,
      mild: 1,
    });
    expect(warfarin.hasFr).toBe(true);
    expect(warfarin.updatedAt).toBe("2026-11-19T00:00:00.000Z");
    expect(warfarin.interactions.map((i) => i.herbSlug)).toEqual([
      "st-johns-wort",
      "ginkgo-biloba",
      "chamomile",
    ]);
    expect(warfarin.sampleHerbs.map((h) => h.slug)).toEqual([
      "st-johns-wort",
      "ginkgo-biloba",
      "chamomile",
    ]);
  });

  it("prefers localizedDrugName when present", () => {
    const grouped = aggregateMedications([
      makePair({
        drugName: "Warfarin (Coumadin)",
        localizedDrugName: "Warfarine (Coumadin)",
        drugSlug: "warfarin",
      }),
    ]);

    const med = grouped.get("warfarin")!;
    expect(med.drugName).toBe("Warfarine (Coumadin)");
    expect(med.enDrugName).toBe("Warfarin (Coumadin)");
  });

  it("disambiguates thiazide-and-loop-diuretics from diuretics in French", () => {
    const grouped = aggregateMedications([
      makePair({
        id: "d-1",
        drugName: "Diuretics (Furosemide, Hydrochlorothiazide)",
        localizedDrugName: "Diurétiques hypokaliémiants",
        drugSlug: "diuretics",
      }),
      makePair({
        id: "d-2",
        drugName: "Thiazide and Loop Diuretics",
        localizedDrugName: "Diurétiques hypokaliémiants",
        drugSlug: "thiazide-and-loop-diuretics",
      }),
    ]);

    expect(grouped.get("diuretics")?.drugName).toBe(
      "Diurétiques hypokaliémiants"
    );
    expect(grouped.get("thiazide-and-loop-diuretics")?.drugName).toBe(
      "Diurétiques thiazidiques et de l'anse"
    );
  });
});
