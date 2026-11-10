import { NextRequest, NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { matchInteractionPair } from "@/lib/interactions/check";
import { pairPath } from "@/lib/interactions/pair-url";
import { escapeForIlike } from "@/lib/utils/ilike";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

function getLocale(request: NextRequest): "en" | "fr" {
  return request.headers.get("x-locale") === "fr" ? "fr" : "en";
}

interface HerbCandidate {
  slug: string;
  name: string;
  scientific_name: string;
}

/**
 * Resolve a free-text herb name to a published herb row.
 * Prefers an exact (case-insensitive) name/scientific-name match, then
 * a prefix match, then the first ILIKE candidate — the same ranking
 * discipline as the herb search route, without inventing a herb.
 */
async function resolveHerb(term: string): Promise<HerbCandidate | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;
  const safe = escapeForIlike(term.trim());
  const { data, error } = await supabase
    .from("herbs")
    .select("slug,name,scientific_name")
    .eq("is_published", true)
    .or(`name.ilike.%${safe}%,scientific_name.ilike.%${safe}%`)
    .limit(20);
  if (error || !data || data.length === 0) return null;
  const rows = data as HerbCandidate[];
  const lower = term.trim().toLowerCase();
  return (
    rows.find(
      (r) =>
        r.name.toLowerCase() === lower ||
        r.scientific_name.toLowerCase() === lower
    ) ??
    rows.find((r) => r.name.toLowerCase().startsWith(lower)) ??
    rows[0]
  );
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
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) {
    return NextResponse.json(
      { found: false, unavailable: true },
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
    const herb = await resolveHerb(herbTerm);
    if (!herb) return NextResponse.json({ found: false, herb: null });

    const pairs = await getHerbPairs(herb.slug, getLocale(request));
    const pair = matchInteractionPair(drugTerm, pairs);
    if (!pair) {
      return NextResponse.json({
        found: false,
        herb: {
          slug: herb.slug,
          name: herb.name,
          scientific_name: herb.scientific_name,
        },
      });
    }

    return NextResponse.json({
      found: true,
      herb: {
        slug: herb.slug,
        name: herb.name,
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
