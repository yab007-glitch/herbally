export type ClaimSourceType =
  | "regulatory_monograph"
  | "systematic_review"
  | "clinical_trial"
  | "clinical_study"
  | "pharmacovigilance_case"
  | "preclinical_study";

export type ClaimEvidenceQuality =
  "high" | "moderate" | "low" | "very_low" | "unassessed";

export interface ClaimCitationRecord {
  claimKey: string;
  sourceType: ClaimSourceType;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  retrievedAt: string;
  speciesMatch: boolean;
  preparationMatch: boolean;
  evidenceQuality: ClaimEvidenceQuality;
  retractionStatus:
    "active" | "corrected" | "expression_of_concern" | "retracted";
  reviewerId: string | null;
  reviewerRole: "editorial" | "clinical";
}

export function validateClaimCitation(record: ClaimCitationRecord): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.claimKey.trim()) errors.push("missing_claim_key");
  if (!record.sourceName.trim() || !record.sourceUrl.trim()) {
    errors.push("missing_source_attribution");
  }
  if (!record.retrievedAt.trim()) errors.push("missing_retrieved_at");
  if (record.retractionStatus === "retracted") errors.push("retracted_source");
  if (!record.speciesMatch) errors.push("species_mismatch");
  if (!record.preparationMatch) errors.push("preparation_mismatch");
  if (!record.reviewerId?.trim()) errors.push("missing_reviewer");

  return { valid: errors.length === 0, errors };
}
