import { captureException } from "@sentry/nextjs";
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { searchDrugs } from "@/lib/utils/rxnorm-client";import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";


export async function GET(request: NextRequest) {
  try {
    const { success } = await rateLimit(getClientIP(request), 20, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const schema = z.object({ term: z.string().min(2).max(100) });
    const { searchParams } = new URL(request.url);
    const termRaw = searchParams.get("term");
    const parsed = schema.safeParse({ term: termRaw });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Search term must be at least 2 characters" },
        { status: 400 }
      );
    }
    const term = parsed.data.term;

    const results = await searchDrugs(term.trim());

    return NextResponse.json({ results });
  } catch (error) {
    captureException(error);
    logger.error("rxnorm_api_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to search drugs" },
      { status: 500 }
    );
  }
}
