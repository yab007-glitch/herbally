export type PageRiskTier =
  | "tier_3_blocked_or_quarantined"
  | "tier_2_clinical_review_required"
  | "tier_1_monograph_verified";

export type PageIndexPolicy =
  "noindex_quarantined" | "noindex_until_reviewed" | "indexable";

export interface RiskTierDecision {
  tier: PageRiskTier;
  allowIndex: boolean;
  defaultIndexPolicy: PageIndexPolicy;
  requiresClinicalReviewBadge: boolean;
  reason: string;
}

/**
 * Deterministic risk tiering for clinical pages and records. Defaults
 * conservatively: dangerous plants and colliding interaction pairs stay
 * quarantined/noindex, and unreviewed clinical pages carry review-required notices.
 */
export function classifyPageRiskTier(input: {
  slug: string;
  isDangerous: boolean;
  hasClinicalReview: boolean;
  hasVerifiedCitation: boolean;
  hasCollision: boolean;
}): RiskTierDecision {
  if (input.isDangerous || input.hasCollision) {
    return {
      tier: "tier_3_blocked_or_quarantined",
      allowIndex: false,
      defaultIndexPolicy: "noindex_quarantined",
      requiresClinicalReviewBadge: true,
      reason: input.isDangerous
        ? "Toxic/dangerous plant blocked from dosing and clinical self-use framing."
        : "Unresolved pair collision quarantined fail-safe pending clinical resolution.",
    };
  }

  if (!input.hasClinicalReview || !input.hasVerifiedCitation) {
    return {
      tier: "tier_2_clinical_review_required",
      allowIndex: false,
      defaultIndexPolicy: "noindex_until_reviewed",
      requiresClinicalReviewBadge: true,
      reason:
        "Missing licensed clinical reviewer sign-off or claim-matched active citation.",
    };
  }

  return {
    tier: "tier_1_monograph_verified",
    allowIndex: true,
    defaultIndexPolicy: "indexable",
    requiresClinicalReviewBadge: false,
    reason:
      "Documented active primary citation and recorded licensed clinical reviewer verification.",
  };
}
