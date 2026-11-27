import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const records = getAllDangerousHerbs();

  const payload = {
    service: "HerbAlly",
    dataset: "toxic_botanical_quarantine",
    url: `${baseUrl}/open-data/quarantine.json`,
    policy:
      "Permanent toxic botanical quarantine: no therapeutic use, dosing, FAQ, supplement claims, or ads.",
    emergencyContacts: {
      usPoisonControl: "1-800-222-1222",
      canadaPoisonControl: "1-844-764-7669",
      emergency: "911",
    },
    totalQuarantinedBotanicals: records.length,
    botanicals: records.map((r) => ({
      slug: r.slug,
      url: `${baseUrl}/herbs/${r.slug}`,
      urlFr: `${baseUrl}/fr/herbs/${r.slug}`,
      quarantineStatus: "permanent_toxic_quarantine",
      affectedParts: r.parts,
      hazardEn: r.reason,
      hazardFr: r.reasonFr,
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
