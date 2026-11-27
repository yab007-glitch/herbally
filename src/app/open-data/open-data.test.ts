import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { mockStats, mockMedications, mockInteractions } = vi.hoisted(() => ({
  mockStats: {
    available: true,
    generatedAt: "2026-11-27T00:00:00.000Z",
    totalHerbs: 3122,
    sourceCheckedHerbs: 3089,
    clinicallyReviewedHerbs: 0,
    totalInteractions: 509,
    totalMedications: 142,
    clinicianApprovedInteractions: 0,
    legacyUnreviewedInteractions: 509,
    corrections: [],
  },
  mockMedications: [
    {
      drugSlug: "warfarin",
      drugName: "Warfarin (Coumadin)",
      enDrugName: "Warfarin (Coumadin)",
      totalInteractions: 36,
      publishedCount: 0,
      legacyCount: 36,
      highestSeverity: "contraindicated" as const,
      countsBySeverity: {
        contraindicated: 8,
        severe: 12,
        moderate: 14,
        mild: 2,
      },
      sampleHerbs: [
        { slug: "turmeric", name: "Turmeric", severity: "severe" as const },
      ],
      hasFr: true,
      updatedAt: "2026-11-20T00:00:00.000Z",
    },
  ],
  mockInteractions: [
    {
      id: "ix-1",
      herbSlug: "turmeric",
      herbName: "Turmeric",
      herbScientificName: "Curcuma longa",
      drugName: "Warfarin (Coumadin)",
      drugSlug: "warfarin",
      severity: "severe" as const,
      description: "Additive antiplatelet effect may increase bleeding risk.",
      mechanism: "Antiplatelet / CYP2C9 modulation",
      evidenceLevel: "B",
      source: "NIH NCCIH / PubMed",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/34062109/",
      evidenceNote: null,
      updatedAt: "2026-11-20T00:00:00.000Z",
      hasFr: true,
      publicationStatus: "published",
      clinicalActionStatus: "blocked_legacy_unreviewed",
      evidenceTier: "clinical_trial" as const,
      extrapolationScope: "human_clinical" as const,
    },
    {
      id: "ix-retracted",
      herbSlug: "kava",
      herbName: "Kava",
      herbScientificName: "Piper methysticum",
      drugName: "Alprazolam",
      drugSlug: "alprazolam",
      severity: "severe" as const,
      description: "Withheld retracted citation",
      mechanism: null,
      evidenceLevel: "C",
      source: "Retracted source",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/99999/",
      evidenceNote: null,
      updatedAt: "2026-11-20T00:00:00.000Z",
      hasFr: false,
      publicationStatus: "retracted_hold",
      clinicalActionStatus: "blocked_legacy_unreviewed",
      evidenceTier: "case_series_or_case_report" as const,
      extrapolationScope: "unverified" as const,
    },
  ],
}));

vi.mock("@/lib/governance/coverage-stats", () => ({
  getGovernanceCoverageStats: vi.fn().mockResolvedValue(mockStats),
}));

vi.mock("@/lib/interactions/medications", () => ({
  getMedicationSummaries: vi.fn().mockResolvedValue(mockMedications),
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getInteractionPairs: vi.fn().mockResolvedValue(mockInteractions),
}));

import { GET as getCatalogJson } from "@/app/open-data/catalog.json/route";
import { GET as getInteractionsJson } from "@/app/open-data/interactions.json/route";
import { GET as getMedicationsJson } from "@/app/open-data/medications.json/route";
import { GET as getQuarantineJson } from "@/app/open-data/quarantine.json/route";
import { GET as getSchemaJson } from "@/app/open-data/schema.json/route";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";

