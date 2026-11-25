import type { InteractionSeverity } from "./pairs";

export interface StackHerbSummary {
  input: string;
  found: boolean;
  slug: string | null;
  name: string | null;
  scientificName: string | null;
  pairCount: number;
}

export interface StackMatchItem {
  herbInput: string;
  herbSlug: string;
  herbName: string;
  drugInput: string;
  drugName: string;
  drugSlug: string;
  severity: InteractionSeverity;
  description: string;
  mechanism: string | null;
  evidenceLevel: string | null;
  source: string | null;
  sourceUrl: string | null;
  pairUrl: string;
}

export interface StackUnrecordedItem {
  herbInput: string;
  herbSlug: string | null;
  herbName: string;
  drugInput: string;
}

export interface StackConflictItem {
  herbInput: string;
  herbSlug: string;
  herbName: string;
  drugInput: string;
  drugSlug: string;
  pairUrl: string;
  records: StackMatchItem[];
}

export interface StackAlert {
  code: "bleeding_overlap" | "sedation_overlap" | "cyp_enzyme_overlap";
  severity: "severe" | "moderate";
  herbs: string[];
  title: string;
  message: string;
}

export const SEVERITY_WEIGHT: Record<InteractionSeverity, number> = {
  contraindicated: 4,
  severe: 3,
  moderate: 2,
  mild: 1,
};

export function highestSeverityOf(
  matches: ReadonlyArray<{ severity: InteractionSeverity }>
): InteractionSeverity | null {
  let best: InteractionSeverity | null = null;
  let bestRank = 0;
  for (const m of matches) {
    const rank = SEVERITY_WEIGHT[m.severity] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = m.severity;
    }
  }
  return best;
}

export function sortStackMatches(
  matches: ReadonlyArray<StackMatchItem>
): StackMatchItem[] {
  return [...matches].sort((a, b) => {
    const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sevDiff !== 0) return sevDiff;
    const herbDiff = a.herbName.localeCompare(b.herbName);
    if (herbDiff !== 0) return herbDiff;
    return a.drugName.localeCompare(b.drugName);
  });
}

function combinedText(m: StackMatchItem): string {
  return `${m.drugName} ${m.description} ${m.mechanism ?? ""}`.toLowerCase();
}

export function computeStackAlerts(
  matches: ReadonlyArray<StackMatchItem>,
  locale: "en" | "fr"
): StackAlert[] {
  const alerts: StackAlert[] = [];
  const bleedingHerbs = new Set<string>();
  const sedationHerbs = new Set<string>();
  const cypHerbs = new Set<string>();

  for (const m of matches) {
    const text = combinedText(m);
    if (
      /warfarin|apixaban|clopidogrel|aspirin|anticoagulant|antiplatelet|bleeding|platelet|inr|saignement|plaquet/.test(
        text
      )
    ) {
      bleedingHerbs.add(m.herbName);
    }
    if (
      /sedat|drows|cns depress|benzodiazepine|sleep|somnol|depress|sédation|sommeil|somnif/.test(
        text
      )
    ) {
      sedationHerbs.add(m.herbName);
    }
    if (
      /cyp3a4|cyp2c9|cyp2c19|cyp1a2|cyp2d6|p-gp|p-glycoprotein|cytochrome|enzyme induc|enzyme inhibit|glycoprotéine/.test(
        text
      )
    ) {
      cypHerbs.add(m.herbName);
    }
  }

  if (bleedingHerbs.size >= 2) {
    const herbs = [...bleedingHerbs];
    alerts.push({
      code: "bleeding_overlap",
      severity: "severe",
      herbs,
      title:
        locale === "fr"
          ? "Effet cumulatif possible sur le saignement"
          : "Cumulative bleeding-risk overlap",
      message:
        locale === "fr"
          ? `${herbs.length} plantes de votre liste (${herbs.join(", ")}) agissent sur la coagulation ou les plaquettes. Prises ensemble avec un médicament, leurs risques s'additionnent.`
          : `${herbs.length} herbs in your stack (${herbs.join(", ")}) affect clotting or platelet function alongside your medication. Combining multiple blood-thinning botanicals adds to bleeding risk.`,
    });
  }

  if (sedationHerbs.size >= 2) {
    const herbs = [...sedationHerbs];
    alerts.push({
      code: "sedation_overlap",
      severity: "moderate",
      herbs,
      title:
        locale === "fr"
          ? "Sédation cumulative détectée"
          : "Cumulative sedation overlap",
      message:
        locale === "fr"
          ? `${herbs.length} plantes calmantes de votre liste (${herbs.join(", ")}) peuvent additionner somnolence et baisse de vigilance avec vos médicaments.`
          : `${herbs.length} calming herbs in your stack (${herbs.join(", ")}) may compound drowsiness, slowed reaction times, or fall risk alongside sedating medicines.`,
    });
  }

  if (cypHerbs.size >= 2) {
    const herbs = [...cypHerbs];
    alerts.push({
      code: "cyp_enzyme_overlap",
      severity: "moderate",
      herbs,
      title:
        locale === "fr"
          ? "Interactions multiples sur les enzymes hépatiques (CYP / P-gp)"
          : "Overlapping liver-enzyme (CYP / P-gp) interactions",
      message:
        locale === "fr"
          ? `${herbs.length} plantes (${herbs.join(", ")}) modifient les enzymes ou transporteurs qui éliminent vos médicaments ; faites réviser l'ensemble des doses par votre pharmacien.`
          : `${herbs.length} herbs (${herbs.join(", ")}) alter drug-metabolising enzymes or transporters; ask a pharmacist to review blood levels and dosing across your whole regimen.`,
    });
  }

  return alerts;
}
