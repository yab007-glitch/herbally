import { unstable_cache } from "next/cache";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { drugSlug } from "@/lib/interactions/pair-url";

export interface PublicCorrectionEntry {
  id: string;
  affected_surface: string;
  correction_summary: string;
  corrected_at: string;
  verified_by: string | null;
}

export interface GovernanceCoverageStats {
  available: boolean;
  generatedAt: string;
  totalHerbs: number;
  sourceCheckedHerbs: number;
  clinicallyReviewedHerbs: number;
  totalInteractions: number;
  totalMedications: number;
  clinicianApprovedInteractions: number;
  legacyUnreviewedInteractions: number;
  corrections: PublicCorrectionEntry[];
}

const EMPTY_STATS = (): GovernanceCoverageStats => ({
  available: false,
  generatedAt: new Date().toISOString(),
  totalHerbs: 0,
  sourceCheckedHerbs: 0,
  clinicallyReviewedHerbs: 0,
  totalInteractions: 0,
  totalMedications: 0,
  clinicianApprovedInteractions: 0,
  legacyUnreviewedInteractions: 0,
  corrections: [],
});

type QueryClient = NonNullable<ReturnType<typeof getAnonClient>>;

interface InteractionCoverageRow {
  id: string;
  drug_name: string | null;
  clinical_action_status?: string | null;
}

export async function fetchGovernanceCoverageStats(
  client: QueryClient | null
): Promise<GovernanceCoverageStats> {
  if (!client) {
    return EMPTY_STATS();
  }

  try {
    const [
      totalHerbsRes,
      sourceCheckedRes,
      clinicallyReviewedRes,
      interactionsRes,
      correctionsRes,
    ] = await Promise.all([
      client
        .from("herbs_public" as never)
        .select("id", { count: "exact", head: true }),
      client
        .from("herbs_public" as never)
        .select("id", { count: "exact", head: true })
        .in("provenance->>verification_status", ["verified", "single_source"]),
      client
        .from("herbs_public" as never)
        .select("id", { count: "exact", head: true })
        .eq("provenance->>review_status", "human_reviewed")
        .eq("provenance->>review_role", "clinical"),
      client
        .from("drug_interactions" as never)
        .select(
          "id, drug_name, clinical_action_status, herbs!inner(is_published)"
        )
        .eq("herbs.is_published", true)
        .limit(5000),
      client
        .from("public_corrections_log" as never)
        .select(
          "id, affected_surface, correction_summary, corrected_at, verified_by"
        )
        .order("corrected_at", { ascending: false })
        .limit(10),
    ]);

    if (totalHerbsRes.error || interactionsRes.error) {
      return EMPTY_STATS();
    }

    const totalHerbs = totalHerbsRes.count ?? 0;
    const sourceCheckedHerbs = sourceCheckedRes.error
      ? 0
      : (sourceCheckedRes.count ?? 0);
    const clinicallyReviewedHerbs = clinicallyReviewedRes.error
      ? 0
      : (clinicallyReviewedRes.count ?? 0);
    const interactionRows = Array.isArray(interactionsRes.data)
      ? (interactionsRes.data as InteractionCoverageRow[])
      : [];
    const totalInteractions = interactionRows.length;
    const clinicianApprovedInteractions = interactionRows.filter(
      (r) => r.clinical_action_status === "clinician_approved"
    ).length;
    const totalMedications = new Set(
      interactionRows
        .map((r) => (r.drug_name ? drugSlug(r.drug_name) : ""))
        .filter(Boolean)
    ).size;
    const legacyUnreviewedInteractions = Math.max(
      0,
      totalInteractions - clinicianApprovedInteractions
    );

    const corrections =
      !correctionsRes.error && Array.isArray(correctionsRes.data)
        ? (correctionsRes.data as PublicCorrectionEntry[])
        : [];

    return {
      available: true,
      generatedAt: new Date().toISOString(),
      totalHerbs,
      sourceCheckedHerbs,
      clinicallyReviewedHerbs,
      totalInteractions,
      totalMedications,
      clinicianApprovedInteractions,
      legacyUnreviewedInteractions,
      corrections,
    };
  } catch {
    return EMPTY_STATS();
  }
}

export const getGovernanceCoverageStats = unstable_cache(
  async (): Promise<GovernanceCoverageStats> => {
    const client = getAnonClient();
    return fetchGovernanceCoverageStats(client);
  },
  ["governance-coverage-stats-v3"],
  {
    revalidate: 3600,
    tags: ["governance-stats"],
  }
);
