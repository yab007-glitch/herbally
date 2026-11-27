import { describe, expect, it } from "vitest";
import {
  buildConsultationBriefJson,
  formatConsultationBriefText,
} from "../consultation-brief";
import {
  computeStackAlerts,
  highestSeverityOf,
  sortStackMatches,
  type StackMatchItem,
} from "../stack";

function match(overrides: Partial<StackMatchItem>): StackMatchItem {
  return {
    herbInput: "Ginger",
    herbSlug: "ginger",
    herbName: "Ginger",
    drugInput: "warfarin",
    drugName: "Warfarin (Coumadin)",
    drugSlug: "warfarin",
    severity: "moderate",
    description: "May increase bleeding risk with anticoagulants.",
    mechanism: "Additive antiplatelet activity.",
    evidenceLevel: "moderate-evidence",
    source: "NCCIH",
    sourceUrl: "https://www.nccih.nih.gov/health/ginger",
    pairUrl: "/interactions/ginger/warfarin",
    ...overrides,
  };
}

describe("stack helpers and 7-class overlap engine", () => {
  it("sorts matches worst severity first", () => {
    const sorted = sortStackMatches([
      match({ herbName: "Valerian", severity: "mild" }),
      match({ herbName: "St. John's Wort", severity: "contraindicated" }),
      match({ herbName: "Garlic", severity: "severe" }),
    ]);
    expect(sorted.map((m) => m.severity)).toEqual([
      "contraindicated",
      "severe",
      "mild",
    ]);
    expect(highestSeverityOf(sorted)).toBe("contraindicated");
  });

  it("flags cumulative bleeding risk across two or more distinct herbs", () => {
    const alerts = computeStackAlerts(
      [
        match({ herbName: "Garlic", herbSlug: "garlic" }),
        match({ herbName: "Ginkgo", herbSlug: "ginkgo-biloba" }),
      ],
      "en"
    );
    expect(alerts.some((a) => a.code === "bleeding_overlap")).toBe(true);

    const doacAlerts = computeStackAlerts(
      [
        match({
          herbName: "Garlic",
          herbSlug: "garlic",
          drugName: "Rivaroxaban (Xarelto)",
          drugSlug: "rivaroxaban",
          description: "Potential additive bleeding signal.",
          mechanism: "Antiplatelet effect.",
        }),
        match({
          herbName: "Ginkgo Biloba",
          herbSlug: "ginkgo-biloba",
          drugName: "Dabigatran (Pradaxa)",
          drugSlug: "dabigatran",
          description: "Potential additive bruising.",
          mechanism: "Mild antiplatelet signal.",
        }),
      ],
      "en"
    );
    expect(doacAlerts.some((a) => a.code === "bleeding_overlap")).toBe(true);
  });

  it("detects serotonin, qt_cardiac, hepatotoxicity, hypoglycemia, sedation, and cyp_enzyme overlaps", () => {
    const cases: Array<{
      code: string;
      severity: "severe" | "moderate";
      items: [StackMatchItem, StackMatchItem];
    }> = [
      {
        code: "serotonin_overlap",
        severity: "severe",
        items: [
          match({
            herbName: "St. John's Wort",
            drugName: "Sertraline (SSRI)",
            description: "Serotonergic potentiation.",
            mechanism: "Serotonin reuptake inhibition.",
          }),
          match({
            herbName: "5-HTP / Griffonia",
            drugName: "Fluoxetine (SSRI)",
            description: "Raises CNS serotonin risk.",
            mechanism: "Direct serotonin precursor.",
          }),
        ],
      },
      {
        code: "qt_cardiac_overlap",
        severity: "severe",
        items: [
          match({
            herbName: "Licorice",
            drugName: "Digoxin",
            description: "Hypokalemia increases digoxin arrhythmia risk.",
            mechanism: "Renal potassium wasting.",
          }),
          match({
            herbName: "Senna",
            drugName: "Amiodarone",
            description: "Electrolyte loss may promote QT prolongation.",
            mechanism: "Hypokalemia.",
          }),
        ],
      },
      {
        code: "hepatotoxicity_overlap",
        severity: "moderate",
        items: [
          match({
            herbName: "Kava",
            drugName: "Acetaminophen",
            description: "Additive hepatic injury risk.",
            mechanism: "Depletes liver glutathione.",
          }),
          match({
            herbName: "Green Tea Extract",
            drugName: "Atorvastatin",
            description: "May elevate liver transaminases.",
            mechanism: "Hepatotoxicity.",
          }),
        ],
      },
      {
        code: "hypoglycemia_overlap",
        severity: "moderate",
        items: [
          match({
            herbName: "Fenugreek",
            drugName: "Metformin",
            description: "May lower blood sugar further.",
            mechanism: "Additive glucose lowering.",
          }),
          match({
            herbName: "Bitter Melon",
            drugName: "Insulin",
            description: "Additive hypoglycemia risk.",
            mechanism: "Insulin sensitization.",
          }),
        ],
      },
      {
        code: "sedation_overlap",
        severity: "moderate",
        items: [
          match({
            herbName: "Valerian",
            drugName: "Lorazepam",
            description: "Increases drowsiness and CNS depression.",
            mechanism: "GABA modulation.",
          }),
          match({
            herbName: "Passionflower",
            drugName: "Zolpidem",
            description: "Additive sedation.",
            mechanism: "CNS depressant overlap.",
          }),
        ],
      },
      {
        code: "cyp_enzyme_overlap",
        severity: "moderate",
        items: [
          match({
            herbName: "Goldenseal",
            drugName: "Cyclosporine",
            description: "Alters drug metabolism.",
            mechanism: "Potent CYP3A4 and CYP2D6 inhibition.",
          }),
          match({
            herbName: "Schisandra",
            drugName: "Tacrolimus",
            description: "Raises exposure.",
            mechanism: "OATP1B1 and UGT modulation.",
          }),
        ],
      },
    ];

    for (const c of cases) {
      for (const loc of ["en", "fr"] as const) {
        const alerts = computeStackAlerts(c.items, loc);
        const hit = alerts.find((a) => a.code === c.code);
        expect(hit).toBeDefined();
        expect(hit?.severity).toBe(c.severity);
        expect(hit?.herbs).toHaveLength(2);
      }
    }
  });

  it("formats local consultation brief in text and JSON with clear non-validated boundary", () => {
    const matches = [match({ herbName: "Ginger" })];
    const alerts = computeStackAlerts(
      [...matches, match({ herbName: "Garlic", herbSlug: "garlic" })],
      "en"
    );
    const input = {
      checkedAt: "2026-11-27T20:00:00.000Z",
      locale: "en" as const,
      herbs: [
        {
          input: "Ginger",
          found: true,
          slug: "ginger",
          name: "Ginger",
          scientificName: "Zingiber officinale",
          pairCount: 4,
        },
      ],
      drugs: ["Warfarin"],
      summary: {
        totalCombinations: 1,
        matchedCount: 1,
        unrecordedCount: 0,
        highestSeverity: "moderate" as const,
      },
      matches,
      unrecorded: [],
      stackAlerts: alerts,
    };

    const txt = formatConsultationBriefText(input, "en");
    expect(txt).toContain("NOT CLINICIAN-VALIDATED");
    expect(txt).toContain("never uploaded to HerbAlly servers");
    expect(txt).toContain(
      "Absence of a recorded interaction does NOT mean safe"
    );

    const json = buildConsultationBriefJson(input, "fr");
    expect(json.generatedClientSide).toBe(true);
    expect(json.validationStatus).toBe(
      "EDUCATIONAL_SCREENING_SUMMARY_NOT_CLINICIAN_VALIDATED"
    );
    expect(json.importantSafetyNotice).toContain("non validé par un clinicien");
  });
});
