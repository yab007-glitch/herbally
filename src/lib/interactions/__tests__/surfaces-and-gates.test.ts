import { describe, expect, it } from "vitest";
import { planImport } from "../../../../scripts/interactions/import";
import { validatePair } from "../../../../scripts/interactions/validate";
import { checkInteractionPublicationContract } from "@/lib/db/verify-rules";
import { selectSitemapPairEntries } from "../pair-url";
import { hasCompleteInteractionFrParity } from "../pairs";

describe("interaction expansion freeze & publication validation gates", () => {
  it("hard-stops inserting new unapproved interaction pairs during expansion freeze unless governance flag is enabled", () => {
    const plan = planImport(
      [
        {
          path: "new-pair.json",
          herbSlug: "turmeric",
          pairs: [
            {
              drug_name: "Apixaban",
              severity: "moderate",
              description:
                "May increase systemic exposure and bleeding risk via altered platelet aggregation.",
              mechanism:
                "Additive antiplatelet pharmacodynamic effect alongside possible CYP modulation.",
              evidence_level: "limited-evidence",
              source: "NCCIH",
              source_url: "https://nccih.nih.gov/health/turmeric",
              source_licence: "us-federal-public-domain",
            },
          ],
        },
      ],
      {
        publishedHerbSlugs: new Set(["turmeric"]),
        existingByHerb: new Map(),
        allowExpansion: false,
      }
    );

    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0].code).toBe("EXPANSION_FROZEN");
  });

  it("flags class rows carrying single-ingredient RxCUIs and unreviewed published records", () => {
    const issues = checkInteractionPublicationContract([
      {
        id: "ix-1",
        drugName: "Anticoagulants (Class)",
        isDrugClass: true,
        singleIngredientRxcui: "11289",
        publicationStatus: "published",
        clinicalReviewerId: null,
        verifiedAt: null,
        activeCitationCount: 0,
      },
    ]);
    expect(issues.some((i) => i.code === "CLASS_ROW_HAS_SINGLE_RXCUI")).toBe(
      true
    );
    expect(issues.some((i) => i.code === "PUBLISHED_WITHOUT_REVIEW")).toBe(
      true
    );
    expect(issues.some((i) => i.code === "PUBLISHED_WITHOUT_CITATION")).toBe(
      true
    );
  });

  it("requires complete clinical French fields (drug_name, description, and mechanism when present) before FR sitemap indexing", () => {
    expect(
      hasCompleteInteractionFrParity({
        mechanism: "CYP3A4 induction",
        translations: {
          fr: { drug_name: "Warfarine", description: "Diminue l'effet." },
        },
      })
    ).toBe(false);

    expect(
      hasCompleteInteractionFrParity({
        mechanism: "CYP3A4 induction",
        translations: {
          fr: {
            drug_name: "Warfarine",
            description: "Diminue l'effet.",
            mechanism: "Induction du CYP3A4.",
          },
        },
      })
    ).toBe(true);
  });

  it("excludes unpublished or unreviewed interaction pairs from sitemap entries", () => {
    const entries = selectSitemapPairEntries([
      {
        herbSlug: "ginger",
        drugName: "Warfarin",
        updatedAt: "2026-11-20T00:00:00Z",
        hasFr: true,
        publicationStatus: "legacy_unreviewed",
      },
      {
        herbSlug: "turmeric",
        drugName: "Aspirin",
        updatedAt: "2026-11-20T00:00:00Z",
        hasFr: false,
        publicationStatus: "published",
      },
      {
        herbSlug: "ginkgo",
        drugName: "Apixaban",
        updatedAt: "2026-11-20T00:00:00Z",
        hasFr: false,
        publicationStatus: "retracted_hold",
      },
    ]);
    expect(entries).toEqual([
      {
        path: "/interactions/turmeric/aspirin",
        hasFr: false,
        updatedAt: "2026-11-20T00:00:00Z",
      },
    ]);
  });

  it("rejects class rows carrying single-ingredient RxCUIs and unapproved publication claims in validatePair", () => {
    const classResult = validatePair(
      {
        drug_name: "Anticoagulants (Class)",
        rxcui: "11289",
        is_drug_class: true,
        severity: "moderate",
        description:
          "May increase systemic exposure and bleeding risk when combined.",
        mechanism:
          "Additive antiplatelet pharmacodynamic effect alongside possible CYP modulation.",
        evidence_level: "limited-evidence",
        source: "NCCIH",
        source_url: "https://nccih.nih.gov/health/turmeric",
        source_licence: "us-federal-public-domain",
      } as Parameters<typeof validatePair>[0],
      {
        herbSlug: "turmeric",
        publishedHerbSlugs: new Set(["turmeric"]),
        acceptedPairKeys: new Set(),
      }
    );
    expect(classResult.ok).toBe(false);
    if (!classResult.ok) {
      expect(classResult.code).toBe("CLASS_ROW_HAS_SINGLE_RXCUI");
    }

    const pubResult = validatePair(
      {
        drug_name: "Apixaban",
        publication_status: "published",
        severity: "moderate",
        description:
          "May increase systemic exposure and bleeding risk when combined.",
        mechanism:
          "Additive antiplatelet pharmacodynamic effect alongside possible CYP modulation.",
        evidence_level: "limited-evidence",
        source: "NCCIH",
        source_url: "https://nccih.nih.gov/health/turmeric",
        source_licence: "us-federal-public-domain",
      } as Parameters<typeof validatePair>[0],
      {
        herbSlug: "turmeric",
        publishedHerbSlugs: new Set(["turmeric"]),
        acceptedPairKeys: new Set(),
      }
    );
    expect(pubResult.ok).toBe(false);
    if (!pubResult.ok) {
      expect(pubResult.code).toBe("PUBLICATION_GATE_FAILED");
    }
  });
});
