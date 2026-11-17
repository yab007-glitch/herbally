import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
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
  const { success } = await rateLimit(
    rateLimitKey("revalidate-herb", getClientIP(request)),
    5,
    60_000
  );
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
    // generateMetadata reads the herb row from the page bundle, and the bundle
    // also carries the FAQ, monograph and regulator rows. Purging the per-slug
    // bundle tag is what makes a data-only correction land in all of them
    // (entries written before the per-slug tag existed still expire on TTL).
    revalidateTag(`herb-page-bundle-${slug}`, "max");
    revalidateTag(`herb-faqs-${slug}`, "max");
    // The regulator record is cached separately from the bundle it reads, so
    // purging the bundle alone left an edited purposes/doses list on screen for
    // the rest of its TTL (found 2026-11-16 on malabar-nut).
    revalidateTag(`herb-regulatory-evidence-${slug}`, "max");
    // The Full Route Cache (the prerendered HTML) is keyed by path, not tag.
    revalidatePath(`/herbs/${slug}`);
    revalidatePath(`/fr/herbs/${slug}`);
  }

  // The sitemap is a separately cached route (`revalidate = 3600`). Any
  // correction that changes which herbs or pages are listable must refresh it
  // too, or a degraded copy keeps being served for up to an hour.
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true, revalidated: slugs.length });
}
