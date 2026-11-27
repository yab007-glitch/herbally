import type {
  StackAlert,
  StackConflictItem,
  StackHerbSummary,
  StackMatchItem,
  StackUnrecordedItem,
  StackWithheldItem,
} from "./stack";
import type { InteractionSeverity } from "./pairs";

export interface ConsultationBriefInput {
  checkedAt: string;
  locale: "en" | "fr";
  herbs: StackHerbSummary[];
  drugs: string[];
  summary: {
    totalCombinations: number;
    matchedCount: number;
    conflictCount?: number;
    withheldCount?: number;
    unrecordedCount: number;
    highestSeverity: InteractionSeverity | null;
  };
  matches: StackMatchItem[];
  conflicts?: StackConflictItem[];
  withheld?: StackWithheldItem[];
  unrecorded: StackUnrecordedItem[];
  stackAlerts: StackAlert[];
}

export function buildConsultationBriefJson(
  result: ConsultationBriefInput,
  locale: "en" | "fr"
) {
  return {
    schema: "herbally.consultation_brief.v1",
    generatedClientSide: true,
    validationStatus: "EDUCATIONAL_SCREENING_SUMMARY_NOT_CLINICIAN_VALIDATED",
    locale,
    checkedAt: result.checkedAt,
    herbsChecked: result.herbs.map((h) => ({
      input: h.input,
      found: h.found,
      name: h.name,
      scientificName: h.scientificName,
    })),
    medicationsChecked: result.drugs,
    summary: result.summary,
    cumulativeOverlapAlerts: result.stackAlerts,
    recordedInteractions: result.matches.map((m) => ({
      herbName: m.herbName,
      drugName: m.drugName,
      severity: m.severity,
      publicationStatus: m.publicationStatus ?? "legacy_unreviewed",
      clinicianSigned: m.publicationStatus === "published",
      mechanism: m.mechanism,
      description: m.description,
      source: m.source,
      sourceUrl: m.sourceUrl,
      pairUrl: m.pairUrl,
    })),
    conflictingRecords: result.conflicts ?? [],
    withheldRetractedCount: result.withheld?.length ?? 0,
    unrecordedPairCount: result.unrecorded.length,
    importantSafetyNotice:
      locale === "fr"
        ? "Document éducatif uniquement — non validé par un clinicien licencié. L'absence d'une interaction répertoriée ne signifie JAMAIS que l'association est sécuritaire."
        : "Educational reference summary only — not validated by a licensed clinician. Absence of a recorded interaction NEVER means the combination is safe.",
  };
}

export function formatConsultationBriefText(
  result: ConsultationBriefInput,
  locale: "en" | "fr"
): string {
  const fr = locale === "fr";
  const lines: string[] = [
    fr
      ? "HERBALLY — RÉSUMÉ ÉDUCATIF POUR CONSULTATION CLINIQUE (NON VALIDÉ PAR UN CLINICIEN)"
      : "HERBALLY — EDUCATIONAL SCREENING SUMMARY (NOT CLINICIAN-VALIDATED)",
    "=".repeat(78),
    `${fr ? "Horodatage UTC" : "Generated (UTC)"}: ${result.checkedAt}`,
    `${fr ? "Génération locale" : "Privacy"}: ${
      fr
        ? "Généré localement dans votre navigateur — jamais transmis aux serveurs HerbAlly."
        : "Generated locally in your browser — never uploaded to HerbAlly servers."
    }`,
    "",
    `${fr ? "PLANTES VÉRIFIÉES" : "HERBS CHECKED"}: ${result.herbs
      .map((h) =>
        h.found && h.name
          ? `${h.name} (${h.scientificName ?? h.slug})`
          : `${h.input} [not in DB]`
      )
      .join(", ")}`,
    `${fr ? "MÉDICAMENTS / CLASSES" : "MEDICATIONS / CLASSES"}: ${result.drugs.join(", ")}`,
    `${fr ? "COMBINAISONS ÉVALUÉES" : "COMBINATIONS EVALUATED"}: ${result.summary.totalCombinations} | ${
      fr ? "Correspondances" : "Matches"
    }: ${result.summary.matchedCount} | ${fr ? "Non répertoriées" : "Unrecorded"}: ${
      result.summary.unrecordedCount
    } | ${fr ? "Retenues (rétractées)" : "Withheld (retracted)"}: ${
      result.withheld?.length ?? 0
    }`,
  ];

  if (result.stackAlerts.length > 0) {
    lines.push(
      "",
      fr
        ? "SIGNAUX CUMULATIFS MULTI-PLANTES :"
        : "CUMULATIVE MULTI-HERB OVERLAP ALERTS:"
    );
    for (const alert of result.stackAlerts) {
      lines.push(
        `- [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`
      );
    }
  }

  if (result.matches.length > 0) {
    lines.push(
      "",
      fr
        ? "INTERACTIONS POTENTIELLES RÉPERTORIÉES :"
        : "DOCUMENTED INTERACTION SIGNALS:"
    );
    for (const m of result.matches) {
      const reviewTag =
        m.publicationStatus === "published"
          ? fr
            ? "Cliniquement révisé"
            : "Clinician-reviewed"
          : fr
            ? "Signal hérité non révisé"
            : "Unreviewed legacy signal";
      lines.push(
        `- ${m.herbName} + ${m.drugName} [${m.severity.toUpperCase()} | ${reviewTag}]`
      );
      lines.push(`  ${m.description}`);
      if (m.mechanism) {
        lines.push(`  ${fr ? "Mécanisme" : "Mechanism"}: ${m.mechanism}`);
      }
      if (m.sourceUrl || m.source) {
        lines.push(
          `  Source: ${[m.source, m.sourceUrl].filter(Boolean).join(" — ")}`
        );
      }
    }
  }

  if ((result.conflicts?.length ?? 0) > 0) {
    lines.push(
      "",
      fr
        ? `CONFLITS ÉDITORIAUX À DISSOCIER : ${result.conflicts?.length ?? 0}`
        : `CONFLICTING RECORDS REQUIRING REVIEW: ${result.conflicts?.length ?? 0}`
    );
  }

  lines.push(
    "",
    "IMPORTANT:",
    fr
      ? "L'absence d'une interaction répertoriée NE signifie PAS innocuité. Faites réviser l'ensemble de vos suppléments et médicaments par un pharmacien ou médecin."
      : "Absence of a recorded interaction does NOT mean safe. Review all herbs, supplements, and prescription medicines with a licensed pharmacist or prescriber."
  );

  return lines.join("\n");
}
