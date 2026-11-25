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
const PUBLIC_CHECK_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  Vary: "x-locale",
};
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

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
      { status: 429, headers: { "Retry-After": "60", ...NO_STORE_HEADERS } }
    );
  }
  const parsedQuery = checkQuerySchema.safeParse({
    herb: request.nextUrl.searchParams.get("herb") ?? "",
    drug: request.nextUrl.searchParams.get("drug") ?? "",
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { found: false },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  const { herb: herbTerm, drug: drugTerm } = parsedQuery.data;

  const supabase = getAnonClient();
  if (!supabase) {
    return NextResponse.json(
      { found: false, unavailable: true },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const locale = getLocale(request);
    const herb = await resolveHerb(herbTerm);
    if (!herb) {
      return NextResponse.json(
        { found: false, herb: null },
        { headers: PUBLIC_CHECK_HEADERS }
      );
    }

    const displayName =
      locale === "fr" && herb.frName ? herb.frName : herb.name;
    const allPairs = await getHerbPairs(herb.slug, locale);
    const pairs = allPairs.filter(
      (p) => p.publicationStatus !== "retracted_hold"
    );
    const retractedPairs = allPairs.filter(
      (p) => p.publicationStatus === "retracted_hold"
    );
    const match = matchInteractionPairDetailed(drugTerm, pairs);
    if (match.kind === "none") {
      const retractedMatch = matchInteractionPairDetailed(
        drugTerm,
        retractedPairs
      );
      if (retractedMatch.kind !== "none") {
        return NextResponse.json(
          {
            found: false,
            withheld: true,
            status: "withheld",
            reason: "retracted_hold",
            herb: {
              slug: herb.slug,
              name: displayName,
              scientific_name: herb.scientific_name,
            },
            pair: null,
            message:
              locale === "fr"
                ? "Une fiche d'interaction correspondante pour cette association est temporairement retenue en raison d'une citation retirée et fait l'objet d'une révision clinique. Ne supposez pas que l'association est sans risque — consultez un pharmacien."
                : "A matching interaction record for this combination is currently withheld due to a retracted citation and is under clinical review. Do not assume this combination is safe — consult a pharmacist or prescriber.",
          },
          { headers: NO_STORE_HEADERS }
        );
      }
      return NextResponse.json(
        {
          found: false,
          herb: {
            slug: herb.slug,
            name: displayName,
            scientific_name: herb.scientific_name,
          },
        },
        { headers: PUBLIC_CHECK_HEADERS }
      );
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
            publicationStatus: p.publicationStatus ?? "legacy_unreviewed",
          })),
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const pair = match.pair;
    return NextResponse.json(
      {
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
          publicationStatus: pair.publicationStatus ?? "legacy_unreviewed",
        },
      },
      { headers: PUBLIC_CHECK_HEADERS }
    );
  } catch {
    // Never log raw herb/drug terms from upstream errors.
    logger.error("interactions_check_error");
    return NextResponse.json(
      { found: false, unavailable: true },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
