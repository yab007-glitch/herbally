import {
  getInteractionPairs,
  type InteractionPair,
  type InteractionSeverity,
} from "./pairs";
import { SEVERITY_WEIGHT } from "./stack";

export interface MedicationSampleHerb {
  slug: string;
  name: string;
  severity: InteractionSeverity;
}

export interface MedicationSummary {
  drugSlug: string;
  drugName: string;
  enDrugName: string;
  totalInteractions: number;
  highestSeverity: InteractionSeverity;
  countsBySeverity: Record<InteractionSeverity, number>;
  sampleHerbs: MedicationSampleHerb[];
  hasFr: boolean;
  updatedAt: string | null;
}

export interface MedicationDetail extends MedicationSummary {
  interactions: InteractionPair[];
}

function emptySeverityCounts(): Record<InteractionSeverity, number> {
  return {
    contraindicated: 0,
    severe: 0,
    moderate: 0,
    mild: 0,
  };
}

/**
 * Group flat herb-drug interaction pairs into reverse-lookup medication records
 * keyed by `drugSlug`. Pure and deterministic so it can be unit-tested offline.
 */
export function aggregateMedications(
  pairs: ReadonlyArray<InteractionPair>
): Map<string, MedicationDetail> {
  const grouped = new Map<string, InteractionPair[]>();
  for (const pair of pairs) {
    if (!pair.drugSlug) continue;
    const list = grouped.get(pair.drugSlug);
    if (list) {
      list.push(pair);
    } else {
      grouped.set(pair.drugSlug, [pair]);
    }
  }

  const result = new Map<string, MedicationDetail>();

  for (const [slug, group] of grouped) {
    // Sort interactions by severity (most critical first), then alphabetically by herb name.
    const sorted = [...group].sort((a, b) => {
      const sevDiff =
        (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return a.herbName.localeCompare(b.herbName);
    });

    const counts = emptySeverityCounts();
    let highestSeverity: InteractionSeverity = "mild";
    let highestWeight = 0;
    let hasFr = false;
    let latestUpdatedAt: string | null = null;

    // Pick the most frequent display name (breaking ties toward richer parenthetical label).
    const displayVotes = new Map<string, number>();
    const enVotes = new Map<string, number>();

    const seenHerbs = new Set<string>();
    const sampleHerbs: MedicationSampleHerb[] = [];

    for (const pair of sorted) {
      counts[pair.severity] = (counts[pair.severity] ?? 0) + 1;
      const weight = SEVERITY_WEIGHT[pair.severity] ?? 0;
      if (weight > highestWeight) {
        highestWeight = weight;
        highestSeverity = pair.severity;
      }
      if (pair.hasFr) {
        hasFr = true;
      }
      if (
        pair.updatedAt &&
        (!latestUpdatedAt || pair.updatedAt > latestUpdatedAt)
      ) {
        latestUpdatedAt = pair.updatedAt;
      }

      const displayName = pair.localizedDrugName || pair.drugName;
      displayVotes.set(displayName, (displayVotes.get(displayName) ?? 0) + 1);
      enVotes.set(pair.drugName, (enVotes.get(pair.drugName) ?? 0) + 1);

      if (!seenHerbs.has(pair.herbSlug) && sampleHerbs.length < 5) {
        seenHerbs.add(pair.herbSlug);
        sampleHerbs.push({
          slug: pair.herbSlug,
          name: pair.herbName,
          severity: pair.severity,
        });
      }
    }

    const pickWinner = (votes: Map<string, number>, fallback: string) => {
      let best = fallback;
      let bestScore = -1;
      for (const [name, count] of votes) {
        // Prefer more votes; tie-break toward parenthetical brand/class labels.
        const hasParen = name.includes("(") ? 1 : 0;
        const score = count * 10 + hasParen;
        if (score > bestScore) {
          bestScore = score;
          best = name;
        }
      }
      return best;
    };

    const enDrugName = pickWinner(enVotes, sorted[0].drugName);
    const rawDrugName = pickWinner(
      displayVotes,
      sorted[0].localizedDrugName || enDrugName
    );
    const drugName =
      slug === "thiazide-and-loop-diuretics" &&
      rawDrugName === "Diurétiques hypokaliémiants"
        ? "Diurétiques thiazidiques et de l'anse"
        : rawDrugName;

    result.set(slug, {
      drugSlug: slug,
      drugName,
      enDrugName,
      totalInteractions: sorted.length,
      highestSeverity,
      countsBySeverity: counts,
      sampleHerbs,
      hasFr,
      updatedAt: latestUpdatedAt,
      interactions: sorted,
    });
  }

  return result;
}

/**
 * List all medications/drug classes with recorded herb interactions,
 * ordered by interaction count (descending), severity, and alphabetical name.
 */
export async function getMedicationSummaries(
  locale: string = "en"
): Promise<MedicationSummary[]> {
  const pairs = await getInteractionPairs(locale);
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

/**
 * Reverse-lookup detail for one medication slug, including every interacting
 * herb grouped/sorted by severity.
 */
export async function getMedicationBySlug(
  drugSlug: string,
  locale: string = "en"
): Promise<MedicationDetail | null> {
  const pairs = await getInteractionPairs(locale);
  const matching = pairs.filter((pair) => pair.drugSlug === drugSlug);
  if (matching.length === 0) return null;
  const map = aggregateMedications(matching);
  return map.get(drugSlug) ?? null;
}
