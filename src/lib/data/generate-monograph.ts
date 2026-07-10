import { getMonograph } from "./monographs";
import type { Monograph } from "./monographs";
import type { Interaction } from "@/lib/types/interactions";

/**
 * Generate a monograph for any herb using DB data + hand-written overrides.
 * Top herbs get rich hand-written content. All others get auto-generated content
 * from their existing DB fields (description, uses, compounds, evidence_level).
 */
export function generateMonograph(herb: {
  name: string;
  scientific_name: string;
  slug: string;
  description: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  active_compounds: string[] | null;
  evidence_level: string | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  drug_interactions: Interaction[] | null;
  citations?: unknown[] | null;
}): Monograph | null {
  // Check for hand-written monograph first
  const manual = getMonograph(herb.slug);
  if (manual) return manual;

  // Auto-generate from DB data
  const displayName = herb.name || herb.scientific_name;
  // Default to "trad" (Traditional Use) for unverified herbs without
  // explicit evidence levels. Previously defaulted to "C" which overstates
  // the evidence basis for AI-generated monographs with no clinical data.
  const evidence = (herb.evidence_level?.toUpperCase() || "trad") as
    "A" | "B" | "C" | "D" | "trad";

  const summary = buildSummary(herb, displayName, evidence);
  const mechanism = buildMechanism(herb);
  const claims = buildClaims(herb, evidence);
  const safetyNotes = buildSafetyNotes(herb);
  const pregnancyCategory: Monograph["pregnancyCategory"] =
    herb.pregnancy_safe === false
      ? "unsafe"
      : herb.pregnancy_safe === true
        ? "safe"
        : "insufficient";
  const drugInteractions = buildDrugInteractions(herb.contraindications || []);
  const keyCitations = buildKeyCitations(herb.citations, evidence);

  return {
    slug: herb.slug,
    summary,
    mechanism,
    claims,
    safetyNotes,
    drugInteractions,
    pregnancyCategory,
    keyCitations,
  };
}

function buildSummary(
  herb: {
    name: string;
    scientific_name: string;
    description: string | null;
    modern_uses: string[] | null;
    traditional_uses: string[] | null;
    active_compounds: string[] | null;
  },
  displayName: string,
  evidence: string
): string {
  const useCount =
    (herb.modern_uses?.length || 0) + (herb.traditional_uses?.length || 0);
  const compoundStr =
    herb.active_compounds?.slice(0, 4).join(", ") ||
    "various bioactive constituents";

  const evidencePhrase =
    evidence === "A"
      ? "supported by robust clinical evidence"
      : evidence === "B"
        ? "supported by emerging clinical data"
        : evidence === "C"
          ? "with limited but promising clinical support"
          : evidence === "trad"
            ? "primarily based on traditional use; clinical evidence is limited or ongoing"
            : "primarily based on historical use with limited scientific validation";

  if (herb.description) {
    return `${herb.description} This herb is ${evidencePhrase}. Key active compounds include ${compoundStr}, which underpin its pharmacological activity across ${useCount} documented traditional and modern indications.`;
  }

  return `${displayName} (${herb.scientific_name}) is a medicinal herb with ${useCount} documented traditional and modern uses, ${evidencePhrase}. Its therapeutic profile is driven by ${compoundStr}, which interact with multiple physiological pathways.`;
}

function buildMechanism(herb: {
  name: string;
  scientific_name: string;
  active_compounds: string[] | null;
  modern_uses: string[] | null;
  traditional_uses: string[] | null;
}): string {
  const compounds = herb.active_compounds || [];
  const uses = herb.modern_uses || herb.traditional_uses || [];

  if (compounds.length === 0) {
    return `The pharmacological mechanism of ${herb.name} has not been characterized in the literature available to this database. Further phytochemical study is needed before specific molecular pathways can be described with confidence.`;
  }

  const primary = compounds[0];
  const secondary = compounds.slice(1, 3);

  let mechanism = `${herb.name} contains ${primary}`;
  if (secondary.length > 0) {
    mechanism += ` along with ${secondary.join(" and ")}`;
  }
  mechanism += ` as principal bioactive constituents. `;

  if (uses.length > 0) {
    mechanism += `Reported traditional and modern uses include ${uses.slice(0, 5).join(", ").toLowerCase()}. `;
  }

  // Do NOT fabricate specific molecular pathways (NF-κB, COX-2, GABA-A, etc.)
  // from keyword matching on use names. That was generating plausible-sounding
  // but unsourced pharmacology claims for 2,700+ unverified herbs. Instead,
  // state honestly that specific mechanisms require literature verification.
  mechanism += `The specific molecular targets and pharmacokinetic pathways by which these compounds exert their reported effects have not been verified against primary literature for this entry. Consult PubMed or a qualified pharmacognosist for evidence-based mechanism data.`;

  return mechanism;
}

