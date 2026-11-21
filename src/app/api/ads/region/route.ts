import { NextResponse } from "next/server";
import { resolveAdRegion } from "@/lib/ads/policy";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

export const dynamic = "force-dynamic";

/**
 * Coarse ad region for the consent UI.
 *
 * Returns only `row` / `eea` / `unknown` — never the country code. The geo
 * headers are injected by the hosting layer (Vercel/Cloudflare) and are not
 * client-controlled there. When both are present they must agree: a forged
 * `cf-ipcountry` next to a platform-verified `x-vercel-ip-country` resolves to
 * `unknown` instead of picking the permissive one. `unknown` blocks ads.
 *
 * `no-store` keeps a per-visitor answer out of shared caches.
 */
export async function GET(request: Request) {
  const { success } = await rateLimit(
    rateLimitKey("ads-region", getClientIP(request)),
    60,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { region: "unknown", rateLimited: true },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }

  const region = resolveAdRegion(
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cf-ipcountry")
  );

  return NextResponse.json(
    { region },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "x-vercel-ip-country, cf-ipcountry",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
