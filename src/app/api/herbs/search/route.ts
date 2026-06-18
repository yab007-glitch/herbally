import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expandQueryToKeywords } from "@/lib/data/synonym-map";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const term = searchParams.get("q");

  if (!term || term.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const supabase = await createClient();
    const expandedKeywords = expandQueryToKeywords(term);

    const { data: symptomResults, error: symptomError } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level")
      .eq("is_published", true)
      .overlaps("symptom_keywords", expandedKeywords)
      .limit(30);

    const words = term.trim().split(/\s+/).filter(Boolean);
    const textConditions = words
      .flatMap((w) => [
        `name.ilike.%${w}%`,
        `scientific_name.ilike.%${w}%`,
        `description.ilike.%${w}%`,
      ])
      .join(",");

    const { data: textResults, error: textError } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, evidence_level")
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
    const sortedSymptomResults = (symptomResults || []).sort(
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

    for (const herb of textResults || []) {
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
