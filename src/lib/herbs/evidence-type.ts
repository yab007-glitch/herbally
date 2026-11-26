export type StudyEvidenceType =
  | "human_clinical"
  | "observational_case"
  | "preclinical_animal"
  | "in_vitro_lab"
  | "in_silico_computational"
  | "traditional_historical"
  | "anecdotal";

export interface StudyEvidenceClassification {
  type: StudyEvidenceType;
  labelEn: string;
  labelFr: string;
}

export function classifyStudyEvidenceType(
  condition?: string,
  finding?: string,
  rawLevel?: string
): StudyEvidenceClassification {
  const combined = `${condition ?? ""} ${finding ?? ""}`.toLowerCase();

  if (
    /\b(?:in\s+silico|computational|molecular\s+docking|qsar|bioinformatics|network\s+pharmacology)\b/.test(
      combined
    )
  ) {
    return {
      type: "in_silico_computational",
      labelEn: "Computational (in silico)",
      labelFr: "Étude computationnelle (in silico)",
    };
  }

  if (
    /\b(?:in\s+vitro|cell\s+line|cell\s+culture|cultured\s+cells|assay|enzyme\s+inhibition|cytotoxic(?:ity)?|antibacterial|antimicrobial)\b/.test(
      combined
    )
  ) {
    return {
      type: "in_vitro_lab",
      labelEn: "Laboratory (in vitro)",
      labelFr: "Étude de laboratoire (in vitro)",
    };
  }

  if (
    /\b(?:animal|mice|mouse|rats?|rodent|rabbit|guinea\s+pig|zebrafish|in\s+vivo\s+(?:rat|mouse|murine)|murine|preclinical)\b/.test(
      combined
    )
  ) {
    return {
      type: "preclinical_animal",
      labelEn: "Preclinical (animal)",
      labelFr: "Étude préclinique (animale)",
    };
  }

  if (
    /\b(?:randomized|randomised|rct|double[- ]blind|placebo[- ]controlled|clinical\s+trial|meta-?analysis|systematic\s+review|human\s+participants|patients\s+received)\b/.test(
      combined
    )
  ) {
    return {
      type: "human_clinical",
      labelEn: "Human clinical / review",
      labelFr: "Étude clinique humaine",
    };
  }

  if (
    /\b(?:case\s+report|case\s+series|cohort|observational|epidemiolog)\b/.test(
      combined
    )
  ) {
    return {
      type: "observational_case",
      labelEn: "Observational / case data",
      labelFr: "Données observationnelles / cas",
    };
  }

  if (rawLevel === "A" || rawLevel === "B") {
    return {
      type: "human_clinical",
      labelEn: "Clinical literature",
      labelFr: "Littérature clinique",
    };
  }

  if (/\b(?:traditional|historical|ethnobotanical|folklore)\b/.test(combined)) {
    return {
      type: "traditional_historical",
      labelEn: "Traditional / historical",
      labelFr: "Usage traditionnel / historique",
    };
  }

  return {
    type: "anecdotal",
    labelEn: rawLevel === "C" ? "Preliminary" : "Unclassified / anecdotal",
    labelFr: rawLevel === "C" ? "Préliminaire" : "Non classé / anecdotique",
  };
}
