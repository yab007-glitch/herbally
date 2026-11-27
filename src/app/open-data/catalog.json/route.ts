import {
  OPEN_DATA_DATASET_VERSION,
  getOpenDataSnapshot,
} from "@/lib/open-data/snapshot";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const snapshot = await getOpenDataSnapshot();
  const { stats, activePairs, medications, quarantinedBotanicals } = snapshot;

  const publishedInteractionPairs =
    activePairs.length > 0 ? activePairs.length : stats.totalInteractions;
  const medicationsAndClasses =
    medications.length > 0 ? medications.length : stats.totalMedications;
  const clinicianSignedInteractions =
    activePairs.length > 0
      ? activePairs.filter(
          (p) => p.clinicalActionStatus === "clinician_approved"
        ).length
      : stats.clinicianApprovedInteractions;
  const legacyUnreviewedInteractions = Math.max(
    0,
    publishedInteractionPairs - clinicianSignedInteractions
  );

  const payload = {
    service: "HerbAlly",
    url: baseUrl,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    editorialContact: "info@herbally.app",
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; cited regulatory excerpts retain publisher licences (see /methodology)",
    countsAvailable: stats.available,
    counts: {
      publishedHerbs: stats.totalHerbs,
      sourceCheckedHerbs: stats.sourceCheckedHerbs,
      clinicianSignedHerbs: stats.clinicallyReviewedHerbs,
      publishedInteractionPairs,
      medicationsAndClasses,
      clinicianSignedInteractions,
      legacyUnreviewedInteractions,
      quarantinedToxicBotanicals: quarantinedBotanicals.length,
    },
    sources: [
      {
        name: "Health Canada LNHPD & NHP Monographs",
        licence: "Open Government Licence – Canada (OGL-Canada)",
        url: "https://health-products.canada.ca/lnhpd-bdpsnh/",
      },
      {
        name: "EMA HMPC Monographs",
        licence: "EMA Legal Notice (attribution required)",
        url: "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
      },
      {
        name: "NIH NCCIH / ODS / LiverTox",
        licence: "US Federal Public Domain (17 U.S.C. §105)",
        url: "https://nccih.nih.gov/",
      },
      {
        name: "PubMed & PubChem (NCBI)",
        licence: "NLM Data Terms / Metadata & CIDs",
        url: "https://pubmed.ncbi.nlm.nih.gov/",
      },
      {
        name: "GBIF Backbone & Wikidata",
        licence: "CC BY 4.0 (GBIF) / CC0 1.0 (Wikidata)",
        url: "https://www.gbif.org/",
      },
    ],
    endpoints: {
      llmsTxt: `${baseUrl}/llms.txt`,
      llmsFullTxt: `${baseUrl}/llms-full.txt`,
      sitemap: `${baseUrl}/sitemap.xml`,
      rss: `${baseUrl}/rss.xml`,
      medications: `${baseUrl}/medications`,
      medicationsJson: `${baseUrl}/open-data/medications.json`,
      interactionsJson: `${baseUrl}/open-data/interactions.json`,
      quarantineJson: `${baseUrl}/open-data/quarantine.json`,
      openApiSchemaJson: `${baseUrl}/open-data/schema.json`,
      sourceMonitorLatestJson: `${baseUrl}/open-data/source-monitor-latest.json`,
      trustCenter: `${baseUrl}/trust`,
      interactionChecker: `${baseUrl}/herb-drug-interactions`,
      npnDecoder: `${baseUrl}/npn-checker`,
      widgets: `${baseUrl}/widgets`,
      clinicalReview: `${baseUrl}/clinical-review`,
      editorialPolicy: `${baseUrl}/editorial-policy`,
      methodology: `${baseUrl}/methodology`,
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
