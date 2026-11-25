import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";

/**
 * On-demand revalidation of a herb's PubMed-compiled sheet cache. Called by
 * the ingestion script (scripts/generate-pubmed-monograph.ts) right after it
 * upserts a sheet, so the new sheet appears on the herb page instantly instead
 * of waiting for the 1h cache revalidation.
 *
 * Secured by REVALIDATE_SECRET (shared with the ingestion script). Rate-limited.
 */
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  });
}

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("revalidate-pubmed-sheet", getClientIP(request)),
    20,
    60_000
  );
  if (!success) {
    return jsonNoStore(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    logger.error("revalidate_secret_not_configured");
    return jsonNoStore(
      { error: "Revalidation is not configured" },
      { status: 503 }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, 4 * 1024);
  if (!bodyResult.ok) {
    return jsonNoStore(
      {
        error:
          bodyResult.reason === "too_large"
            ? "Request body too large"
            : "Invalid request body",
      },
      { status: bodyResult.reason === "too_large" ? 413 : 400 }
    );
  }
  const raw = bodyResult.data;

  const parsed = z
    .object({
      slug: z.string().min(1).max(200),
      secret: z.string(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  // Constant-time comparison to prevent timing attacks.
  const a = Buffer.from(parsed.data.secret);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  // Slug is validated (1-200 chars) before being interpolated into the tag.
  revalidateTag(`pubmed-sheet-${parsed.data.slug}`, { expire: 0 });
  revalidateTag(`herb-page-bundle-${parsed.data.slug}`, { expire: 0 });
  revalidatePath(`/herbs/${parsed.data.slug}`);
  revalidatePath(`/en/herbs/${parsed.data.slug}`);
  revalidatePath(`/fr/herbs/${parsed.data.slug}`);
  return jsonNoStore({ ok: true, slug: parsed.data.slug });
}
