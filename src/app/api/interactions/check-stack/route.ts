import { NextRequest, NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { resolveHerb } from "@/lib/interactions/resolve-herb";
import { matchInteractionPair } from "@/lib/interactions/check";
import { pairPath } from "@/lib/interactions/pair-url";
import {
  computeStackAlerts,
  highestSeverityOf,
  sortStackMatches,
  type StackHerbSummary,
  type StackMatchItem,
  type StackUnrecordedItem,
} from "@/lib/interactions/stack";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

const MAX_STACK_ITEMS = 10;

function normalizeTerms(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 120);
    if (trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Multi-herb × multi-medication safety checker.
 *
 * POST /api/interactions/check-stack
 * Body: { herbs: string[], drugs: string[], locale?: "en" | "fr" }
 */
export async function POST(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("interactions-stack", getClientIP(request)),
    30,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again in a minute.",
        rateLimited: true,
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { herbs?: unknown; drugs?: unknown; locale?: unknown };
  try {
    body = (await request.json()) as {
      herbs?: unknown;
      drugs?: unknown;
      locale?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const herbs = normalizeTerms(body.herbs);
  const drugs = normalizeTerms(body.drugs);

  if (
    !herbs ||
    !drugs ||
    herbs.length === 0 ||
    drugs.length === 0 ||
    herbs.length > MAX_STACK_ITEMS ||
    drugs.length > MAX_STACK_ITEMS
  ) {
    return NextResponse.json(
      {
        error: `Provide between 1 and ${MAX_STACK_ITEMS} herbs and between 1 and ${MAX_STACK_ITEMS} medications.`,
      },
      { status: 400 }
    );
  }

  const locale: "en" | "fr" =
    body.locale === "fr" || request.headers.get("x-locale") === "fr"
      ? "fr"
      : "en";

  const supabase = getAnonClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable.", unavailable: true },
      { status: 503 }
    );
  }

  try {
    const resolvedList = await Promise.all(
      herbs.map(async (input) => {
        const candidate = await resolveHerb(input);
        if (!candidate) {
          return {
            input,
            candidate: null,
            pairs: [],
          };
        }
        const pairs = await getHerbPairs(candidate.slug, locale);
        return { input, candidate, pairs };
      })
    );

    const herbSummaries: StackHerbSummary[] = [];
    const unresolvedHerbs: string[] = [];
    const matches: StackMatchItem[] = [];
    const unrecorded: StackUnrecordedItem[] = [];

    for (const item of resolvedList) {
      if (!item.candidate) {
        unresolvedHerbs.push(item.input);
        herbSummaries.push({
          input: item.input,
          found: false,
          slug: null,
          name: null,
          scientificName: null,
          pairCount: 0,
        });
        for (const drugInput of drugs) {
          unrecorded.push({
            herbInput: item.input,
            herbSlug: null,
            herbName: item.input,
            drugInput,
          });
        }
        continue;
      }

      const displayName =
        locale === "fr" && item.candidate.frName
          ? item.candidate.frName
          : item.candidate.name;

      herbSummaries.push({
        input: item.input,
        found: true,
        slug: item.candidate.slug,
        name: displayName,
        scientificName: item.candidate.scientific_name,
        pairCount: item.pairs.length,
      });

      for (const drugInput of drugs) {
        const pair = matchInteractionPair(drugInput, item.pairs);
        if (pair) {
          matches.push({
            herbInput: item.input,
            herbSlug: item.candidate.slug,
            herbName: displayName,
            drugInput,
            drugName: pair.drugName,
            drugSlug: pair.drugSlug,
            severity: pair.severity,
            description: pair.description,
            mechanism: pair.mechanism,
            evidenceLevel: pair.evidenceLevel,
            source: pair.source,
            sourceUrl: pair.sourceUrl,
            pairUrl: pairPath(item.candidate.slug, pair.drugName),
          });
        } else {
          unrecorded.push({
            herbInput: item.input,
            herbSlug: item.candidate.slug,
            herbName: displayName,
            drugInput,
          });
        }
      }
    }

    const sortedMatches = sortStackMatches(matches);
    const stackAlerts = computeStackAlerts(sortedMatches, locale);

    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        locale,
        herbs: herbSummaries,
        drugs,
        summary: {
          totalCombinations: herbs.length * drugs.length,
          matchedCount: sortedMatches.length,
          unrecordedCount: unrecorded.length,
          highestSeverity: highestSeverityOf(sortedMatches),
          unresolvedHerbs,
        },
        matches: sortedMatches,
        unrecorded,
        stackAlerts,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    logger.error("interactions_check_stack_error");
    return NextResponse.json(
      { error: "Unable to check stack right now.", unavailable: true },
      { status: 503 }
    );
  }
}
