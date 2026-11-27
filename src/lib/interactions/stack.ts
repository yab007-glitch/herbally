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
  publicationStatus?: string;
}

export interface StackUnrecordedItem {
  herbInput: string;
  herbSlug: string | null;
  herbName: string;
  drugInput: string;
}

export interface StackWithheldItem {
  herbInput: string;
  herbSlug: string;
  herbName: string;
  drugInput: string;
  status: "withheld";
  reason: "retracted_hold";
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

export type StackAlertCode =
  | "bleeding_overlap"
  | "serotonin_overlap"
  | "qt_cardiac_overlap"
  | "hepatotoxicity_overlap"
  | "hypoglycemia_overlap"
  | "sedation_overlap"
  | "cyp_enzyme_overlap";

export interface StackAlert {
  code: StackAlertCode;
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

interface OverlapRule {
  code: StackAlertCode;
  severity: "severe" | "moderate";
  pattern: RegExp;
  copy: Record<
    "en" | "fr",
    {
      title: string;
      buildMessage: (herbs: string[]) => string;
    }
  >;
}

const OVERLAP_RULES: readonly OverlapRule[] = [
  {
    code: "bleeding_overlap",
    severity: "severe",
    pattern:
      /warfarin|apixaban|clopidogrel|aspirin|anticoagulant|antiplatelet|bleeding|platelet|inr|saignement|plaquet/,
    copy: {
      en: {
        title: "Cumulative bleeding-risk overlap",
        buildMessage: (herbs) =>
          `${herbs.length} herbs in your stack (${herbs.join(", ")}) affect clotting or platelet function alongside your medication. Combining multiple blood-thinning botanicals adds to bleeding risk.`,
      },
      fr: {
        title: "Effet cumulatif possible sur le saignement",
        buildMessage: (herbs) =>
          `${herbs.length} plantes de votre liste (${herbs.join(", ")}) agissent sur la coagulation ou les plaquettes. Prises ensemble avec un médicament, leurs risques s'additionnent.`,
      },
    },
  },
  {
    code: "serotonin_overlap",
    severity: "severe",
    pattern:
      /ssri|snri|maoi|seroton|triptan|tramadol|linezolid|fluoxetine|sertraline|citalopram|escitalopram|venlafaxine|duloxetine|sérotonin/,
    copy: {
      en: {
        title: "Cumulative serotonergic overload signal",
        buildMessage: (herbs) =>
          `${herbs.length} botanicals in your stack (${herbs.join(", ")}) show serotonergic interaction potential with antidepressants or related agents. Combining multiple serotonergic agents increases risk of agitation, tremor, diaphoresis, or serotonin toxicity.`,
      },
      fr: {
        title: "Signal cumulatif de surcharge sérotoninergique",
        buildMessage: (herbs) =>
          `${herbs.length} plantes de votre liste (${herbs.join(", ")}) présentent un signal d'interaction sérotoninergique. Leur cumul avec un antidépresseur ou médicament apparenté peut accroître le risque de toxicité sérotoninergique.`,
      },
    },
  },
  {
    code: "qt_cardiac_overlap",
    severity: "severe",
    pattern:
      /qt prolong|arrhythm|digoxin|amiodarone|sotalol|antiarrhythmic|hypokalem|potassium|arythmie|hypokaliém/,
    copy: {
      en: {
        title: "Cardiac rhythm, digoxin, or electrolyte-depletion overlap",
        buildMessage: (herbs) =>
          `${herbs.length} botanicals in your stack (${herbs.join(", ")}) may alter potassium balance, cardiac glycoside handling, or conduction timing. Verify ECG and electrolyte monitoring needs with a pharmacist or prescriber.`,
      },
      fr: {
        title: "Chevauchement cardiaque, digoxine ou déplétion potassique",
        buildMessage: (herbs) =>
          `${herbs.length} plantes de votre liste (${herbs.join(", ")}) peuvent influencer le potassium, la digoxine ou la conduction cardiaque. Faites vérifier votre suivi électrolytique et cardiaque par un clinicien.`,
      },
    },
  },
  {
    code: "hepatotoxicity_overlap",
    severity: "moderate",
    pattern:
      /hepatotox|liver|hepatic|transaminase|acetaminophen|paracetamol|methotrexate|statin|hépatotox|foie|hépatique/,
    copy: {
      en: {
        title: "Additive hepatic metabolism & liver-stress signal",
        buildMessage: (herbs) =>
          `${herbs.length} herbs in your stack (${herbs.join(", ")}) flag hepatotoxic or hepatic-enzyme overlap alongside medications processed by the liver. Ask a clinician before stacking multiple hepatically cleared products.`,
      },
      fr: {
        title: "Signal cumulatif de stress ou métabolisme hépatique",
        buildMessage: (herbs) =>
          `${herbs.length} plantes de votre liste (${herbs.join(", ")}) signalent une charge ou interaction hépatique avec vos médicaments. Demandez l'avis d'un pharmacien ou médecin avant de les associer.`,
      },
    },
  },
  {
    code: "hypoglycemia_overlap",
    severity: "moderate",
    pattern:
      /hypoglyc|insulin|metformin|sulfonylurea|glyburide|glipizide|blood sugar|glucose|glycémie|insuline|diabète/,
    copy: {
      en: {
        title: "Cumulative blood-glucose lowering overlap",
        buildMessage: (herbs) =>
          `${herbs.length} herbs in your stack (${herbs.join(", ")}) show additive glucose-lowering signals alongside antidiabetic therapy. Monitor capillary blood glucose closely with your care team.`,
      },
      fr: {
        title: "Effet cumulatif possible d'hypoglycémie",
        buildMessage: (herbs) =>
          `${herbs.length} plantes de votre liste (${herbs.join(", ")}) peuvent abaisser davantage la glycémie avec vos médicaments antidiabétiques. Vérifiez la surveillance glycémique avec votre équipe soignante.`,
      },
    },
  },
  {
    code: "sedation_overlap",
    severity: "moderate",
    pattern:
      /sedat|drows|cns depress|benzodiazepine|sleep|somnol|depress|sédation|sommeil|somnif/,
    copy: {
      en: {
        title: "Cumulative sedation overlap",
        buildMessage: (herbs) =>
          `${herbs.length} calming herbs in your stack (${herbs.join(", ")}) may compound drowsiness, slowed reaction times, or fall risk alongside sedating medicines.`,
      },
      fr: {
        title: "Sédation cumulative détectée",
        buildMessage: (herbs) =>
          `${herbs.length} plantes calmantes de votre liste (${herbs.join(", ")}) peuvent additionner somnolence et baisse de vigilance avec vos médicaments.`,
      },
    },
  },
  {
    code: "cyp_enzyme_overlap",
    severity: "moderate",
    pattern:
      /cyp3a4|cyp2c9|cyp2c19|cyp1a2|cyp2d6|p-gp|p-glycoprotein|oatp1b1|ugt|cytochrome|enzyme induc|enzyme inhibit|glycoprotéine/,
    copy: {
      en: {
        title: "Overlapping liver-enzyme (CYP / P-gp / UGT) interactions",
        buildMessage: (herbs) =>
          `${herbs.length} herbs (${herbs.join(", ")}) alter drug-metabolising enzymes or transporters; ask a pharmacist to review blood levels and dosing across your whole regimen.`,
      },
      fr: {
        title:
          "Interactions multiples sur les enzymes et transporteurs (CYP / P-gp / UGT)",
        buildMessage: (herbs) =>
          `${herbs.length} plantes (${herbs.join(", ")}) modifient les enzymes ou transporteurs qui éliminent vos médicaments ; faites réviser l'ensemble des doses par votre pharmacien.`,
      },
    },
  },
];

export function computeStackAlerts(
  matches: ReadonlyArray<StackMatchItem>,
  locale: "en" | "fr"
): StackAlert[] {
  const alerts: StackAlert[] = [];

  for (const rule of OVERLAP_RULES) {
    const matchingHerbs = new Set<string>();
    for (const m of matches) {
      if (rule.pattern.test(combinedText(m))) {
        matchingHerbs.add(m.herbName);
      }
    }
    if (matchingHerbs.size >= 2) {
      const herbs = [...matchingHerbs];
      const localized = rule.copy[locale];
      alerts.push({
        code: rule.code,
        severity: rule.severity,
        herbs,
        title: localized.title,
        message: localized.buildMessage(herbs),
      });
    }
  }

  return alerts;
}
