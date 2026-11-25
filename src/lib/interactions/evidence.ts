/**
 * Phase B Interaction Truthfulness & Publication Contract Helpers.
 *
 * Separates severity from clinical vs nonclinical evidence tier, blocks
 * severity-templated synthesized clinical actions for unreviewed/nonclinical
 * pairs, enforces publication/staleness/retraction gates, and standardizes
 * uncertainty / absence-of-evidence copy in EN/FR.
 */

export type EvidenceGroup = "A" | "B";

export type EvidenceTier =
  | "systematic_review_or_rct"
  | "clinical_trial"
  | "cohort_or_case_control"
  | "case_series_or_case_report"
  | "regulatory_label_extrapolation"
  | "in_vivo_animal"
  | "in_vitro"
  | "theoretical"
  | "unknown";

export type ExtrapolationScope =
  | "human_clinical"
  | "mixed_clinical_and_preclinical"
  | "nonclinical_extrapolated"
  | "theoretical_only"
  | "unverified";

export type PublicationStatus =
  | "legacy_unreviewed"
  | "draft"
  | "clinically_verified"
  | "published"
  | "quarantined_collision"
  | "retracted_hold";

export type ClinicalActionStatus =
  | "unreviewed_blocked"
  | "draft_pending_review"
  | "clinician_approved"
  | "suspended_collision_conflict";

export interface ClassifiedEvidence {
  group: EvidenceGroup;
  canUseEstablishedWording: boolean;
  badgeEn: string;
  badgeFr: string;
  explanationEn: string;
  explanationFr: string;
}

const GROUP_A_TIERS: ReadonlySet<EvidenceTier> = new Set([
  "systematic_review_or_rct",
  "clinical_trial",
  "cohort_or_case_control",
]);

/**
 * Separate Group A (human clinical evidence) from Group B (nonclinical,
 * theoretical, case-only/extrapolated, or unverified evidence). Group B must
 * never render "established interaction" wording regardless of severity.
 */
export function classifyInteractionEvidence(params: {
  evidenceLevel?: string | null;
  evidenceTier?: EvidenceTier | null;
  extrapolationScope?: ExtrapolationScope | null;
}): ClassifiedEvidence {
  const tier = params.evidenceTier ?? "unknown";
  const scope = params.extrapolationScope ?? "unverified";

  if (
    GROUP_A_TIERS.has(tier) &&
    (scope === "human_clinical" || scope === "mixed_clinical_and_preclinical")
  ) {
    return {
      group: "A",
      canUseEstablishedWording: true,
      badgeEn: "Clinical human evidence (Group A)",
      badgeFr: "Données cliniques humaines (Groupe A)",
      explanationEn:
        "Backed by human clinical study or trial data; clinical relevance still depends on preparation, dose, and patient factors.",
      explanationFr:
        "Appuyé par des études cliniques humaines ; la portée clinique dépend toutefois de la forme, de la dose et du patient.",
    };
  }

  return {
    group: "B",
    canUseEstablishedWording: false,
    badgeEn:
      tier === "in_vitro" ||
      tier === "in_vivo_animal" ||
      scope === "nonclinical_extrapolated"
        ? "Nonclinical / extrapolated evidence (Group B)"
        : "Unverified / theoretical evidence (Group B)",
    badgeFr:
      tier === "in_vitro" ||
      tier === "in_vivo_animal" ||
      scope === "nonclinical_extrapolated"
        ? "Données non cliniques / extrapolées (Groupe B)"
        : "Preuves non vérifiées / théoriques (Groupe B)",
    explanationEn:
      "Not established by controlled human trials: represents preclinical, mechanistic, case-report, or unreviewed legacy data. Do not infer clinical safety or confirmed risk magnitude without pharmacist review.",
    explanationFr:
      "Non établi par des essais cliniques contrôlés chez l'humain : repose sur des données précliniques, mécanistiques, des cas isolés ou une fiche héritée non révisée.",
  };
}

