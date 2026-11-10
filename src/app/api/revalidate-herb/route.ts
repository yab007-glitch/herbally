import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

/**
 * On-demand revalidation of herb detail pages after a data-only correction.
 *
 * The herb row is held in `unstable_cache` for 72 h under the tags
 * `herb-<slug>` and `herb-meta-<slug>`, and that Data Cache outlives a deploy.
 * A fix written straight to the database therefore stays invisible on any page
 * whose entry is still warm. Bulk corrections (e.g. removing French label text
 * from the English cautions field) call this endpoint with the affected slugs.
 *
 * Secured by REVALIDATE_SECRET, rate-limited, and capped at 200 slugs per call
 * so one request cannot be used to invalidate the whole catalogue.
 */
const Body = z.object({
  slugs: z.array(z.string().min(1).max(200)).min(1).max(200),
  secret: z.string(),
});

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 5, 60_000);
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

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Constant-time comparison to prevent timing attacks.
  const a = Buffer.from(parsed.data.secret);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slugs = [...new Set(parsed.data.slugs)];
  for (const slug of slugs) {
    // Next 16: revalidateTag takes a cache-life profile as the second argument.
    revalidateTag(`herb-${slug}`, "max");
    revalidateTag(`herb-meta-${slug}`, "max");
    // The FAQ rows are read through `loadHerbPageBundle`, so a correction to
    // herb_faqs only lands once the bundle key is bumped as well (see the
    // version note on `herb-page-bundle`). Purging this tag keeps the entry
    // from being re-served after that bump; on its own it cannot refresh it.
    revalidateTag(`herb-faqs-${slug}`, "max");
    // The Full Route Cache (the prerendered HTML) is keyed by path, not tag.
    revalidatePath(`/herbs/${slug}`);
    revalidatePath(`/fr/herbs/${slug}`);
  }

  return NextResponse.json({ ok: true, revalidated: slugs.length });
}
