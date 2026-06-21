import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expandQueryToKeywords } from "@/lib/data/synonym-map";
import { localizeHerb } from "@/lib/utils/localize-herb";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import type { Herb } from "@/lib/types";

/**
 * Escape special ILIKE pattern characters so user-supplied search terms
 * are treated as literal strings, not wildcards.
 */
function escapeForIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) {
    return NextResponse.json([], {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  const searchParams = request.nextUrl.searchParams;
  const term = searchParams.get("q");

  if (!term || term.length < 2) {
    return NextResponse.json([]);
  }

  // Determine locale from the x-locale header (set by proxy from URL)
  const locale =
    request.headers.get("x-locale") === "fr" ? "fr" : "en";

  try {
    const supabase = await createClient();
    const expandedKeywords = expandQueryToKeywords(term);

    const { data: symptomResults, error: symptomError } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level, translations")
      .eq("is_published", true)
      .overlaps("symptom_keywords", expandedKeywords)
      .limit(30);

    // Sanitize each word to prevent ILIKE wildcard injection
    const words = term.trim().split(/\s+/).filter(Boolean);
    const textConditions = words
      .flatMap((w) => {
        const safe = escapeForIlike(w);
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

    return NextResponse.json(results);
  } catch (err) {
    logger.error("herbs_search_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json([]);
  }
}