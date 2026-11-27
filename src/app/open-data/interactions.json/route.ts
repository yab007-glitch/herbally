import { pairPath } from "@/lib/interactions/pair-url";
import {
  OPEN_DATA_DATASET_VERSION,
  getOpenDataSnapshot,
} from "@/lib/open-data/snapshot";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const snapshot = await getOpenDataSnapshot();
  const { activePairs } = snapshot;

  const clinicianSignedPairs = activePairs.filter(
    (p) => p.clinicalActionStatus === "clinician_approved"
  ).length;

  const payload = {
    service: "HerbAlly",
    dataset: "herb_drug_interactions",
    url: `${baseUrl}/open-data/interactions.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; cited primary sources retain publisher licences (see /methodology)",
    totalPairs: activePairs.length,
    clinicianSignedPairs,
    legacyUnreviewedPairs: Math.max(
      0,
      activePairs.length - clinicianSignedPairs
    ),
    interactions: activePairs.map((p) => ({
      id: p.id,
      herbSlug: p.herbSlug,
      herbName: p.herbName,
      herbScientificName: p.herbScientificName,
      drugSlug: p.drugSlug,
      drugName: p.drugName,
      url: `${baseUrl}${pairPath(p.herbSlug, p.drugName)}`,
      urlFr: p.hasFr
        ? `${baseUrl}/fr${pairPath(p.herbSlug, p.drugName)}`
        : null,
      severity: p.severity,
      evidenceLevel: p.evidenceLevel,
      evidenceTier: p.evidenceTier ?? "unknown",
      extrapolationScope: p.extrapolationScope ?? "unverified",
      mechanism: p.mechanism,
      description: p.description,
      source: p.source,
      sourceUrl: p.sourceUrl,
      evidenceNote: p.evidenceNote,
      publicationStatus: p.publicationStatus ?? "legacy_unreviewed",
      clinicalActionStatus:
        p.clinicalActionStatus ?? "blocked_legacy_unreviewed",
      clinicianSigned: p.clinicalActionStatus === "clinician_approved",
      hasFr: p.hasFr,
      updatedAt: p.updatedAt,
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
