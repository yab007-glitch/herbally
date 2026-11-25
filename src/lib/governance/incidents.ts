import { z } from "zod";

export const INCIDENT_CATEGORIES = [
  "pediatric_safety",
  "interaction_conflict_or_error",
  "toxic_herb_exposure_risk",
  "broken_or_retracted_citation",
  "translation_clinical_mismatch",
  "privacy_or_data_concern",
  "other",
] as const;

export const INCIDENT_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const incidentSubmissionSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(INCIDENT_SEVERITIES),
  surfaceUrl: z.string().trim().max(300).optional().nullable(),
  summary: z.string().trim().min(5).max(200),
  details: z.string().trim().min(5).max(3000),
});

export type IncidentSubmissionInput = z.infer<typeof incidentSubmissionSchema>;

const SLA_HOURS_BY_SEVERITY: Readonly<Record<IncidentSeverity, number>> = {
  critical: 24,
  high: 72,
  medium: 7 * 24,
  low: 30 * 24,
};

export interface BuiltIncidentRecord {
  category: IncidentCategory;
  severity: IncidentSeverity;
  surfaceUrl: string | null;
  summary: string;
  details: string;
  triageStatus: "open_triage";
  slaDueAt: string;
}

export function buildIncidentSubmission(
  input: IncidentSubmissionInput,
  now: Date = new Date()
): BuiltIncidentRecord {
  const slaHours = SLA_HOURS_BY_SEVERITY[input.severity];
  const slaDueAt = new Date(
    now.getTime() + slaHours * 60 * 60 * 1000
  ).toISOString();

  return {
    category: input.category,
    severity: input.severity,
    surfaceUrl: input.surfaceUrl?.trim() || null,
    summary: input.summary.trim(),
    details: input.details.trim(),
    triageStatus: "open_triage",
    slaDueAt,
  };
}
