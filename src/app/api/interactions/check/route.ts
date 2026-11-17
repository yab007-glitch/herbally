import { NextRequest, NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { matchInteractionPair } from "@/lib/interactions/check";
import { pairPath } from "@/lib/interactions/pair-url";
import { rankHerbMatches } from "@/lib/interactions/rank-herb-match";
import {
  buildHerbNameAnchorFilter,
  buildHerbPreciseNameFilter,
  buildHerbTextOrFilter,
} from "@/lib/search/normalize-query";
import { extractFrenchHerbName } from "@/lib/utils/localize-herb";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

function getLocale(request: NextRequest): "en" | "fr" {
  if (request.headers.get("x-locale") === "fr") return "fr";
  return request.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
}

interface HerbCandidate {
  slug: string;
  name: string;
  scientific_name: string;
  frName?: string | null;
}

/**
 * Resolve a free-text herb name to a published herb row across English,
 * scientific, and French names (`translations->fr->>name`).
 */
async function resolveHerb(term: string): Promise<HerbCandidate | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  // Two candidate sets. The precise one is rows whose own name carries every
  // typed word; the broad one is the old any-word-in-any-name filter. The
  // broad filter alone with `limit 20` picked whichever twenty rows the
  // database returned first, so on 2026-11-17 "st johns wort" resolved to
  // Aster tataricus and the checker answered found:false for sertraline — a
  // false "no interaction" on the most important herb-drug pair there is.
  const preciseFilter = [
    buildHerbPreciseNameFilter(term, { maxTokens: 5 }),
    buildHerbNameAnchorFilter(term, { maxTokens: 5 }),
  ]
    .filter(Boolean)
    .join(",");
  const broadFilter = buildHerbTextOrFilter(term, {
    includeDescription: false,
    maxTokens: 5,
  });
  if (!preciseFilter && !broadFilter) return null;
  const columns = "slug,name,scientific_name,translations";
  const [preciseResponse, broadResponse] = await Promise.all([
    preciseFilter
      ? supabase
          .from("herbs")
          .select(columns)
          .eq("is_published", true)
          .or(preciseFilter)
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    broadFilter
      ? supabase
          .from("herbs")
          .select(columns)
          .eq("is_published", true)
          .or(broadFilter)
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  // Both queries failed: the database could not be asked, not "no such herb".
  if (preciseResponse.error && broadResponse.error) return null;
  const rows = [...(preciseResponse.data ?? []), ...(broadResponse.data ?? [])];
  if (rows.length === 0) return null;
  const seen = new Set<string>();
  const candidates: HerbCandidate[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    candidates.push({
      slug: row.slug,
      name: row.name,
      scientific_name: row.scientific_name,
      frName: extractFrenchHerbName(row.translations),
    });
  }
  return rankHerbMatches(candidates, term) ?? null;
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
  const herbTerm = request.nextUrl.searchParams.get("herb")?.trim() ?? "";
  const drugTerm = request.nextUrl.searchParams.get("drug")?.trim() ?? "";
  if (
    herbTerm.length < 2 ||
    herbTerm.length > 200 ||
    drugTerm.length < 2 ||
    drugTerm.length > 200
  ) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

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
    const pair = matchInteractionPair(drugTerm, pairs);
    if (!pair) {
      return NextResponse.json({
        found: false,
        herb: {
          slug: herb.slug,
          name: displayName,
          scientific_name: herb.scientific_name,
        },
      });
    }

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
