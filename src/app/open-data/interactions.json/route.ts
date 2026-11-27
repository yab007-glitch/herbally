import { getInteractionPairs } from "@/lib/interactions/pairs";
import { pairPath } from "@/lib/interactions/pair-url";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const allPairs = await getInteractionPairs("en");
  const activePairs = allPairs
    .filter((p) => p.publicationStatus !== "retracted_hold")
    .sort((a, b) => {
      const herbCmp = a.herbSlug.localeCompare(b.herbSlug);
      if (herbCmp !== 0) return herbCmp;
      return a.drugSlug.localeCompare(b.drugSlug);
    });

  const clinicianSignedPairs = activePairs.filter(
    (p) => p.clinicalActionStatus === "clinician_approved"
  ).length;

  const payload = {
    service: "HerbAlly",
    dataset: "herb_drug_interactions",
    url: `${baseUrl}/open-data/interactions.json`,
    generatedAt: new Date().toISOString(),
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
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
