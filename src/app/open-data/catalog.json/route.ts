import { getGovernanceCoverageStats } from "@/lib/governance/coverage-stats";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const stats = await getGovernanceCoverageStats();
  const quarantinedToxicBotanicals = getAllDangerousHerbs().length;

  const payload = {
    service: "HerbAlly",
    url: baseUrl,
    generatedAt: stats.generatedAt,
    editorialContact: "info@herbally.app",
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; cited regulatory excerpts retain publisher licences (see /methodology)",
    countsAvailable: stats.available,
    counts: {
      publishedHerbs: stats.totalHerbs,
      sourceCheckedHerbs: stats.sourceCheckedHerbs,
      clinicianSignedHerbs: stats.clinicallyReviewedHerbs,
      publishedInteractionPairs: stats.totalInteractions,
      medicationsAndClasses: stats.totalMedications,
      clinicianSignedInteractions: stats.clinicianApprovedInteractions,
      legacyUnreviewedInteractions: stats.legacyUnreviewedInteractions,
      quarantinedToxicBotanicals,
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
      quarantineJson: `${baseUrl}/open-data/quarantine.json`,
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
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
