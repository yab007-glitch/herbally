import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";

const bodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Invalid slug"),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/**
 * POST /api/herbs/view
 *
 * Called by the client ViewTracker once per visitor/slug/day. Uses the service
 * role because `increment_herb_view_by_slug` is not executable by anon or
 * authenticated roles (prevents view-count inflation from direct RPC calls).
 */
export async function POST(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("herbs-view", getClientIP(request)),
    30,
    60_000
  );
  if (!success) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": "60", ...NO_STORE_HEADERS },
    });
  }

  const bodyResult = await readJsonBodyWithLimit(request, 2 * 1024);
  if (!bodyResult.ok) {
    return new NextResponse(null, {
      status: bodyResult.reason === "too_large" ? 413 : 400,
      headers: NO_STORE_HEADERS,
    });
  }
  const parsed = bodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_herb_view_by_slug", {
      p_slug: parsed.data.slug,
    });
    if (error) {
      logger.warn("increment_herb_view_by_slug failed", {
        slug: parsed.data.slug,
        error: error.message,
      });
    }
  } catch (error) {
    // Service role absent in local dev, or transient DB error. View tracking is
    // non-critical and must never surface to the reader.
    logger.warn("herb view tracking skipped", {
      slug: parsed.data.slug,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
