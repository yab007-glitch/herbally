import { getMedicationSummaries } from "@/lib/interactions/medications";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const medications = await getMedicationSummaries("en");
  const totalInteractionPairs = medications.reduce(
    (sum, m) => sum + m.totalInteractions,
    0
  );

  const payload = {
    service: "HerbAlly",
    dataset: "medications",
    url: `${baseUrl}/open-data/medications.json`,
    generatedAt: new Date().toISOString(),
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; primary sources retain publisher licences (see /methodology)",
    totalMedications: medications.length,
    totalInteractionPairs,
    medications: medications.map((m) => ({
      drugSlug: m.drugSlug,
      drugName: m.drugName,
      url: `${baseUrl}/medications/${m.drugSlug}`,
      urlFr: `${baseUrl}/fr/medications/${m.drugSlug}`,
      totalInteractions: m.totalInteractions,
      clinicianSignedCount: m.publishedCount,
      legacyUnreviewedCount: m.legacyCount,
      reviewStatus:
        m.publishedCount > 0 && m.legacyCount === 0
          ? "clinician_reviewed"
          : "awaiting_clinical_review",
      highestSeverity: m.highestSeverity,
      countsBySeverity: m.countsBySeverity,
      sampleHerbs: m.sampleHerbs,
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