describe("Open Botanical Safety Data Suite, OpenAPI Schema & WebApplicationSchema", () => {
  it("exports all dangerous herbs deterministically sorted by slug", () => {
    const records = getAllDangerousHerbs();
    expect(records.length).toBeGreaterThan(20);
    const slugs = records.map((r) => r.slug);
    expect(slugs).toContain("abrus-precatorius");
    expect([...slugs].sort((a, b) => a.localeCompare(b))).toEqual(slugs);
  });

  it("serves CORS-enabled /open-data/catalog.json with synced counts and all endpoint links", async () => {
    const res = await getCatalogJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      counts: Record<string, number>;
      endpoints: Record<string, string>;
    };
    expect(body.counts.publishedHerbs).toBe(3122);
    expect(body.counts.clinicianSignedInteractions).toBe(0);
    expect(body.counts.quarantinedToxicBotanicals).toBe(
      getAllDangerousHerbs().length
    );
    expect(body.endpoints.interactionsJson).toContain(
      "/open-data/interactions.json"
    );
    expect(body.endpoints.openApiSchemaJson).toContain(
      "/open-data/schema.json"
    );
    expect(body.endpoints.trustCenter).toContain("/trust");
  });

  it("serves CORS-enabled /open-data/medications.json with honest clinician review flags", async () => {
    const res = await getMedicationsJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      totalMedications: number;
      totalInteractionPairs: number;
      medications: Array<{
        drugSlug: string;
        url: string;
        urlFr: string;
        reviewStatus: string;
      }>;
    };
    expect(body.totalMedications).toBe(1);
    expect(body.totalInteractionPairs).toBe(36);
    expect(body.medications[0].url).toContain("/medications/warfarin");
    expect(body.medications[0].urlFr).toContain("/fr/medications/warfarin");
    expect(body.medications[0].reviewStatus).toBe("awaiting_clinical_review");
  });

  it("serves CORS-enabled /open-data/interactions.json excluding retracted records", async () => {
    const res = await getInteractionsJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      dataset: string;
      totalPairs: number;
      clinicianSignedPairs: number;
      interactions: Array<{
        id: string;
        clinicianSigned: boolean;
        sourceUrl: string | null;
        url: string;
      }>;
    };
    expect(body.dataset).toBe("herb_drug_interactions");
    expect(body.totalPairs).toBe(1);
    expect(body.clinicianSignedPairs).toBe(0);
    expect(body.interactions[0].id).toBe("ix-1");
    expect(body.interactions[0].clinicianSigned).toBe(false);
    expect(body.interactions[0].url).toContain(
      "/interactions/turmeric/warfarin"
    );
    expect(body.interactions[0].sourceUrl).toContain("pubmed.ncbi.nlm.nih.gov");
  });

  it("serves CORS-enabled /open-data/quarantine.json with Poison Control emergency numbers", async () => {
    const res = await getQuarantineJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      dataset: string;
      totalQuarantinedBotanicals: number;
      emergencyContacts: {
        usPoisonControl: string;
        canadaPoisonControl: string;
        emergency: string;
      };
      botanicals: Array<{ slug: string; quarantineStatus: string }>;
    };
    expect(body.dataset).toBe("toxic_botanical_quarantine");
    expect(body.totalQuarantinedBotanicals).toBe(getAllDangerousHerbs().length);
    expect(body.emergencyContacts.usPoisonControl).toBe("1-800-222-1222");
    expect(body.emergencyContacts.canadaPoisonControl).toBe("1-844-764-7669");
    expect(body.emergencyContacts.emergency).toBe("911");
    expect(
      body.botanicals.find((b) => b.slug === "abrus-precatorius")
        ?.quarantineStatus
    ).toBe("permanent_toxic_quarantine");
  });

  it("serves a valid OpenAPI 3.1.0 specification at /open-data/schema.json", async () => {
    const res = await getSchemaJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(body.openapi).toBe("3.1.0");
    for (const p of [
      "/open-data/catalog.json",
      "/open-data/medications.json",
      "/open-data/interactions.json",
      "/open-data/quarantine.json",
      "/open-data/schema.json",
      "/api/interactions/check",
      "/api/interactions/check-stack",
      "/api/npn/lookup",
    ]) {
      expect(body.paths[p]).toBeDefined();
    }
    expect(body.components.schemas.InteractionsDataset).toBeDefined();
  });

  it("renders valid free HealthApplication Schema.org JSON-LD via WebApplicationSchema", () => {
    const html = renderToStaticMarkup(
      createElement(WebApplicationSchema, {
        name: "Health Canada NPN Decoder",
        description: "Verify 8-digit Natural Product Numbers",
        url: "https://herbally.app/npn-checker",
        featureList: ["Live LNHPD lookup"],
      })
    );
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"isAccessibleForFree":true');
    expect(html).toContain('"price":"0"');
    expect(html).toContain('"priceCurrency":"CAD"');
  });
});
