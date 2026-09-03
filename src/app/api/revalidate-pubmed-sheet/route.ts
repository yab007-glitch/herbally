import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

/**
 * On-demand revalidation of a herb's PubMed-compiled sheet cache. Called by
 * the ingestion script (scripts/generate-pubmed-monograph.ts) right after it
 * upserts a sheet, so the new sheet appears on the herb page instantly instead
 * of waiting for the 1h cache revalidation.
 *
 * Secured by REVALIDATE_SECRET (shared with the ingestion script). Rate-limited.
 */
export async function POST(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    logger.error("revalidate_secret_not_configured");
    return NextResponse.json(
      { error: "Revalidation is not configured" },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = z
    .object({
      slug: z.string().min(1).max(200),
      secret: z.string(),
    })
    .safeParse(raw);
  if (!parsed.success || parsed.data.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Slug is validated (1-200 chars) before being interpolated into the tag.
  revalidateTag(`pubmed-sheet-${parsed.data.slug}`, "max");
  return NextResponse.json({ ok: true, slug: parsed.data.slug });
}
