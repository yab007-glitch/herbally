import { createHash } from "node:crypto";
import {
  OPEN_DATA_HTTP_CACHE_POLICY,
  OPEN_DATA_RESPONSE_HEADERS,
  buildCatalogPayload,
  buildInteractionsPayload,
  buildMedicationsPayload,
  buildOpenApiSchemaPayload,
  buildPrivacyManifestPayload,
  buildQuarantinePayload,
  buildReviewQueuePayload,
  serializeOpenDataJson,
} from "@/lib/open-data/builders";
import {
  OPEN_DATA_DATASET_VERSION,
  getOpenDataSnapshot,
} from "@/lib/open-data/snapshot";
import sourceMonitorBaseline from "@/lib/open-data/source-monitor-latest.json";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

function digestSummary(payload: unknown, recordCount: number | null) {
  const serialized = serializeOpenDataJson(payload);
  return {
    sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
    bytes: Buffer.byteLength(serialized, "utf8"),
    recordCount,
  };
}

export async function GET() {
  const baseUrl = siteUrl();
  const snapshot = await getOpenDataSnapshot();

  const catalog = buildCatalogPayload(snapshot, baseUrl);
  const medications = buildMedicationsPayload(snapshot, baseUrl);
  const interactions = buildInteractionsPayload(snapshot, baseUrl);
  const quarantine = buildQuarantinePayload(snapshot, baseUrl);
  const privacyManifest = buildPrivacyManifestPayload(snapshot, baseUrl);
  const reviewQueue = buildReviewQueuePayload(snapshot, baseUrl);
  const schema = buildOpenApiSchemaPayload(baseUrl);

  const payload = {
    service: "HerbAlly",
    dataset: "release_3_15_0_unified_verification_bundle",
    url: `${baseUrl}/open-data/v3-15-0.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    httpCachePolicy: OPEN_DATA_HTTP_CACHE_POLICY,
    counts: catalog.counts,
    sha256Manifest: {
      algorithm: "sha256",
      files: {
        "/open-data/catalog.json": digestSummary(catalog, null),
        "/open-data/medications.json": digestSummary(
          medications,
          medications.totalMedications
        ),
        "/open-data/interactions.json": digestSummary(
          interactions,
          interactions.totalPairs
        ),
        "/open-data/quarantine.json": digestSummary(
          quarantine,
          quarantine.totalQuarantinedBotanicals
        ),
        "/open-data/privacy-manifest.json": digestSummary(
          privacyManifest,
          privacyManifest.subprocessors.length
        ),
        "/open-data/review-queue.json": digestSummary(
          reviewQueue,
          reviewQueue.summary.priorityQueueCount
        ),
        "/open-data/schema.json": digestSummary(
          schema,
          Object.keys(schema.paths).length
        ),
      },
    },
    privacySummary: {
      jurisdictions: privacyManifest.jurisdictions,
      privacyOfficer: privacyManifest.privacyOfficer,
      guarantees: privacyManifest.guarantees,
      subprocessorCount: privacyManifest.subprocessors.length,
      cookieCount: privacyManifest.cookies.length,
    },
    reviewQueueSummary: {
      advisoryBoard: reviewQueue.advisoryBoard,
      summary: reviewQueue.summary,
    },
    sourceMonitorVerification: {
      provenance: sourceMonitorBaseline.verificationProvenance,
      report: sourceMonitorBaseline.report,
    },
    endpoints: {
      ...catalog.endpoints,
      releaseBundleJson: `${baseUrl}/open-data/v3-15-0.json`,
      embedScriptJs: `${baseUrl}/embed.js`,
      trustCenterFr: `${baseUrl}/fr/trust`,
    },
  };

  return new Response(serializeOpenDataJson(payload), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
