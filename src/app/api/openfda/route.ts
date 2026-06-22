import type { NextRequest } from "next/server";
import { z } from "zod";
import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

const OPENFDA_BASE = process.env.OPENFDA_BASE_URL || "https://api.fda.gov";

// Bound upstream latency so a hung OpenFDA request can't stall a serverless
// invocation indefinitely (matching the RxNorm client pattern).
const OPENFDA_TIMEOUT_MS = 8000;

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

export async function GET(request: Request) {
  const { success } = await rateLimit(
    getClientIP(request as NextRequest),
    20,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const schema = z.object({ term: z.string().min(1).max(100) });
  const { searchParams } = new URL(request.url);
  const termRaw = searchParams.get("term");
  const parsed = schema.safeParse({ term: termRaw });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing term parameter" },
      { status: 400 }
    );
  }
  const term = parsed.data.term;

  try {
    const res = await fetch(
      `${OPENFDA_BASE}/drug/event.json?search=patient.drug.medicinalproduct:${encodeURIComponent(term)}&limit=5`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(OPENFDA_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // Transient network/DNS errors (ENOTFOUND, ECONNREFUSED, timeout) are
    // infrastructure issues, not code bugs — log as a warning and return
    // empty results without triggering Sentry alerts.
    if (isTransientNetworkError(error)) {
      logger.warn("openfda_api_network_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      // Unexpected errors (JSON parse, logic errors) should be captured.
      const { captureException } = await import("@sentry/nextjs");
      captureException(error);
      logger.error("openfda_api_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return NextResponse.json({ results: [] });
  }
}
