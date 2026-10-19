import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";

const bodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Invalid slug"),
});

/**
 * POST /api/herbs/view
 *
 * Called by the client ViewTracker once per visitor/slug/day. Uses the service
 * role because `increment_herb_view_by_slug` is not executable by anon or
 * authenticated roles (prevents view-count inflation from direct RPC calls).
 */
export async function POST(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const parsed = bodySchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
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

  return new NextResponse(null, { status: 204 });
}
