import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { searchDrugsWithAvailability } from "@/lib/utils/rxnorm-client";
import { logger } from "@/lib/utils/logger";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

/**
 * Returns true for transient network/DNS errors that are infrastructure
 * issues, not code bugs. These should be logged as warnings, not sent to
 * Sentry — they're expected when the upstream API is unreachable.
 */
function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("dns")
  );
}

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const { success } = await rateLimit(
      rateLimitKey("rxnorm", getClientIP(request)),
      20,
      60_000
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60", ...NO_STORE_HEADERS } }
      );
    }
    const schema = z.object({ term: z.string().min(2).max(100) });
    const { searchParams } = new URL(request.url);
    const termRaw = searchParams.get("term");
    const parsed = schema.safeParse({ term: termRaw });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Search term must be at least 2 characters" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const term = parsed.data.term;

    const { results, unavailable } = await searchDrugsWithAvailability(
      term.trim()
    );

    if (unavailable) {
      return NextResponse.json(
        { results: [], unavailable: true },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json({ results }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    // Transient network/DNS errors (ENOTFOUND, ECONNREFUSED, timeout) are
    // infrastructure issues, not code bugs — log as a warning and return
    // empty results without triggering Sentry alerts.
    if (isTransientNetworkError(error)) {
      logger.warn("rxnorm_api_network_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { results: [], unavailable: true },
        { headers: NO_STORE_HEADERS }
      );
    }
    // Unexpected errors should be captured.
    const { captureException } = await import("@sentry/nextjs");
    captureException(error);
    logger.error("rxnorm_api_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to search drugs" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
