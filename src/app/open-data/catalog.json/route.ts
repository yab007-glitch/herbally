import {
  OPEN_DATA_RESPONSE_HEADERS,
  buildCatalogPayload,
  serializeOpenDataJson,
} from "@/lib/open-data/builders";
import { getOpenDataSnapshot } from "@/lib/open-data/snapshot";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

/**
 * Serves unified CC BY 4.0 catalog linking /open-data/medications.json,
 * /open-data/interactions.json, /open-data/quarantine.json,
 * /open-data/manifest.json, /open-data/schema.json, and
 * /open-data/source-monitor-latest.json via shared canonical builders.
 */
export async function GET() {
  const baseUrl = siteUrl();
  const snapshot = await getOpenDataSnapshot();
  const payload = buildCatalogPayload(snapshot, baseUrl);

  return new Response(serializeOpenDataJson(payload), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
