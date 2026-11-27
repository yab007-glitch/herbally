import { createHash } from "node:crypto";
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
import { GET as getManifestJson } from "@/app/open-data/manifest.json/route";
import { GET as getMedicationsJson } from "@/app/open-data/medications.json/route";
import { GET as getQuarantineJson } from "@/app/open-data/quarantine.json/route";
import { GET as getSchemaJson } from "@/app/open-data/schema.json/route";
import { GET as getSourceMonitorLatestJson } from "@/app/open-data/source-monitor-latest.json/route";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";

describe("A3/A4: Atomic Open Botanical Safety Data Suite, SHA-256 Manifest & OpenAPI 3.1", () => {
  it("exports all dangerous herbs deterministically sorted by slug", () => {
    const records = getAllDangerousHerbs();
    expect(records.length).toBeGreaterThan(20);
    const slugs = records.map((r) => r.slug);
    expect(slugs).toContain("abrus-precatorius");
    expect([...slugs].sort((a, b) => a.localeCompare(b))).toEqual(slugs);
  });

  it("shares one atomic snapshotId, SHA-256 manifest digests, and reconciled totals across all Open Data exports", async () => {
    const [catalogRes, medsRes, ixRes, qRes, schemaRes, manifestRes] =
      await Promise.all([
        getCatalogJson(),
        getMedicationsJson(),
        getInteractionsJson(),
        getQuarantineJson(),
        getSchemaJson(),
        getManifestJson(),
      ]);

    for (const res of [
      catalogRes,
      medsRes,
      ixRes,
      qRes,
      schemaRes,
      manifestRes,
    ]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
    }

    const [catalogRaw, medsRaw, ixRaw, qRaw, schemaRaw, manifestRaw] =
      await Promise.all([
        catalogRes.text(),
        medsRes.text(),
        ixRes.text(),
        qRes.text(),
        schemaRes.text(),
        manifestRes.text(),
      ]);

    const catalog = JSON.parse(catalogRaw) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      counts: Record<string, number>;
      privacyGuarantees: {
        zeroThirdPartyAdTrackers: boolean;
        clientSideOnlyConsultationExport: boolean;
      };
      evidenceHierarchy: { conflictResolutionRule: string };
      endpoints: Record<string, string>;
    };
    const meds = JSON.parse(medsRaw) as {
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
    const ix = JSON.parse(ixRaw) as {
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
    const quarantine = JSON.parse(qRaw) as {
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
    const schema = JSON.parse(schemaRaw) as {
      openapi: string;
      info: { version: string };
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    const manifest = JSON.parse(manifestRaw) as {
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      algorithm: string;
      files: Record<
        string,
        { sha256: string; bytes: number; recordCount: number | null }
      >;
    };

    // Atomic consistency across all exports
    expect(catalog.snapshotId).toMatch(/^herbally-open-data-3\.14\.1-/);
    expect(meds.snapshotId).toBe(catalog.snapshotId);
    expect(ix.snapshotId).toBe(catalog.snapshotId);
    expect(quarantine.snapshotId).toBe(catalog.snapshotId);
    expect(manifest.snapshotId).toBe(catalog.snapshotId);

    expect(meds.generatedAt).toBe(catalog.generatedAt);
    expect(ix.generatedAt).toBe(catalog.generatedAt);
    expect(quarantine.generatedAt).toBe(catalog.generatedAt);
    expect(manifest.generatedAt).toBe(catalog.generatedAt);

    // SHA-256 verification against exact response payloads
    expect(manifest.algorithm).toBe("sha256");
    const rawByPath: Record<string, string> = {
      "/open-data/catalog.json": catalogRaw,
      "/open-data/medications.json": medsRaw,
      "/open-data/interactions.json": ixRaw,
      "/open-data/quarantine.json": qRaw,
      "/open-data/schema.json": schemaRaw,
    };
    for (const [p, raw] of Object.entries(rawByPath)) {
      const digest = createHash("sha256").update(raw, "utf8").digest("hex");
      expect(manifest.files[p].sha256).toBe(digest);
      expect(manifest.files[p].bytes).toBe(Buffer.byteLength(raw, "utf8"));
    }

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

    expect(catalog.privacyGuarantees.zeroThirdPartyAdTrackers).toBe(true);
    expect(catalog.privacyGuarantees.clientSideOnlyConsultationExport).toBe(
      true
    );
    expect(catalog.evidenceHierarchy.conflictResolutionRule).toContain(
      "quarantined_collision"
    );
    expect(catalog.endpoints.manifestJson).toContain(
      "/open-data/manifest.json"
    );
    expect(catalog.endpoints.securityTxt).toContain(
      "/.well-known/security.txt"
    );
    expect(catalog.endpoints.trustCenter).toContain("/trust");

    expect(schema.openapi).toBe("3.1.0");
    expect(schema.info.version).toBe("3.14.1");
    for (const p of [
      "/open-data/catalog.json",
      "/open-data/medications.json",
      "/open-data/interactions.json",
      "/open-data/quarantine.json",
      "/open-data/manifest.json",
      "/open-data/schema.json",
      "/open-data/source-monitor-latest.json",
      "/.well-known/security.txt",
      "/api/interactions/check",
      "/api/interactions/check-stack",
      "/api/npn/lookup",
    ]) {
      expect(schema.paths[p]).toBeDefined();
    }
    expect(schema.components.schemas.ManifestResponse).toBeDefined();
    expect(schema.components.schemas.InteractionsDataset).toBeDefined();
  });

  it("serves verified GitHub Actions source-monitor JSON artifact plus live workflow status fields", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 403 }));
    try {
      const res = await getSourceMonitorLatestJson();
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
      const body = (await res.json()) as {
        verificationProvenance: { sourceMonitorRunId: string };
        liveGitHubWorkflowRuns: { fetchedAt: string; sourceMonitor: unknown };
        report: {
          citations: {
            totalUniqueUrls: number;
            uniquePmids: number;
            retractedPmids: string[];
            brokenUrls: unknown[];
          };
        };
      };
      expect(body.verificationProvenance.sourceMonitorRunId).toBe(
        "46054115945"
      );
      expect(body.liveGitHubWorkflowRuns.fetchedAt).toBeTruthy();
      expect(body.report.citations.totalUniqueUrls).toBeGreaterThanOrEqual(240);
      expect(body.report.citations.uniquePmids).toBeGreaterThanOrEqual(70);
      expect(body.report.citations.retractedPmids).toEqual([]);
      expect(body.report.citations.brokenUrls).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
    }
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