/**
 * Resolve clinician-approved pair-specific action text, or fail closed with a
 * blocked/unreviewed status. Never synthesizes severity-templated clinical instructions.
 */
export function getClinicalActionDisplay(params: {
  publicationStatus?: PublicationStatus | null;
  clinicalActionStatus?: ClinicalActionStatus | null;
  pairSpecificClinicalAction?: string | null;
  locale: "en" | "fr";
}): { blocked: boolean; text: string } {
  const isFr = params.locale === "fr";
  const isApproved =
    params.clinicalActionStatus === "clinician_approved" &&
    params.publicationStatus === "published" &&
    typeof params.pairSpecificClinicalAction === "string" &&
    params.pairSpecificClinicalAction.trim().length > 0;

  if (isApproved) {
    return {
      blocked: false,
      text: params.pairSpecificClinicalAction!.trim(),
    };
  }

  if (
    params.publicationStatus === "quarantined_collision" ||
    params.clinicalActionStatus === "suspended_collision_conflict"
  ) {
    return {
      blocked: true,
      text: isFr
        ? "Conduite clinique bloquée : plusieurs fiches conflictuelles existent pour cette paire. Consultez un pharmacien ou un médecin avant toute décision."
        : "Clinical guidance blocked: conflicting interaction records exist for this pair. Confirm directly with a pharmacist or prescriber.",
    };
  }

  return {
    blocked: true,
    text: isFr
      ? "Action clinique bloquée (fiche héritée non révisée) : aucune conduite approuvée par un clinicien n'est enregistrée pour cette paire. N'arrêtez ni ne modifiez un traitement sans avis médical ou pharmaceutique."
      : "Clinical action blocked (unreviewed legacy record): no pair-specific clinician review is on file. Do not start, stop, or adjust prescribed medication without consulting your pharmacist or prescriber.",
  };
}

export interface PublicationGateCitation {
  sourceType: string;
  sourceLicence: string;
  url: string | null;
  retractionStatus:
    "active" | "corrected" | "expression_of_concern" | "retracted";
  claimSupportAnchor: string;
}

export interface PublicationGateInput {
  severity: string | null;
  description: string | null;
  botanicalApplicability: string | null;
  clinicalReviewerId: string | null;
  verifiedAt: string | null;
  nextReviewDueAt: string | null;
  clinicalActionStatus: ClinicalActionStatus;
  citations: PublicationGateCitation[];
}

