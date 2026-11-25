import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { resolveHerb } from "@/lib/interactions/resolve-herb";
import { matchInteractionPairDetailed } from "@/lib/interactions/check";
import { pairPath } from "@/lib/interactions/pair-url";
import {
  computeStackAlerts,
  highestSeverityOf,
  sortStackMatches,
  type StackConflictItem,
  type StackHerbSummary,
  type StackMatchItem,
  type StackUnrecordedItem,
} from "@/lib/interactions/stack";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";

const MAX_STACK_ITEMS = 10;

const checkStackBodySchema = z.object({
  herbs: z.array(z.string()).max(MAX_STACK_ITEMS * 2),
  drugs: z.array(z.string()).max(MAX_STACK_ITEMS * 2),
  locale: z.enum(["en", "fr"]).optional(),
});

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

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

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
      { status: 429, headers: { "Retry-After": "60", ...NO_STORE_HEADERS } }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, 16 * 1024);
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        error:
          bodyResult.reason === "too_large"
            ? "Request body too large."
            : "Invalid JSON body.",
      },
      {
        status: bodyResult.reason === "too_large" ? 413 : 400,
        headers: NO_STORE_HEADERS,
      }
    );
  }
  const rawBody = bodyResult.data;

  const parsedBody = checkStackBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: `Provide between 1 and ${MAX_STACK_ITEMS} herbs and between 1 and ${MAX_STACK_ITEMS} medications.`,
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const herbs = normalizeTerms(parsedBody.data.herbs);
  const drugs = normalizeTerms(parsedBody.data.drugs);

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
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const locale: "en" | "fr" =
    parsedBody.data.locale === "fr" || request.headers.get("x-locale") === "fr"
      ? "fr"
      : "en";

  const supabase = getAnonClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable.", unavailable: true },
      { status: 503, headers: NO_STORE_HEADERS }
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
    const conflicts: StackConflictItem[] = [];
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
        const match = matchInteractionPairDetailed(drugInput, item.pairs);
        if (match.kind === "collision") {
          logger.warn("interactions_check_stack_collision", {
            herbSlug: item.candidate.slug,
            drugSlug: match.drugSlug,
            count: match.pairs.length,
          });
          conflicts.push({
            herbInput: item.input,
            herbSlug: item.candidate.slug,
            herbName: displayName,
            drugInput,
            drugSlug: match.drugSlug,
            pairUrl: `/interactions/${item.candidate.slug}/${match.drugSlug}`,
            records: match.pairs.map((pair) => ({
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
            })),
          });
        } else if (match.kind === "match") {
          const pair = match.pair;
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
          conflictCount: conflicts.length,
          hasConflicts: conflicts.length > 0,
          highestSeverity: highestSeverityOf(sortedMatches),
          unresolvedHerbs,
        },
        matches: sortedMatches,
        conflicts,
        unrecorded,
        stackAlerts,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    logger.error("interactions_check_stack_error");
    return NextResponse.json(
      { error: "Unable to check stack right now.", unavailable: true },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
