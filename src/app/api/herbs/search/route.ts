import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { expandQueryToKeywords } from "@/lib/data/synonym-map";
import { localizeHerb } from "@/lib/utils/localize-herb";
import {
  buildHerbNameAnchorFilter,
  buildHerbPreciseNameFilter,
  buildHerbTextOrFilter,
} from "@/lib/search/normalize-query";
import { logger } from "@/lib/utils/logger";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";
import { rankHerbResults } from "@/lib/search/rank-results";
import { dedupeSymptomResults } from "@/lib/search/symptom-results";
import type { Herb } from "@/lib/types";

const searchBodySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

const PUBLIC_SEARCH_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  Vary: "x-locale",
};
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function rateLimitedResponse() {
  return NextResponse.json([], {
    status: 429,
    headers: { "Retry-After": "60", ...NO_STORE_HEADERS },
  });
}

function getLocale(request: NextRequest): "en" | "fr" {
  // Locale from the x-locale header (set by proxy from URL)
  return request.headers.get("x-locale") === "fr" ? "fr" : "en";
}

async function searchHerbs(
  term: string,
  locale: "en" | "fr",
  allowPublicCache: boolean
) {
  try {
    const supabase = await createClient();
    const expandedKeywords = expandQueryToKeywords(term);

    // Sanitize each token to prevent ILIKE wildcard & PostgREST `.or()` filter
    // injection, matching English names, Latin binomials, descriptions, and
    // French translated names (`translations->fr->>name`).
    const textConditions = buildHerbTextOrFilter(term);
    // Rows whose OWN name carries every word the reader typed. The broad
    // filter above matches any word in any field, and `limit` samples that set
    // in whatever order the database returns: on 2026-11-17 "licorice root"
    // surfaced Beaucarnea recurvata first and "st johns wort" surfaced Aster
    // tataricus, because the real rows never entered the window. The precise
    // pass guarantees they do; ranking then puts them at the top.
    const preciseConditions = buildHerbPreciseNameFilter(term);
    // Qualified names ("ginkgo leaf", "milk thistle seed") whose full word
    // list is in no single name are caught by the anchor words. The anchor is
    // queried separately, with its own limit: joined into the same `.or()`,
    // its loose alternatives compete with the precise rows for one unordered
    // window. On 2026-11-17 the anchor for "st johns wort" was
    // `name.ilike.%st%`, which matched 249 published names, so the forty rows
    // returned contained none of the rows whose name carries every typed word.
    const anchorConditions = buildHerbNameAnchorFilter(term);
    const herbColumns =
      "id, name, slug, scientific_name, evidence_level, translations";

    const [symptomResponse, preciseResponse, anchorResponse, textResponse] =
      await Promise.all([
        supabase
          .from("herbs_public" as never)
          .select(`${herbColumns}, symptom_keywords`)
          .eq("is_published", true)
          .overlaps("symptom_keywords", expandedKeywords)
          .limit(30),
        preciseConditions
          ? supabase
              .from("herbs_public" as never)
              .select(herbColumns)
              .eq("is_published", true)
              .or(preciseConditions)
              .limit(40)
          : Promise.resolve({ data: [], error: null }),
        anchorConditions
          ? supabase
              .from("herbs_public" as never)
              .select(herbColumns)
              .eq("is_published", true)
              .or(anchorConditions)
              .limit(40)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("herbs_public" as never)
          .select(herbColumns)
          .eq("is_published", true)
          .or(textConditions)
          .limit(40),
      ]);

    const { data: symptomResults, error: symptomError } = symptomResponse;
    const { data: preciseResults, error: preciseError } = preciseResponse;
    const { data: anchorResults, error: anchorError } = anchorResponse;
    const { data: textResults, error: textError } = textResponse;

    if (symptomError && preciseError && anchorError && textError) {
      return NextResponse.json([], { headers: NO_STORE_HEADERS });
    }

    // Per-input-word expansions, so a result can say WHICH of the user's
    // search terms it matched (e.g. "sleep" and "anxiety"), not just that
    // some expanded synonym overlapped. Match criteria are unchanged:
    // the same expanded-keyword overlap query as before.
    const inputWords = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const expandedSet = new Set(expandedKeywords.map((k) => k.toLowerCase()));
    const matchedInputsFor = (keywords: string[] | null): string[] => {
      const keywordSet = new Set((keywords ?? []).map((k) => k.toLowerCase()));
      return inputWords.filter((word) =>
        expandQueryToKeywords(word).some((k) => keywordSet.has(k.toLowerCase()))
      );
    };

    const seen = new Set<string>();
    const results: Array<{
      id: string;
      name: string;
      slug: string;
      scientific_name: string;
      evidence_level: string | null;
      translations?: unknown;
      matchedBy: string;
      matchedKeywords: string[];
      matchedInputs: string[];
    }> = [];
    const evidenceOrder: Record<string, number> = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      trad: 4,
    };

    // Localize symptom results, attaching which keywords/inputs matched.
    // symptom_keywords is only used to explain the match; it is not
    // returned as a new filter and does not change which rows qualify.
    const localizedSymptomResults = (symptomResults || []).map((h) => {
      const localized = localizeHerb(h as Herb, locale);
      const keywords =
        ((h as { symptom_keywords?: unknown }).symptom_keywords as
          string[] | null) ?? null;
      const matchedKeywords = (keywords ?? []).filter((k) =>
        expandedSet.has(k.toLowerCase())
      );
      return {
        id: localized.id,
        name: localized.name,
        slug: localized.slug,
        scientific_name: localized.scientific_name,
        evidence_level: localized.evidence_level,
        translations: localized.translations,
        matchedBy: "symptom",
        matchedKeywords,
        matchedInputs: matchedInputsFor(keywords),
      };
    });
    const sortedSymptomResults = localizedSymptomResults.sort(
      (
        a: { evidence_level: string | null },
        b: { evidence_level: string | null }
      ) => {
        const ea = evidenceOrder[a.evidence_level || "C"] ?? 2;
        const eb = evidenceOrder[b.evidence_level || "C"] ?? 2;
        return ea - eb;
      }
    );

    for (const herb of sortedSymptomResults) {
      if (!seen.has(herb.id)) {
        seen.add(herb.id);
        results.push(herb);
      }
    }

    // Name matches for every typed word, ahead of the broad description
    // matches. Ranking still sorts by name similarity; this order decides
    // ties and which row survives de-duplication.
    const localizedPreciseResults = (preciseResults || []).map((h) =>
      localizeHerb(h as Herb, locale)
    );
    for (const herb of localizedPreciseResults) {
      if (!seen.has(herb.id)) {
        seen.add(herb.id);
        results.push({
          id: herb.id,
          name: herb.name,
          slug: herb.slug,
          scientific_name: herb.scientific_name,
          evidence_level: herb.evidence_level,
          translations: herb.translations,
          matchedBy: "name",
          matchedKeywords: [],
          matchedInputs: [],
        });
      }
    }

    // Anchor matches for qualified names ("ginkgo leaf"), behind the exact
    // name rows and ahead of the broad matches.
    const localizedAnchorResults = (anchorResults || []).map((h) =>
      localizeHerb(h as Herb, locale)
    );
    for (const herb of localizedAnchorResults) {
      if (!seen.has(herb.id)) {
        seen.add(herb.id);
        results.push({
          id: herb.id,
          name: herb.name,
          slug: herb.slug,
          scientific_name: herb.scientific_name,
          evidence_level: herb.evidence_level,
          translations: herb.translations,
          matchedBy: "name",
          matchedKeywords: [],
          matchedInputs: [],
        });
      }
    }

    // Localize text results
    const localizedTextResults = (textResults || []).map((h) =>
      localizeHerb(h as Herb, locale)
    );
    for (const herb of localizedTextResults) {
      if (!seen.has(herb.id)) {
        seen.add(herb.id);
        results.push({
          id: herb.id,
          name: herb.name,
          slug: herb.slug,
          scientific_name: herb.scientific_name,
          evidence_level: herb.evidence_level,
          translations: herb.translations,
          matchedBy: "name",
          matchedKeywords: [],
          matchedInputs: [],
        });
      }
    }

    const safePayload = dedupeSymptomResults(
      rankHerbResults(results, term)
    ).map(
      ({
        id,
        name,
        slug,
        scientific_name,
        evidence_level,
        matchedBy,
        matchedKeywords,
        matchedInputs,
      }) => ({
        id,
        name,
        slug,
        scientific_name,
        evidence_level,
        matchedBy,
        matchedKeywords,
        matchedInputs,
      })
    );
    return NextResponse.json(safePayload, {
      headers: allowPublicCache ? PUBLIC_SEARCH_HEADERS : NO_STORE_HEADERS,
    });
  } catch {
    // Upstream errors may include search terms; never log their raw text.
    logger.error("herbs_search_error");
    return NextResponse.json([], { headers: NO_STORE_HEADERS });
  }
}

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("herbs-search", getClientIP(request)),
    30,
    60_000
  );
  if (!success) return rateLimitedResponse();
  const term = request.nextUrl.searchParams.get("q");
  if (!term || term.length < 2 || term.length > 200) {
    return NextResponse.json([], { headers: NO_STORE_HEADERS });
  }
  return searchHerbs(term, getLocale(request), true);
}

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("herbs-search", getClientIP(request)),
    30,
    60_000
  );
  if (!success) return rateLimitedResponse();
  const bodyResult = await readJsonBodyWithLimit(request, 10_240);
  if (!bodyResult.ok) {
    return NextResponse.json([], {
      status: bodyResult.reason === "too_large" ? 413 : 400,
      headers: NO_STORE_HEADERS,
    });
  }
  const parsed = searchBodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json([], { status: 400, headers: NO_STORE_HEADERS });
  }
  return searchHerbs(parsed.data.q, getLocale(request), false);
}
