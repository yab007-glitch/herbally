import {
  OPEN_DATA_RESPONSE_HEADERS,
  buildOpenApiSchemaPayload,
  serializeOpenDataJson,
} from "@/lib/open-data/builders";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();
  const spec = buildOpenApiSchemaPayload(baseUrl);

  return new Response(serializeOpenDataJson(spec), {
    headers: OPEN_DATA_RESPONSE_HEADERS,
  });
}
