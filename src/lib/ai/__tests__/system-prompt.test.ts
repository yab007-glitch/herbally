import { describe, it, expect } from "vitest";
import { getSystemPrompt } from "../system-prompt";
import type { VerifiedContext, VerifiedHerb } from "../context-fetcher";

/** A herb carrying every optional record the fetcher can attach. */
function herb(overrides: Partial<VerifiedHerb> = {}): VerifiedHerb {
  return {
    slug: "sideritis",
    name: "Sideritis",
    scientific_name: "Sideritis scardica",
    description: "Mountain tea.",
    traditional_uses: ["colds"],
    modern_uses: [],
    contraindications: [],
    side_effects: [],
    drug_interactions: [],
    dosage_adult: null,
    pregnancy_safe: null,
    nursing_safe: null,
    pregnancy_safe_oral: null,
    pregnancy_safe_topical: null,
    nursing_safe_oral: null,
    nursing_safe_topical: null,
    evidence_level: "Traditional",
    active_compounds: [],
    provenance_method: "primary_source",
    regulatory: null,
    monographs: [],
    information_sheet: null,
    ...overrides,
  };
}

function context(herbs: VerifiedHerb[]): VerifiedContext {
  return {
    herbs,
    interactions: [],
    medicationsMentioned: [],
    source: "database",
    note: "Retrieved 1 herb profile(s) from the HerbAlly database.",
  };
}

describe("getSystemPrompt", () => {
  it("renders the regulator record as primary source", () => {
    const prompt = getSystemPrompt(
      null,
      [],
      "en",
      context([
        herb({
          regulatory: {
            source: "Health Canada LNHPD",
            purposes: ["Traditionally used to relieve colds"],
            doses: ["Adults: 1-2 g"],
            risks: ["Consult a health care practitioner if symptoms persist"],
            urls: ["https://open.canada.ca/data/en/dataset/example"],
          },
        }),
      ])
    );

    expect(prompt).toContain("Regulator record — Health Canada LNHPD");
    expect(prompt).toContain("Traditionally used to relieve colds");
    expect(prompt).toContain("Adults: 1-2 g");
    expect(prompt).toContain("Consult a health care practitioner");
  });

  it("renders an imported monograph and forbids denying it exists", () => {
    // The live failure: the model said "the EMA does not have a finalized HMPC
    // monograph for Sideritis scardica" while this row was in the database.
    const prompt = getSystemPrompt(
      null,
      [],
      "en",
      context([
        herb({
          monographs: [
            {
              source: "European Medicines Agency (HMPC)",
              licence: "EMA/HMPC/123",
              claims: ["Traditional herbal medicinal product for cough"],
              safety: ["Not recommended under 18 years"],
              doses: ["2-4 g as an infusion"],
              url: "https://www.ema.europa.eu/example.pdf",
            },
          ],
        }),
      ])
    );

    expect(prompt).toContain("Regulator monograph — European Medicines Agency");
    expect(prompt).toContain("EMA/HMPC/123");
    expect(prompt).toContain("Traditional herbal medicinal product for cough");
    expect(prompt).toContain("Not recommended under 18 years");
    expect(prompt).toContain(
      "NEVER say the source has no monograph, no record, or no position"
    );
  });

  it("labels the compiled information sheet as derived, not regulator text", () => {
    const prompt = getSystemPrompt(
      null,
      [],
      "en",
      context([
        herb({
          information_sheet: {
            summary: "A culinary spice.",
            traditional_uses: "Used for colds.",
            dosage: "1 g daily.",
            safety: null,
            pregnancy: null,
            drug_interactions: null,
            article_count: 18,
            pmids: ["12345678"],
          },
        }),
      ])
    );

    expect(prompt).toContain("Compiled information sheet");
    expect(prompt).toContain("derived, not a regulator's text");
    expect(prompt).toContain("compiled from 18 articles");
    expect(prompt).toContain("PMIDs on record: 12345678");
    // A monograph or regulator record outranks the sheet on conflict.
    expect(prompt).toContain(
      "let a regulator monograph or regulator record win"
    );
  });
});
