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
import { rankHerbResults } from "@/lib/search/rank-results";
import { dedupeSymptomResults } from "@/lib/search/symptom-results";
import type { Herb } from "@/lib/types";

const searchBodySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

function rateLimitedResponse() {
  return NextResponse.json([], {
    status: 429,
    headers: { "Retry-After": "60" },
  });
}

function getLocale(request: NextRequest): "en" | "fr" {
  // Locale from the x-locale header (set by proxy from URL)
  return request.headers.get("x-locale") === "fr" ? "fr" : "en";
}

async function searchHerbs(term: string, locale: "en" | "fr") {
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
    // The same query also carries the anchor words, so a qualified name
    // ("ginkgo leaf") still puts a name match in the candidate set.
    const nameConditions = [preciseConditions, buildHerbNameAnchorFilter(term)]
      .filter(Boolean)
      .join(",");
    const herbColumns =
      "id, name, slug, scientific_name, evidence_level, translations";

    const [symptomResponse, preciseResponse, textResponse] = await Promise.all([
      supabase
        .from("herbs")
        .select(`${herbColumns}, symptom_keywords`)
        .eq("is_published", true)
        .overlaps("symptom_keywords", expandedKeywords)
        .limit(30),
      nameConditions
        ? supabase
            .from("herbs")
            .select(herbColumns)
            .eq("is_published", true)
            .or(nameConditions)
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("herbs")
        .select(herbColumns)
        .eq("is_published", true)
        .or(textConditions)
        .limit(40),
    ]);

    const { data: symptomResults, error: symptomError } = symptomResponse;
    const { data: preciseResults, error: preciseError } = preciseResponse;
    const { data: textResults, error: textError } = textResponse;

    if (symptomError && preciseError && textError) {
      return NextResponse.json([]);
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
        ...localized,
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
          ...herb,
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
          ...herb,
          matchedBy: "name",
          matchedKeywords: [],
          matchedInputs: [],
        });
      }
    }

    // Rank exact/prefix name matches first. Previously symptom matches
    // (evidence-sorted) always outranked text matches, so typing an exact
    // herb name like "Turmeric" surfaced obscure variants while the exact
    // herb sat below the fold. Stable sort preserves the existing
    // evidence/DB order within each rank.
    //
    // Rank BEFORE collapsing rows that share a scientific name: the collapse
    // keeps the first row per plant, so ranking afterwards lets an arbitrary
    // database order decide which name represents it. "ginkgo" returned
    // "Bai Guo" (Ginkgo biloba seed) and "Ginkgo Biloba"; with the old order
    // the seed entry could win the plant even though the exact name match was
    // the other row.
    return NextResponse.json(
      dedupeSymptomResults(rankHerbResults(results, term))
    );
  } catch {
    // Upstream errors may include search terms; never log their raw text.
    logger.error("herbs_search_error");
    return NextResponse.json([]);
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
    return NextResponse.json([]);
  }
  return searchHerbs(term, getLocale(request));
}

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("herbs-search", getClientIP(request)),
    30,
    60_000
  );
  if (!success) return rateLimitedResponse();
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 10_240) return NextResponse.json([], { status: 413 });
    if (!request.body) return NextResponse.json([], { status: 400 });
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 10_240) {
        await reader.cancel();
        return NextResponse.json([], { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = searchBodySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json([], { status: 400 });
    return searchHerbs(parsed.data.q, getLocale(request));
  } catch {
    return NextResponse.json([], { status: 400 });
  }
}