export function evaluatePublicationGate(
  input: PublicationGateInput,
  now: Date = new Date()
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.severity?.trim() || !input.description?.trim()) {
    reasons.push("missing_core_clinical_fields");
  }
  if (
    !input.botanicalApplicability ||
    input.botanicalApplicability === "unspecified"
  ) {
    reasons.push("missing_botanical_applicability");
  }
  if (!input.clinicalReviewerId?.trim() || !input.verifiedAt?.trim()) {
    reasons.push("missing_clinical_reviewer_signoff");
  }
  if (input.clinicalActionStatus !== "clinician_approved") {
    reasons.push("clinical_action_not_approved");
  }
  if (!input.nextReviewDueAt) {
    reasons.push("missing_next_review_date");
  } else {
    const due = Date.parse(input.nextReviewDueAt);
    if (!Number.isFinite(due) || due <= now.getTime()) {
      reasons.push("review_stale");
    }
  }

  if (input.citations.length === 0) {
    reasons.push("missing_citation");
  } else {
    const hasRetracted = input.citations.some(
      (c) => c.retractionStatus === "retracted"
    );
    if (hasRetracted) {
      reasons.push("retracted_citation");
    }
    const hasActiveClaimSupporting = input.citations.some(
      (c) =>
        c.retractionStatus === "active" &&
        Boolean(c.url?.trim()) &&
        Boolean(c.sourceLicence?.trim()) &&
        Boolean(c.claimSupportAnchor?.trim())
    );
    if (!hasActiveClaimSupporting) {
      reasons.push("no_active_claim_supporting_citation");
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

export function getAbsenceOfEvidenceNotice(locale: "en" | "fr"): string {
  return locale === "fr"
    ? "Aucune fiche structurée trouvée dans notre table — cela reflète les limites de notre base et ne prouve pas l'absence de risque ni que l'association est sans risque. Vérifiez avec un pharmacien."
    : "No curated interaction record was found in our table — this reflects database coverage limits and is not proof of safety or absence of risk. Confirm with your pharmacist.";
}

export function getCollisionWarningBanner(
  locale: "en" | "fr",
  collisionPaths: readonly string[]
): string {
  const isFr = locale === "fr";
  const count = collisionPaths.length;
  return isFr
    ? `Avertissement de conflit non résolu (${count} paire${count > 1 ? "s" : ""}) : des fiches héritées divergentes partagent le même identifiant et sont conservées en mode sécuritaire sans fusion ni choix automatique. Confirmez la sévérité exacte auprès d'un pharmacien.`
    : `Unresolved collision warning (${count} pair${count > 1 ? "s" : ""}): conflicting legacy interaction records share the same canonical drug key and remain quarantined/fail-safe without automated ranking or selection. Confirm with a pharmacist or prescriber.`;
}

export interface InteractionStatusBadge {
  status: string;
  label: string;
  isPublished: boolean;
  isHeld: boolean;
  toneClass: string;
}

export function getInteractionStatusBadge(
  status: string | null | undefined,
  locale: "en" | "fr"
): InteractionStatusBadge {
  const isFr = locale === "fr";
  const normalized = status || "legacy_unreviewed";
  if (normalized === "published") {
    return {
      status: normalized,
      label: isFr
        ? "Publiée · Révisée par clinicien"
        : "Published · Clinician-reviewed",
      isPublished: true,
      isHeld: false,
      toneClass:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (normalized === "retracted_hold") {
    return {
      status: normalized,
      label: isFr ? "Retirée / Suspendue" : "Withheld · Retracted citation",
      isPublished: false,
      isHeld: true,
      toneClass: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    };
  }
  if (normalized === "quarantined_collision") {
    return {
      status: normalized,
      label: isFr ? "Conflit en quarantaine" : "Quarantined collision",
      isPublished: false,
      isHeld: true,
      toneClass:
        "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  return {
    status: normalized,
    label: isFr ? "Non révisée · Héritée" : "Unreviewed legacy",
    isPublished: false,
    isHeld: false,
    toneClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  };
}

export interface InteractionPublicationSummary {
  kind: "empty" | "all_published" | "all_unreviewed" | "all_held" | "mixed";
  publishedCount: number;
  unreviewedCount: number;
  heldCount: number;
  hasLegacyOrUnreviewed: boolean;
  banner: string;
}

export function summarizeInteractionPublicationStatus(
  items: ReadonlyArray<{
    publicationStatus?: string | null;
    publication_status?: string | null;
  }>,
  locale: "en" | "fr"
): InteractionPublicationSummary {
  const isFr = locale === "fr";
  if (items.length === 0) {
    return {
      kind: "empty",
      publishedCount: 0,
      unreviewedCount: 0,
      heldCount: 0,
      hasLegacyOrUnreviewed: false,
      banner: isFr
        ? "Aucune fiche structurée trouvée dans notre table — confirmez avec un pharmacien."
        : "No curated interaction records listed — confirm with a pharmacist.",
    };
  }

  let publishedCount = 0;
  let heldCount = 0;
  let unreviewedCount = 0;
  for (const item of items) {
    const s =
      item.publicationStatus ?? item.publication_status ?? "legacy_unreviewed";
    if (s === "published") publishedCount++;
    else if (s === "retracted_hold" || s === "quarantined_collision")
      heldCount++;
    else unreviewedCount++;
  }

  if (publishedCount === items.length) {
    return {
      kind: "all_published",
      publishedCount,
      unreviewedCount: 0,
      heldCount: 0,
      hasLegacyOrUnreviewed: false,
      banner: isFr
        ? "Toutes les fiches affichées sont publiées après révision clinique — confirmez néanmoins toute association auprès de votre pharmacien."
        : "All displayed records are published with clinician review — still confirm every combination with your pharmacist.",
    };
  }

  if (publishedCount === 0) {
    if (heldCount > 0 && unreviewedCount === 0) {
      return {
        kind: "all_held",
        publishedCount: 0,
        unreviewedCount: 0,
        heldCount,
        hasLegacyOrUnreviewed: true,
        banner: isFr
          ? `${heldCount} fiche${heldCount > 1 ? "s" : ""} retenue${heldCount > 1 ? "s" : ""} ou en quarantaine (conflit ou citation retirée) — confirmez chaque association auprès d'un pharmacien.`
          : `${heldCount} interaction record${heldCount > 1 ? "s" : ""} quarantined or withheld (collision or retracted citation) — confirm every pair with a pharmacist.`,
      };
    }
    if (heldCount > 0 && unreviewedCount > 0) {
      return {
        kind: "all_unreviewed",
        publishedCount: 0,
        unreviewedCount,
        heldCount,
        hasLegacyOrUnreviewed: true,
        banner: isFr
          ? `${unreviewedCount} fiche${unreviewedCount > 1 ? "s" : ""} héritée${unreviewedCount > 1 ? "s" : ""} non révisée${unreviewedCount > 1 ? "s" : ""} et ${heldCount} fiche${heldCount > 1 ? "s" : ""} retenue${heldCount > 1 ? "s" : ""}/en quarantaine — confirmez chaque association auprès d'un pharmacien.`
          : `${unreviewedCount} unreviewed legacy record${unreviewedCount > 1 ? "s" : ""} and ${heldCount} quarantined/withheld record${heldCount > 1 ? "s" : ""} — confirm every pair with a pharmacist.`,
      };
    }
    return {
      kind: "all_unreviewed",
      publishedCount: 0,
      unreviewedCount,
      heldCount: 0,
      hasLegacyOrUnreviewed: true,
      banner: isFr
        ? "Fiches héritées non révisées par un clinicien — confirmez chaque association auprès d'un pharmacien."
        : "Unreviewed legacy interaction records without clinician sign-off — confirm every pair with a pharmacist.",
    };
  }

  const partsEn: string[] = [
    `${publishedCount} clinician-reviewed published record${publishedCount > 1 ? "s" : ""}`,
  ];
  const partsFr: string[] = [
    `${publishedCount} fiche${publishedCount > 1 ? "s" : ""} publiée${publishedCount > 1 ? "s" : ""} après révision clinique`,
  ];
  if (unreviewedCount > 0) {
    partsEn.push(
      `${unreviewedCount} unreviewed legacy record${unreviewedCount > 1 ? "s" : ""}`
    );
    partsFr.push(
      `${unreviewedCount} fiche${unreviewedCount > 1 ? "s" : ""} héritée${unreviewedCount > 1 ? "s" : ""} non révisée${unreviewedCount > 1 ? "s" : ""}`
    );
  }
  if (heldCount > 0) {
    partsEn.push(
      `${heldCount} quarantined/withheld record${heldCount > 1 ? "s" : ""}`
    );
    partsFr.push(
      `${heldCount} fiche${heldCount > 1 ? "s" : ""} retenue${heldCount > 1 ? "s" : ""}/en quarantaine`
    );
  }

  return {
    kind: "mixed",
    publishedCount,
    unreviewedCount,
    heldCount,
    hasLegacyOrUnreviewed: true,
    banner: isFr
      ? `Statut mixte : ${partsFr.join(" et ")} — confirmez chaque association auprès d'un pharmacien.`
      : `Mixed publication status: ${partsEn.join(" and ")} — confirm every pair with a pharmacist.`,
  };
}
