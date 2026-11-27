import { unstable_cache } from "next/cache";
import {
  getAllDangerousHerbs,
  type DangerousHerbRecord,
} from "@/lib/data/dangerous-herbs";
import {
  getGovernanceCoverageStats,
  type GovernanceCoverageStats,
} from "@/lib/governance/coverage-stats";
import {
  aggregateMedications,
  type MedicationSummary,
} from "@/lib/interactions/medications";
import {
  getInteractionPairs,
  type InteractionPair,
} from "@/lib/interactions/pairs";
import { SEVERITY_WEIGHT } from "@/lib/interactions/stack";

export const OPEN_DATA_DATASET_VERSION = "3.13.0";

export interface OpenDataAtomicSnapshot {
  datasetVersion: string;
  snapshotId: string;
  generatedAt: string;
  stats: GovernanceCoverageStats;
  activePairs: InteractionPair[];
  medications: MedicationSummary[];
  quarantinedBotanicals: DangerousHerbRecord[];
}

export function buildSnapshotId(generatedAt: string): string {
  const compact = generatedAt.slice(0, 19).replace(/[-:]/g, "");
  return `herbally-open-data-${OPEN_DATA_DATASET_VERSION}-${compact}Z`;
}

export function sortActivePairs(
  pairs: ReadonlyArray<InteractionPair>
): InteractionPair[] {
  return pairs
    .filter((p) => p.publicationStatus !== "retracted_hold")
    .sort((a, b) => {
      const herbCmp = a.herbSlug.localeCompare(b.herbSlug);
      if (herbCmp !== 0) return herbCmp;
      return a.drugSlug.localeCompare(b.drugSlug);
    });
}

export function sortMedicationsFromPairs(
  pairs: ReadonlyArray<InteractionPair>
): MedicationSummary[] {
  const bySlug = aggregateMedications(pairs);
  return Array.from(bySlug.values())
    .map(({ interactions: _ignored, ...summary }) => summary)
    .sort((a, b) => {
      if (b.totalInteractions !== a.totalInteractions) {
        return b.totalInteractions - a.totalInteractions;
      }
      const sevDiff =
        (SEVERITY_WEIGHT[b.highestSeverity] ?? 0) -
        (SEVERITY_WEIGHT[a.highestSeverity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return a.drugName.localeCompare(b.drugName);
    });
}

export function buildOpenDataSnapshot(
  stats: GovernanceCoverageStats,
  allPairs: ReadonlyArray<InteractionPair>,
  quarantinedBotanicals: DangerousHerbRecord[] = getAllDangerousHerbs()
): OpenDataAtomicSnapshot {
  const activePairs = sortActivePairs(allPairs);
  const medications = sortMedicationsFromPairs(activePairs);
  const baseMs = stats.available
    ? Date.parse(stats.generatedAt) || Date.now()
    : Date.now();
  // Align snapshot boundary to the 3600s ISR revalidate window so parallel
  // static/ISR route renders never drift by a few seconds between endpoints.
  const generatedAt = new Date(
    Math.floor(baseMs / 3_600_000) * 3_600_000
  ).toISOString();

  return {
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: buildSnapshotId(generatedAt),
    generatedAt,
    stats,
    activePairs,
    medications,
    quarantinedBotanicals,
  };
}

export const getOpenDataSnapshot = unstable_cache(
  async (): Promise<OpenDataAtomicSnapshot> => {
    const [stats, allPairs] = await Promise.all([
      getGovernanceCoverageStats(),
      getInteractionPairs("en"),
    ]);
    return buildOpenDataSnapshot(stats, allPairs, getAllDangerousHerbs());
  },
  ["open-data-atomic-snapshot-v1"],
  {
    revalidate: 3600,
    tags: ["governance-stats", "open-data"],
  }
);
