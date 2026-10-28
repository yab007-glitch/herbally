import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { expandQueryToKeywords } from "@/lib/data/synonym-map";
import { localizeHerb } from "@/lib/utils/localize-herb";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { sanitizeFilterValue } from "@/lib/utils/ilike";
import { rankHerbResults } from "@/lib/search/rank-results";
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

    const { data: symptomResults, error: symptomError } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level, translations")
      .eq("is_published", true)
      .overlaps("symptom_keywords", expandedKeywords)
      .limit(30);

    // Sanitize each word to prevent ILIKE wildcard injection AND PostgREST
    // `.or()` filter-syntax injection (a `,` or `.` in the value would let a
    // caller inject an arbitrary filter clause — L2, audit 2026-06-22).
    // Cap words to bound PostgREST URL size and slow leading-wildcard ILIKEs.
    const words = term.trim().split(/\s+/).filter(Boolean).slice(0, 10);
    const textConditions = words
      .flatMap((w) => {
        const safe = sanitizeFilterValue(w);
        return [
          `name.ilike.%${safe}%`,
          `scientific_name.ilike.%${safe}%`,
          `description.ilike.%${safe}%`,
        ];
      })
      .join(",");

    const { data: textResults, error: textError } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level, translations")
      .eq("is_published", true)
      .or(textConditions)
      .limit(20);

    if (symptomError && textError) {
      return NextResponse.json([]);
    }

    const seen = new Set<string>();
    const results: Array<{
      id: string;
      name: string;
      slug: string;
      scientific_name: string;
      evidence_level: string | null;
      matchedBy: string;
    }> = [];
    const evidenceOrder: Record<string, number> = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      trad: 4,
    };

    // Localize symptom results
    const localizedSymptomResults = (symptomResults || []).map((h) =>
      localizeHerb(h as Herb, locale)
    );
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
        results.push({ ...herb, matchedBy: "symptom" });
      }
    }

    // Localize text results
    const localizedTextResults = (textResults || []).map((h) =>
      localizeHerb(h as Herb, locale)
    );
    for (const herb of localizedTextResults) {
      if (!seen.has(herb.id)) {
        seen.add(herb.id);
        results.push({ ...herb, matchedBy: "name" });
      }
    }

    // Rank exact/prefix name matches first. Previously symptom matches
    // (evidence-sorted) always outranked text matches, so typing an exact
    // herb name like "Turmeric" surfaced obscure variants while the exact
    // herb sat below the fold. Stable sort preserves the existing
    // evidence/DB order within each rank.
    return NextResponse.json(rankHerbResults(results, term));
  } catch {
    // Upstream errors may include search terms; never log their raw text.
    logger.error("herbs_search_error");
    return NextResponse.json([]);
  }
}

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) return rateLimitedResponse();
  const term = request.nextUrl.searchParams.get("q");
  if (!term || term.length < 2 || term.length > 200) {
    return NextResponse.json([]);
  }
  return searchHerbs(term, getLocale(request));
}

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
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
