import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { resolveHerb } from "@/lib/interactions/resolve-herb";
import { matchInteractionPairDetailed } from "@/lib/interactions/check";
import { pairPath } from "@/lib/interactions/pair-url";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

const checkQuerySchema = z.object({
  herb: z.string().trim().min(2).max(200),
  drug: z.string().trim().min(2).max(200),
});

function getLocale(request: NextRequest): "en" | "fr" {
  if (request.headers.get("x-locale") === "fr") return "fr";
  return request.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
}

/**
 * Structured herb–drug check (Phase 2).
 *
 * GET /api/interactions/check?herb=Turmeric&drug=warfarin
 *
 * Returns a curated database pair when one exists, and an explicit
 * found:false when it does not. A missing pair is NOT an error and
 * must never be filled in with an AI answer by this route — the
 * client offers the Virtual Herbalist as a clearly-labelled
 * secondary step instead. Database unavailability is reported
 * separately (unavailable:true) so the client does not misreport
 * "no record" when it simply could not look.
 */
export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("interactions-check", getClientIP(request)),
    30,
    60_000
  );
  if (!success) {
    // `unavailable` is the client's "we could not look" flag, but on its own it
    // reads as a database outage. Say plainly that this is a rate limit so a
    // caller can distinguish throttling from a real failure.
    return NextResponse.json(
      {
        found: false,
        unavailable: true,
        rateLimited: true,
        message: "Too many requests. Try again in a minute.",
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const parsedQuery = checkQuerySchema.safeParse({
    herb: request.nextUrl.searchParams.get("herb") ?? "",
    drug: request.nextUrl.searchParams.get("drug") ?? "",
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ found: false }, { status: 400 });
  }
  const { herb: herbTerm, drug: drugTerm } = parsedQuery.data;

  const supabase = getAnonClient();
  if (!supabase) {
    return NextResponse.json(
      { found: false, unavailable: true },
      { status: 503 }
    );
  }

  try {
    const locale = getLocale(request);
    const herb = await resolveHerb(herbTerm);
    if (!herb) return NextResponse.json({ found: false, herb: null });

    const displayName =
      locale === "fr" && herb.frName ? herb.frName : herb.name;
    const pairs = await getHerbPairs(herb.slug, locale);
    const match = matchInteractionPairDetailed(drugTerm, pairs);
    if (match.kind === "none") {
      return NextResponse.json({
        found: false,
        herb: {
          slug: herb.slug,
          name: displayName,
          scientific_name: herb.scientific_name,
        },
      });
    }

    if (match.kind === "collision") {
      logger.warn("interactions_check_collision", {
        herbSlug: herb.slug,
        drugSlug: match.drugSlug,
        count: match.pairs.length,
      });
      return NextResponse.json(
        {
          found: true,
          ambiguous: true,
          conflict: true,
          herb: {
            slug: herb.slug,
            name: displayName,
            scientific_name: herb.scientific_name,
          },
          pair: null,
          conflictingPairs: match.pairs.map((p) => ({
            id: p.id,
            drugName: p.drugName,
            severity: p.severity,
            description: p.description,
            mechanism: p.mechanism,
            evidenceLevel: p.evidenceLevel,
            source: p.source,
            sourceUrl: p.sourceUrl,
            pairUrl: pairPath(p.herbSlug, p.drugName),
          })),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const pair = match.pair;
    return NextResponse.json({
      found: true,
      herb: {
        slug: herb.slug,
        name: displayName,
        scientific_name: herb.scientific_name,
      },
      pair: {
        id: pair.id,
        drugName: pair.drugName,
        severity: pair.severity,
        description: pair.description,
        mechanism: pair.mechanism,
        evidenceLevel: pair.evidenceLevel,
        source: pair.source,
        sourceUrl: pair.sourceUrl,
        pairUrl: pairPath(pair.herbSlug, pair.drugName),
      },
    });
  } catch {
    // Never log raw herb/drug terms from upstream errors.
    logger.error("interactions_check_error");
    return NextResponse.json(
      { found: false, unavailable: true },
      { status: 503 }
    );
  }
}
