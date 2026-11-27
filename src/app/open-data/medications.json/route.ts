import {
  OPEN_DATA_RESPONSE_HEADERS,
  buildMedicationsPayload,
  serializeOpenDataJson,
} from "@/lib/open-data/builders";
import { getOpenDataSnapshot } from "@/lib/open-data/snapshot";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const snapshot = await getOpenDataSnapshot();
  const payload = buildMedicationsPayload(snapshot, baseUrl);

  return new Response(serializeOpenDataJson(payload), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