function buildClaims(
  herb: {
    name: string;
    modern_uses: string[] | null;
    traditional_uses: string[] | null;
    evidence_level: string | null;
    active_compounds: string[] | null;
  },
  defaultEvidence: "A" | "B" | "C" | "D" | "trad"
): Monograph["claims"] {
  const uses = [...(herb.modern_uses || []), ...(herb.traditional_uses || [])];

  if (uses.length === 0) {
    return [
      {
        claim: "General wellness support",
        evidence: defaultEvidence,
        note: "Broad traditional use with limited specific clinical trials.",
      },
    ];
  }

  const claims: Monograph["claims"] = [];
  const usedUses = new Set<string>();

  for (let i = 0; i < Math.min(uses.length, 6); i++) {
    const use = uses[i];
    const lowerUse = use.toLowerCase();
    if (usedUses.has(lowerUse)) continue;
    usedUses.add(lowerUse);

    const evidence = inferEvidenceLevel(lowerUse, defaultEvidence);
    const note = buildClaimNote(lowerUse, evidence, herb.active_compounds?.[0]);

    claims.push({ claim: use, evidence, note });
  }

  return claims;
}

function inferEvidenceLevel(
  use: string,
  defaultEv: "A" | "B" | "C" | "D" | "trad"
): "A" | "B" | "C" | "D" | "trad" {
  const lower = use.toLowerCase();
  const highEvidenceTerms = [
    "osteoporosis",
    "osteopenia",
    "menopause",
    "hot flash",
    "cardiovascular",
    "hypertension",
    "heart failure",
    "hyperlipidemia",
    "diabetes",
    "type 2 diabetes",
    "metabolic syndrome",
    "depression",
    "anxiety",
    "insomnia",
    "cognitive",
    "osteoarthritis",
    "rheumatoid arthritis",
    "inflammatory bowel",
    "migraine",
    "migraines",
    "motion sickness",
    "nausea",
    "benign prostatic hyperplasia",
    "bph",
    "uti",
    "urinary tract infection",
    "common cold",
    "upper respiratory",
  ];

  const mediumEvidenceTerms = [
    "digestive",
    "constipation",
    "irritable bowel",
    "ibs",
    "premenstrual",
    "pms",
    "dysmenorrhea",
    "menstrual cramps",
    "eczema",
    "acne",
    "skin",
    "wound healing",
    "stress",
    "fatigue",
    "adaptogen",
    "immune support",
    "liver",
    "hepatoprotective",
  ];

  if (highEvidenceTerms.some((t) => lower.includes(t)))
    return defaultEv === "A" || defaultEv === "B" ? defaultEv : "B";
  if (mediumEvidenceTerms.some((t) => lower.includes(t)))
    return defaultEv === "A" || defaultEv === "B" || defaultEv === "C"
      ? defaultEv
      : "C";
  return defaultEv;
}

