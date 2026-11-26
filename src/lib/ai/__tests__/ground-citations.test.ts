import { describe, expect, it } from "vitest";
import {
  buildVerifiedSourcesFooter,
  collectAllowedPmids,
  sanitizeUnverifiedPmids,
} from "../ground-citations";
import type { VerifiedContext } from "../context/types";

const SAMPLE_CONTEXT: VerifiedContext = {
  source: "database",
  note: "HerbAlly DB",
  medicationsMentioned: ["Warfarin"],
  interactions: [],
  herbs: [
    {
      slug: "ginger",
      name: "Ginger",
      scientific_name: "Zingiber officinale",
      description: "Rhizome.",
      traditional_uses: [],
      modern_uses: [],
      contraindications: [],
      side_effects: [],
      drug_interactions: [],
      dosage_adult: "500 mg",
      pregnancy_safe: null,
      nursing_safe: null,
      pregnancy_safe_oral: null,
      pregnancy_safe_topical: null,
      nursing_safe_oral: null,
      nursing_safe_topical: null,
      evidence_level: "A",
      active_compounds: [],
      provenance_method: "primary_source",
      regulatory: {
        source: "Health Canada LNHPD",
        purposes: [],
        doses: [],
        risks: [],
        urls: ["https://health-products.canada.ca/lnhpd-bdpsnh/"],
      },
      monographs: [
        {
          source: "EMA HMPC",
          licence: "EMA",
          claims: [],
          safety: [],
          doses: [],
          url: "https://www.ema.europa.eu/",
        },
      ],
      information_sheet: {
        summary: "Summary",
        traditional_uses: null,
        dosage: null,
        safety: null,
        pregnancy: null,
        drug_interactions: null,
        article_count: 2,
        pmids: ["16097960", "32478963"],
      },
    },
  ],
};

describe("ground-citations", () => {
  it("strips unverified hallucinated PMIDs and preserves database-backed PMIDs", () => {
    const allowed = collectAllowedPmids(SAMPLE_CONTEXT);
    const input =
      "See PMID:16097960 and https://pubmed.ncbi.nlm.nih.gov/99999999/ plus PMID 88888888.";
    const out = sanitizeUnverifiedPmids(input, allowed, "en");
    expect(out).toContain("PMID:16097960");
    expect(out).not.toContain("99999999");
    expect(out).not.toContain("88888888");
    expect(out).toContain("[unverified PubMed reference — confirm on PubMed]");
  });

  it("builds a deterministic HerbAlly database sources footer", () => {
    const footer = buildVerifiedSourcesFooter(SAMPLE_CONTEXT, "en");
    expect(footer).toContain("### HerbAlly Database Records Referenced");
    expect(footer).toContain("[HerbAlly: Ginger](/herbs/ginger)");
    expect(footer).toContain("[Health Canada LNHPD]");
    expect(footer).toContain("[EMA HMPC]");
    expect(footer).toContain(
      "[PMID 16097960](https://pubmed.ncbi.nlm.nih.gov/16097960/)"
    );
  });
});
