import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { InteractionPair } from "@/lib/interactions/pairs";

const { mockStats, mockGetInteractionPairs } = vi.hoisted(() => ({
  mockStats: {
    available: true,
    generatedAt: "2026-11-27T17:00:00.000Z",
    totalHerbs: 3122,
    sourceCheckedHerbs: 3089,
    clinicallyReviewedHerbs: 0,
    totalInteractions: 509,
    totalMedications: 142,
    clinicianApprovedInteractions: 0,
    legacyUnreviewedInteractions: 509,
    corrections: [],
  },
  mockGetInteractionPairs: vi.fn(async (): Promise<InteractionPair[]> => {
    const mod =
      await import("@/lib/interactions/__tests__/fixtures/canonical-142-medications.json");
    return mod.default as unknown as InteractionPair[];
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/governance/coverage-stats", () => ({
  getGovernanceCoverageStats: vi.fn().mockResolvedValue(mockStats),
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getInteractionPairs: mockGetInteractionPairs,
}));

import { GET as getCatalogJson } from "@/app/open-data/catalog.json/route";
import { GET as getInteractionsJson } from "@/app/open-data/interactions.json/route";
import { GET as getMedicationsJson } from "@/app/open-data/medications.json/route";
import { GET as getQuarantineJson } from "@/app/open-data/quarantine.json/route";
import { GET as getSchemaJson } from "@/app/open-data/schema.json/route";
import { GET as getSourceMonitorLatestJson } from "@/app/open-data/source-monitor-latest.json/route";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";

describe("A3/A4: Atomic Open Botanical Safety Data Suite, Full Reconciliation & OpenAPI 3.1", () => {
  it("exports all dangerous herbs deterministically sorted by slug", () => {
    const records = getAllDangerousHerbs();
    expect(records.length).toBeGreaterThan(20);
    const slugs = records.map((r) => r.slug);
    expect(slugs).toContain("abrus-precatorius");
    expect([...slugs].sort((a, b) => a.localeCompare(b))).toEqual(slugs);
  });

  it("shares one atomic snapshotId and reconciled totals across catalog, medications, interactions, and quarantine exports", async () => {
    const [catalogRes, medsRes, ixRes, qRes] = await Promise.all([
      getCatalogJson(),
      getMedicationsJson(),
      getInteractionsJson(),
      getQuarantineJson(),
    ]);

    for (const res of [catalogRes, medsRes, ixRes, qRes]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
    }

    const catalog = (await catalogRes.json()) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      counts: Record<string, number>;
      endpoints: Record<string, string>;
    };
    const meds = (await medsRes.json()) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalMedications: number;
      totalInteractionPairs: number;
      medications: Array<{
        drugSlug: string;
        url: string;
        urlFr: string;
        reviewStatus: string;
        totalInteractions: number;
      }>;
    };
    const ix = (await ixRes.json()) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalPairs: number;
      clinicianSignedPairs: number;
      interactions: Array<{
        id: string;
        clinicianSigned: boolean;
        sourceUrl: string | null;
        url: string;
      }>;
    };
    const quarantine = (await qRes.json()) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalQuarantinedBotanicals: number;
      emergencyContacts: {
        usPoisonControl: string;
        canadaPoisonControl: string;
        emergency: string;
      };
      botanicals: Array<{ slug: string; quarantineStatus: string }>;
    };

    // Atomic consistency across all 4 exports
    expect(catalog.snapshotId).toMatch(/^herbally-open-data-3\.13\.2-/);
    expect(meds.snapshotId).toBe(catalog.snapshotId);
    expect(ix.snapshotId).toBe(catalog.snapshotId);
    expect(quarantine.snapshotId).toBe(catalog.snapshotId);

    expect(meds.generatedAt).toBe(catalog.generatedAt);
    expect(ix.generatedAt).toBe(catalog.generatedAt);
    expect(quarantine.generatedAt).toBe(catalog.generatedAt);

    // Exact cross-endpoint count reconciliation
    expect(catalog.counts.publishedInteractionPairs).toBe(509);
    expect(ix.totalPairs).toBe(509);
    expect(meds.totalInteractionPairs).toBe(509);
    expect(
      meds.medications.reduce((sum, m) => sum + m.totalInteractions, 0)
    ).toBe(509);

    expect(catalog.counts.medicationsAndClasses).toBe(142);
    expect(meds.totalMedications).toBe(142);
    expect(meds.medications).toHaveLength(142);
    for (const med of meds.medications) {
      expect(med.reviewStatus).toBe("awaiting_clinical_review");
      expect(med.url).toContain(`/medications/${med.drugSlug}`);
      expect(med.urlFr).toContain(`/fr/medications/${med.drugSlug}`);
    }

    expect(catalog.counts.clinicianSignedInteractions).toBe(0);
    expect(ix.clinicianSignedPairs).toBe(0);
    expect(ix.interactions.every((p) => p.clinicianSigned === false)).toBe(
      true
    );

    expect(catalog.counts.quarantinedToxicBotanicals).toBe(
      getAllDangerousHerbs().length
    );
    expect(quarantine.totalQuarantinedBotanicals).toBe(
      getAllDangerousHerbs().length
    );
    expect(quarantine.emergencyContacts.usPoisonControl).toBe("1-800-222-1222");
    expect(quarantine.emergencyContacts.canadaPoisonControl).toBe(
      "1-844-764-7669"
    );
    expect(quarantine.emergencyContacts.emergency).toBe("911");
    expect(
      quarantine.botanicals.find((b) => b.slug === "abrus-precatorius")
        ?.quarantineStatus
    ).toBe("permanent_toxic_quarantine");

    expect(catalog.endpoints.interactionsJson).toContain(
      "/open-data/interactions.json"
    );
    expect(catalog.endpoints.openApiSchemaJson).toContain(
      "/open-data/schema.json"
    );
    expect(catalog.endpoints.trustCenter).toContain("/trust");
  });

  it("serves a valid OpenAPI 3.1.0 specification at /open-data/schema.json", async () => {
    const res = await getSchemaJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      openapi: string;
      info: { version: string };
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.version).toBe("3.13.2");
    for (const p of [
      "/open-data/catalog.json",
      "/open-data/medications.json",
      "/open-data/interactions.json",
      "/open-data/quarantine.json",
      "/open-data/schema.json",
      "/open-data/source-monitor-latest.json",
      "/api/interactions/check",
      "/api/interactions/check-stack",
      "/api/npn/lookup",
    ]) {
      expect(body.paths[p]).toBeDefined();
    }
    expect(body.components.schemas.InteractionsDataset).toBeDefined();
  });

  it("serves verified GitHub Actions source-monitor JSON artifact at /open-data/source-monitor-latest.json", async () => {
    const res = await getSourceMonitorLatestJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
    const body = (await res.json()) as {
      verificationProvenance: { sourceMonitorRunId: string };
      report: {
        citations: {
          totalUniqueUrls: number;
          uniquePmids: number;
          retractedPmids: string[];
          brokenUrls: unknown[];
        };
      };
    };
    expect(body.verificationProvenance.sourceMonitorRunId).toBe("46049354499");
    expect(body.report.citations.totalUniqueUrls).toBeGreaterThanOrEqual(240);
    expect(body.report.citations.uniquePmids).toBeGreaterThanOrEqual(70);
    expect(body.report.citations.retractedPmids).toEqual([]);
    expect(body.report.citations.brokenUrls).toEqual([]);
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