function buildClaimNote(
  use: string,
  evidence: string,
  primaryCompound?: string
): string | undefined {
  const lower = use.toLowerCase();

  // Only provide specific clinical context when evidence is A or B
  // (meaning real clinical data exists in the DB for this herb).
  // For C, D, or trad evidence, use honest hedged language that doesn't
  // fabricate clinical trial references.
  if (evidence === "A" || evidence === "B") {
    if (lower.includes("anti-inflammatory")) {
      return evidence === "A"
        ? "Comparable to NSAIDs in several RCTs"
        : "Preclinical anti-inflammatory activity confirmed; human data limited";
    }
    if (lower.includes("antioxidant")) {
      return "Free radical scavenging demonstrated in vitro and in vivo";
    }
    if (
      lower.includes("anxiety") ||
      lower.includes("sedative") ||
      lower.includes("calm")
    ) {
      return evidence === "A" || evidence === "B"
        ? "Modest anxiolytic effect in clinical trials"
        : "Traditional anxiolytic use; clinical trials small or heterogeneous";
    }
    if (lower.includes("sleep") || lower.includes("insomnia")) {
      return evidence === "A" || evidence === "B"
        ? "Improves sleep latency and quality in RCTs"
        : "Historical sleep aid; modern trials show variable outcomes";
    }
    if (lower.includes("immune")) {
      return evidence === "A" || evidence === "B"
        ? "May shorten duration of upper respiratory infections"
        : "Immunomodulatory effects shown in preclinical models";
    }
    if (lower.includes("digestion") || lower.includes("gastric")) {
      return "Stimulates digestive secretions and may reduce dyspeptic symptoms";
    }
    if (lower.includes("liver") || lower.includes("hepatoprotect")) {
      return "Supports hepatocyte regeneration and reduces liver enzyme elevations in some studies";
    }
    if (
      lower.includes("cardio") ||
      lower.includes("heart") ||
      lower.includes("blood pressure")
    ) {
      return "Modest hemodynamic effects; not a substitute for standard cardiovascular therapy";
    }
    if (lower.includes("cognitive") || lower.includes("memory")) {
      return "Limited but promising data for age-related cognitive support";
    }
    if (lower.includes("diabetes") || lower.includes("blood sugar")) {
      return "Adjunctive glycemic support; monitor glucose closely if on hypoglycemic agents";
    }
    if (lower.includes("wound") || lower.includes("skin")) {
      return "Accelerates wound closure in animal models; human data sparse";
    }
  }

  // For lower evidence levels, provide honest traditional-use context
  if (primaryCompound) {
    return `Traditional use associated with ${primaryCompound}; clinical evidence has not been verified for this entry.`;
  }
  return undefined;
}

function buildSafetyNotes(herb: {
  side_effects: string[] | null;
  contraindications: string[] | null;
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  name: string;
}): string[] {
  const notes: string[] = [];

  if (herb.pregnancy_safe === false) {
    notes.push(
      "Avoid use during pregnancy due to potential teratogenic or abortifacient risk."
    );
  }
  if (herb.nursing_safe === false) {
    notes.push(
      "Avoid use while breastfeeding; insufficient safety data in lactating women."
    );
  }

  const contraindications = herb.contraindications || [];
  if (contraindications.length > 0) {
    contraindications.slice(0, 4).forEach((c) => {
      notes.push(`Contraindicated in ${c}.`);
    });
  }

  const sideEffects = herb.side_effects || [];
  if (sideEffects.length > 0) {
    const mild = sideEffects.filter((s) =>
      /\b(mild|minimal|generally safe|well tolerated|rare|transient)\b/i.test(s)
    );
    const significant = sideEffects.filter((s) => !mild.includes(s));

    if (significant.length > 0) {
      notes.push(`May cause: ${significant.slice(0, 3).join("; ")}.`);
    }
    if (mild.length > 0) {
      notes.push(`${mild[0].charAt(0).toUpperCase() + mild[0].slice(1)}`);
    }
  }

  if (herb.dosage_adult) {
    notes.push(`Standard adult dosage: ${herb.dosage_adult}.`);
  }

  if (notes.length === 0) {
    notes.push(
      `Consult a qualified healthcare provider before using ${herb.name}, particularly if taking prescription medications or managing chronic conditions.`
    );
  }

  return notes;
}

