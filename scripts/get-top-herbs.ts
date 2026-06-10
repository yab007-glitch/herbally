import { createClient } from "@supabase/supabase-js";

// Script to identify top 120 herbs for hand-written monographs
async function getTopHerbs() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: herbs, error } = await supabase
    .from("herbs")
    .select(
      "id, name, slug, scientific_name, evidence_level, modern_uses, traditional_uses, active_compounds, description, citations, view_count"
    )
    .eq("is_published", true)
    .order("name", { ascending: true });

  if (error || !herbs) {
    console.error("Error:", error);
    process.exit(1);
  }

  // Score each herb
  const scored = herbs.map((herb) => {
    const evidenceScore =
      herb.evidence_level === "A"
        ? 4
        : herb.evidence_level === "B"
          ? 3
          : herb.evidence_level === "C"
            ? 2
            : 1;

    const useCount =
      (herb.modern_uses?.length || 0) + (herb.traditional_uses?.length || 0);
    const hasCitations = herb.citations?.length > 0 ? 1 : 0;
    const hasCompounds = herb.active_compounds?.length > 0 ? 1 : 0;
    // Log-scaled so a single bot can't blow up the score, but popular herbs
    // do surface above the long tail.
    const viewScore = Math.min(50, Math.log10(1 + (herb.view_count ?? 0)) * 10);

    const priorityScore =
      evidenceScore * 15 + useCount + hasCitations * 10 + hasCompounds * 5 + viewScore;

    return {
      name: herb.name,
      slug: herb.slug,
      scientific_name: herb.scientific_name,
      evidence_level: herb.evidence_level,
      priority_score: Math.round(priorityScore * 10) / 10,
    };
  });

  // Sort by priority score descending
  scored.sort((a, b) => b.priority_score - a.priority_score);

  // Output top 120
  const top120 = scored.slice(0, 120);

  console.log("export const TOP_120_HERBS = [");
  top120.forEach((h) => {
    console.log(
      `  { slug: "${h.slug}", name: "${h.name}", evidence: "${h.evidence_level}", score: ${h.priority_score} },`
    );
  });
  console.log("];");
}

getTopHerbs();
