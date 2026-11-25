import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => ({
    from: fromMock,
  }),
}));

import { attachRegulatorRecords } from "../context/regulator-records";
import { fetchVerifiedContext } from "../context-fetcher";
import { parseCommand } from "@/components/pharmacist/chat-helpers";
import type { VerifiedHerb } from "../context/types";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AI RAG pediatric & dangerous-herb dose filtering", () => {
  it("strips pediatric doses and blocked dangerous-herb doses from regulator/monograph/PubMed context", async () => {
    fromMock.mockImplementation((table: string) => {
      if (
        table === "herb_regulatory_evidence" ||
        table === "herb_regulatory_evidence_public"
      ) {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  herb_slug: "chamomile",
                  source: "Health Canada LNHPD",
                  purposes: ["Traditionally used to calm nerves"],
                  doses: [
                    {
                      population: "Adults",
                      age_minimum: 18,
                      text: "2 to 4 g dried flower daily",
                    },
                    {
                      population: "Children 2-12 years",
                      age_minimum: 2,
                      text: "1 g dried flower",
                    },
                    {
                      population: "Infants",
                      age_minimum: 0,
                      text: "150 mg tea",
                    },
                  ],
                  risks: ["Keep out of reach of children"],
                  source_urls: [
                    "https://health-products.canada.ca/lnhpd-bdpsnh",
                  ],
                },
                {
                  herb_slug: "aconite-processed",
                  source: "Health Canada LNHPD",
                  purposes: ["Toxic poison record"],
                  doses: [
                    { population: "Adults", age_minimum: 18, text: "100 mg" },
                  ],
                  risks: ["Fatal cardiotoxicity"],
                  source_urls: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (
        table === "herb_monograph_sources" ||
        table === "herb_monograph_sources_public"
      ) {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  herb_slug: "chamomile",
                  source: "EMA HMPC",
                  licence: "Public",
                  claims: ["Relief of mild gastrointestinal symptoms"],
                  safety: ["Do not use in children under 12 without advice"],
                  doses: [
                    "Adults: 3 g infusion 3 times daily",
                    "Children 6 to 12 years: 1.5 g twice daily",
                  ],
                  url: "https://www.ema.europa.eu",
                  monograph_date: "2020-01-01",
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (
        table === "herb_pubmed_monographs" ||
        table === "herb_pubmed_monographs_public"
      ) {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  slug: "chamomile",
                  content: {
                    summary: "Chamomile summary.",
                    dosageAndAdministration:
                      "Adults: 500 mg capsule twice daily. Pediatric dosage for children 6-12 years: 200 mg twice daily.",
                    safetyAndPrecautions: "Consult a clinician if pregnant.",
                  },
                  pmids: ["12345678"],
                  article_count: 1,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({ in: async () => ({ data: [], error: null }) }),
      };
    });

    const chamomile: VerifiedHerb = {
      slug: "chamomile",
      name: "Chamomile",
      scientific_name: "Matricaria chamomilla",
      description: "",
      traditional_uses: [],
      modern_uses: [],
      contraindications: [],
      side_effects: [],
      drug_interactions: [],
      dosage_adult: "3 g daily",
      pregnancy_safe: null,
      nursing_safe: null,
      pregnancy_safe_oral: null,
      pregnancy_safe_topical: null,
      nursing_safe_oral: null,
      nursing_safe_topical: null,
      evidence_level: "B",
      active_compounds: [],
      provenance_method: "manual",
      regulatory: null,
      monographs: [],
      information_sheet: null,
    };

    const aconite: VerifiedHerb = {
      ...chamomile,
      slug: "aconite-processed",
      name: "Aconite",
      scientific_name: "Aconitum carmichaelii",
      dosage_adult: "100 mg",
    };

    await attachRegulatorRecords([chamomile, aconite]);

    expect(chamomile.regulatory?.doses).toEqual([
      "Adults: 2 to 4 g dried flower daily",
    ]);
    expect(chamomile.regulatory?.risks).toEqual([
      "Keep out of reach of children",
    ]);
    expect(chamomile.monographs[0].doses).toEqual([
      "Adults: 3 g infusion 3 times daily",
    ]);
    expect(chamomile.information_sheet?.dosage).not.toMatch(
      /Pediatric dosage|200 mg/i
    );

    expect(aconite.regulatory?.doses).toEqual([]);
    expect(aconite.monographs).toEqual([]);
  });

  it("omits dosage_child and strips doses for dangerous herbs in fetchVerifiedContext", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "herbs" || table === "herbs_public") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        name: "Aconite",
                        scientific_name: "Aconitum",
                        slug: "aconite-processed",
                        translations: {},
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
            or: () => ({
              eq: () => ({
                limit: async () => ({
                  data: [
                    {
                      slug: "aconite-processed",
                      name: "Aconite",
                      scientific_name: "Aconitum",
                      description: "Toxic root",
                      traditional_uses: [],
                      modern_uses: [],
                      contraindications: ["Cardiotoxic"],
                      side_effects: [],
                      drug_interactions: [],
                      dosage_adult: "100 mg",
                      dosage_child: "25 mg",
                      pregnancy_safe: false,
                      nursing_safe: false,
                      evidence_level: "D",
                      active_compounds: [],
                      provenance: { verification_method: "manual" },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: async () => ({ data: [], error: null }),
          or: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    const ctx = await fetchVerifiedContext(
      "Tell me about aconite",
      null,
      [],
      "en"
    );
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("dosage_child");
    expect(serialized).not.toContain("25 mg");
    expect(ctx.herbs[0]?.dosage_adult).toBeNull();
  });

  it("rewrites /calculator slash command so no model is prompted to ask for child age or weight", () => {
    const cmd = parseCommand("/calculator");
    expect(cmd.command).toBe("calculator");
    expect(cmd.systemContext).not.toMatch(
      /asking about the herb name, patient age, weight/i
    );
    expect(cmd.systemContext).toMatch(
      /18\+|never collect|do not calculate|adult reference/i
    );
  });

  it("preserves adult doses for non-dangerous calculator-blocked herbs (senna-leaf) and avoids select(*)", async () => {
    const selectArgs: string[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "herbs" || table === "herbs_public") {
        return {
          select: (cols: string) => {
            selectArgs.push(cols);
            return {
              eq: () => ({
                or: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: [
                        {
                          name: "Senna",
                          scientific_name: "Senna alexandrina",
                          slug: "senna-leaf",
                          translations: {},
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
              or: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [
                      {
                        slug: "senna-leaf",
                        name: "Senna",
                        scientific_name: "Senna alexandrina",
                        description: "Stimulant laxative",
                        traditional_uses: [],
                        modern_uses: [],
                        contraindications: [],
                        side_effects: [],
                        drug_interactions: [],
                        dosage_adult:
                          "Adults: 15-30 mg at bedtime. Children 2-11: 7.5 mg.",
                        pregnancy_safe: false,
                        nursing_safe: false,
                        evidence_level: "B",
                        active_compounds: [],
                        provenance: { verification_method: "manual" },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      if (
        table === "herb_regulatory_evidence" ||
        table === "herb_regulatory_evidence_public"
      ) {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  herb_slug: "senna-leaf",
                  source: "Health Canada LNHPD",
                  purposes: ["Short-term constipation relief"],
                  doses: [
                    {
                      population: "Adults",
                      age_minimum: 18,
                      text: "15-30 mg daily",
                    },
                    {
                      population: "Children",
                      age_minimum: 2,
                      text: "7.5 mg daily",
                    },
                  ],
                  risks: ["Keep out of reach of children"],
                  source_urls: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: async () => ({ data: [], error: null }),
          or: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      };
    });

    const ctx = await fetchVerifiedContext(
      "Tell me about senna",
      null,
      [],
      "en"
    );
    expect(selectArgs.some((c) => /(?:^|,)\s*\*\s*(?:,|$)/.test(c))).toBe(
      false
    );
    expect(selectArgs.some((c) => c.includes("dosage_child"))).toBe(false);
    expect(ctx.herbs[0]?.dosage_adult).toContain("15-30 mg");
    expect(ctx.herbs[0]?.dosage_adult).not.toContain("7.5 mg");
    expect(ctx.herbs[0]?.regulatory?.doses).toEqual(["Adults: 15-30 mg daily"]);
  });

  it("sanitizes monograph_sources claims/safety and regulatory purposes/risks in attachRegulatorRecords (senna & fennel)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "herb_regulatory_evidence_public") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  herb_slug: "fennel",
                  source: "Health Canada",
                  purposes: [
                    "Relieve digestive upset in adults. Children 4-11 years: 1.0 g daily.",
                  ],
                  doses: [
                    {
                      text: "Adults and adolescents: 1.5 g crushed fennel fruit; children 4-12 years: 1.0 g daily.",
                      population: "Adults and adolescents",
                      age_minimum: 12,
                    },
                  ],
                  risks: [
                    "Fennel oil not for infants or children under 4 years.",
                    "Give a 5-year-old 250 mg; toxic in overdose.",
                  ],
                  source_urls: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "herb_monograph_sources_public") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  herb_slug: "fennel",
                  source: "European Medicines Agency (HMPC)",
                  licence: "EMA",
                  claims: [
                    {
                      section: "4.1 Therapeutic indications",
                      text: "Symptomatic treatment of bloating. For children 4-11 years: give 1 g.",
                    },
                  ],
                  safety: [
                    "Contraindicated in children under 4 years.",
                    "Never give children 5 ml; give 10 ml.",
                  ],
                  doses: [
                    "Adults and adolescents: 1.5 g three times daily; children 4-12 years: 1.0 g three times daily.",
                  ],
                  url: "https://www.ema.europa.eu",
                  monograph_date: "2024-01-01",
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({ in: async () => ({ data: [], error: null }) }),
      };
    });

    const fennel: VerifiedHerb = {
      slug: "fennel",
      name: "Fennel",
      scientific_name: "Foeniculum vulgare",
      description: "",
      traditional_uses: [],
      modern_uses: [],
      contraindications: [],
      side_effects: [],
      drug_interactions: [],
      dosage_adult: "1.5 g 3x daily",
      pregnancy_safe: null,
      nursing_safe: null,
      pregnancy_safe_oral: null,
      pregnancy_safe_topical: null,
      nursing_safe_oral: null,
      nursing_safe_topical: null,
      evidence_level: "B",
      active_compounds: [],
      provenance_method: "manual",
      regulatory: null,
      monographs: [],
      information_sheet: null,
    };

    await attachRegulatorRecords([fennel]);

    expect(fennel.regulatory?.purposes[0]).not.toContain("1.0 g");
    expect(fennel.regulatory?.risks[0]).toContain(
      "Fennel oil not for infants or children under 4 years."
    );
    expect(fennel.regulatory?.risks[1]).not.toContain("250 mg");
    expect(fennel.monographs[0]?.claims[0]).not.toContain("1 g");
    expect(fennel.monographs[0]?.safety[0]).toContain(
      "Contraindicated in children under 4 years."
    );
    expect(fennel.monographs[0]?.safety[1]).not.toContain("10 ml");
    expect(fennel.monographs[0]?.doses[0]).toContain("1.5 g");
    expect(fennel.monographs[0]?.doses[0]).not.toContain("1.0 g");
  });

  it("sanitizes alternative PubMed dose keys (dosage, recommendedDosage, dosage_and_administration) in attachRegulatorRecords", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "herb_pubmed_monographs_public") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  slug: "chamomile",
                  content: {
                    summary: "Chamomile summary.",
                    recommendedDosage:
                      "Adults 18 years and older: 400 mg daily. Children 6-18 years: 100 mg daily.",
                  },
                  pmids: ["99999"],
                  article_count: 1,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({ in: async () => ({ data: [], error: null }) }),
      };
    });

    const chamomile: VerifiedHerb = {
      slug: "chamomile",
      name: "Chamomile",
      scientific_name: "Matricaria chamomilla",
      description: "",
      traditional_uses: [],
      modern_uses: [],
      contraindications: [],
      side_effects: [],
      drug_interactions: [],
      dosage_adult: "400 mg daily",
      pregnancy_safe: null,
      nursing_safe: null,
      pregnancy_safe_oral: null,
      pregnancy_safe_topical: null,
      nursing_safe_oral: null,
      nursing_safe_topical: null,
      evidence_level: "B",
      active_compounds: [],
      provenance_method: "manual",
      regulatory: null,
      monographs: [],
      information_sheet: null,
    };

    await attachRegulatorRecords([chamomile]);
    expect(chamomile.information_sheet?.dosage).toBe(
      "Adults 18 years and older: 400 mg daily."
    );
  });
});