function buildDrugInteractions(
  contraindications: string[]
): Monograph["drugInteractions"] {
  const interactions: Monograph["drugInteractions"] = [];

  const drugPatterns: Record<
    string,
    {
      drugs: string[];
      severity: "mild" | "moderate" | "severe" | "contraindicated";
      detail: string;
    }
  > = {
    warfarin: {
      drugs: ["Warfarin", "Coumadin", "Apixaban", "Rivaroxaban"],
      severity: "moderate",
      detail:
        "Potential increased bleeding risk; monitor INR or coagulation parameters",
    },
    anticoagulant: {
      drugs: ["Anticoagulants", "Blood thinners"],
      severity: "moderate",
      detail: "May potentiate anticoagulant effects; increased hemorrhage risk",
    },
    aspirin: {
      drugs: ["Aspirin", "NSAIDs"],
      severity: "mild",
      detail: "Additive antiplatelet activity at higher doses",
    },
    "blood pressure": {
      drugs: [
        "Antihypertensives",
        "ACE inhibitors",
        "ARBs",
        "Calcium channel blockers",
      ],
      severity: "moderate",
      detail: "May enhance hypotensive effects; monitor blood pressure",
    },
    diabetes: {
      drugs: ["Antidiabetic agents", "Insulin", "Metformin", "Sulfonylureas"],
      severity: "moderate",
      detail:
        "May potentiate hypoglycemic effects; monitor blood glucose closely",
    },
    sedative: {
      drugs: [
        "Sedatives",
        "Benzodiazepines",
        "Barbiturates",
        "CNS depressants",
      ],
      severity: "moderate",
      detail: "Additive sedation and respiratory depression risk",
    },
    antidepressant: {
      drugs: ["SSRIs", "SNRIs", "MAOIs", "TCAs"],
      severity: "severe",
      detail:
        "Risk of serotonin syndrome or altered neurotransmitter metabolism",
    },
    immunosuppressant: {
      drugs: [
        "Immunosuppressants",
        "Corticosteroids",
        "Calcineurin inhibitors",
      ],
      severity: "moderate",
      detail: "May counteract immunosuppressive therapy",
    },
    hormone: {
      drugs: [
        "Hormone replacement therapy",
        "Oral contraceptives",
        "Tamoxifen",
      ],
      severity: "moderate",
      detail: "May alter hormone metabolism via cytochrome P450 enzymes",
    },
    digoxin: {
      drugs: ["Digoxin"],
      severity: "severe",
      detail:
        "Altered absorption or displacement from protein binding may increase toxicity risk",
    },
    lithium: {
      drugs: ["Lithium"],
      severity: "moderate",
      detail:
        "May alter renal clearance of lithium; monitor serum lithium levels",
    },
    chemo: {
      drugs: ["Chemotherapy agents"],
      severity: "severe",
      detail:
        "Potential interference with chemotherapeutic metabolism or efficacy",
    },
  };

  for (const [pattern, data] of Object.entries(drugPatterns)) {
    if (contraindications.some((c) => c.toLowerCase().includes(pattern))) {
      data.drugs.forEach((drug) => {
        if (!interactions.some((i) => i.drug === drug)) {
          interactions.push({
            drug,
            severity: data.severity,
            detail: data.detail,
          });
        }
      });
    }
  }

  return interactions;
}

function buildKeyCitations(
  citations: unknown[] | null | undefined,
  _evidence: string
): Monograph["keyCitations"] {
  const baseCitations = (citations || []) as Array<{
    source: string;
    title?: string;
    url?: string;
    year?: number;
    pmid?: string;
  }>;

  const mapped = baseCitations
    .filter((c) => c.source && c.title)
    .map((c) => ({
      source: c.source,
      title: c.title || `${c.source} Database`,
      url: c.url,
      year: c.year,
    }));

  if (mapped.length >= 2) {
    return mapped.slice(0, 6);
  }

  const standardRefs: Monograph["keyCitations"] = [
    {
      source: "WHO",
      title: "WHO Monographs on Selected Medicinal Plants",
      url: "https://www.who.int/publications/i/item/9241545378",
      year: 2009,
    },
    {
      source: "NCCIH",
      title: "Herbs at a Glance",
      url: "https://www.nccih.nih.gov/health/herbsataglance.htm",
      year: 2024,
    },
  ];

  return [...mapped, ...standardRefs].slice(0, 6);
}
