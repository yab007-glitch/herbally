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
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

function digestEntry(
  path: string,
  payload: unknown,
  recordCount: number | null
) {
  const serialized = serializeOpenDataJson(payload);
  return {
    path,
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
    dataset: "open_data_integrity_manifest",
    url: `${baseUrl}/open-data/manifest.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    httpCachePolicy: OPEN_DATA_HTTP_CACHE_POLICY,
    algorithm: "sha256",
    files: {
      "/open-data/catalog.json": digestEntry(
        "/open-data/catalog.json",
        catalog,
        null
      ),
      "/open-data/medications.json": digestEntry(
        "/open-data/medications.json",
        medications,
        medications.totalMedications
      ),
      "/open-data/interactions.json": digestEntry(
        "/open-data/interactions.json",
        interactions,
        interactions.totalPairs
      ),
      "/open-data/quarantine.json": digestEntry(
        "/open-data/quarantine.json",
        quarantine,
        quarantine.totalQuarantinedBotanicals
      ),
      "/open-data/privacy-manifest.json": digestEntry(
        "/open-data/privacy-manifest.json",
        privacyManifest,
        privacyManifest.subprocessors.length
      ),
      "/open-data/review-queue.json": digestEntry(
        "/open-data/review-queue.json",
        reviewQueue,
        reviewQueue.summary.priorityQueueCount
      ),
      "/open-data/schema.json": digestEntry(
        "/open-data/schema.json",
        schema,
        Object.keys(schema.paths).length
      ),
    },
  };

  return new Response(serializeOpenDataJson(payload), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
