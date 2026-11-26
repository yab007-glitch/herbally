import { z } from "zod";
import type { Database } from "@/lib/types/database";

export const PROFESSIONAL_ROLES = [
  "pharmacist",
  "physician",
  "nurse_practitioner_rn",
  "naturopathic_doctor",
  "clinical_pharmacologist",
  "medical_lab_technologist",
  "registered_dietitian",
  "clinical_herbalist",
  "other_clinician",
] as const;

export const EDIT_TARGET_TYPES = [
  "herb",
  "interaction",
  "medication",
  "general",
] as const;

export const EDIT_FIELD_SCOPES = [
  "dosage_safety",
  "drug_interaction",
  "evidence_grade",
  "contraindications_pregnancy",
  "monograph_narrative",
  "citations_sources",
  "translation_fr",
  "other",
] as const;

export const EDIT_REQUEST_STATUSES = [
  "pending",
  "under_review",
  "needs_info",
  "approved",
  "applied",
  "rejected",
] as const;

export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number];
export type EditTargetType = (typeof EDIT_TARGET_TYPES)[number];
export type EditFieldScope = (typeof EDIT_FIELD_SCOPES)[number];
export type EditRequestStatus = (typeof EDIT_REQUEST_STATUSES)[number];

export type ClinicalEditRequestRow =
  Database["public"]["Tables"]["clinical_edit_requests"]["Row"];

/**
 * Normalize a public LinkedIn profile URL (e.g. `https://www.linkedin.com/in/jane-doe`).
 * Rejects non-HTTPS, non-linkedin.com domains, and non-profile paths so reviewer
 * records always link to a real profile page.
 */
export function normalizeLinkedInProfileUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 300) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return null;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    if (!/^\/in\/[^/]{2,}$/.test(cleanPath)) return null;
    return `https://www.linkedin.com${cleanPath}`;
  } catch {
    return null;
  }
}

/**
 * Parse and validate primary literature / monograph citations entered by a reviewer.
 * Accepts `https://...` URLs, `PMID:12345678` (or `PMID 12345678`), or `DOI:10....`.
 */
export function parseCitationList(raw: string | readonly string[]): {
  valid: string[];
  invalid: string[];
} {
  const items =
    typeof raw === "string"
      ? raw
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
      : raw.map((s) => String(s).trim()).filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (valid.length >= 10) break;
    if (item.length > 500) {
      invalid.push(item.slice(0, 60));
      continue;
    }

    const pmidMatch = /^PMID[:\s]*(\d{5,9})$/i.exec(item);
    if (pmidMatch) {
      const normalized = `PMID:${pmidMatch[1]}`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        valid.push(normalized);
      }
      continue;
    }

    const doiMatch = /^DOI[:\s]*(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)$/i.exec(
      item
    );
    if (doiMatch) {
      const normalized = `DOI:${doiMatch[1]}`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        valid.push(normalized);
      }
      continue;
    }

    if (/^https:\/\//i.test(item)) {
      try {
        const u = new URL(item);
        if (u.protocol === "https:" && u.hostname.includes(".")) {
          const normalized = u.toString();
          if (!seen.has(normalized)) {
            seen.add(normalized);
            valid.push(normalized);
          }
          continue;
        }
      } catch {
        // Fall through to invalid
      }
    }

    invalid.push(item);
  }

  return { valid, invalid };
}

function normalizeOptionalSurfaceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed.slice(0, 300);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString().slice(0, 300);
    }
  } catch {
    // Reject invalid URL
  }
  return null;
}

export const clinicalEditSubmissionSchema = z
  .object({
    linkedinProfileUrl: z
      .string()
      .trim()
      .min(1, "LinkedIn profile URL is required")
      .max(300)
      .transform((val, ctx) => {
        const normalized = normalizeLinkedInProfileUrl(val);
        if (!normalized) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Enter a valid https://www.linkedin.com/in/your-handle profile URL.",
          });
          return z.NEVER;
        }
        return normalized;
      }),
    professionalRole: z.enum(PROFESSIONAL_ROLES),
    credentials: z
      .string()
      .trim()
      .min(2, "Professional credentials or designation are required.")
      .max(120),
    affiliation: z.string().trim().max(180).optional().default(""),
    licenceNumber: z.string().trim().max(80).optional().default(""),
    licenceJurisdiction: z.string().trim().max(120).optional().default(""),
    conflictOfInterest: z
      .string()
      .trim()
      .min(
        4,
        "Disclose any financial or professional conflict of interest (or write None)."
      )
      .max(500),
    attributionConsent: z.boolean().optional().default(false),
    noPhiAttested: z.boolean().refine((v) => v === true, {
      message:
        "Confirm your submission contains no patient health information.",
    }),
    targetType: z.enum(EDIT_TARGET_TYPES),
    herbSlug: z.string().trim().max(120).optional().default(""),
    drugName: z.string().trim().max(120).optional().default(""),
    surfaceUrl: z.string().trim().max(300).optional().default(""),
    fieldScope: z.enum(EDIT_FIELD_SCOPES),
    summary: z
      .string()
      .trim()
      .min(10, "Provide a concise summary (at least 10 characters).")
      .max(200),
    currentText: z.string().trim().max(3000).optional().default(""),
    proposedChange: z
      .string()
      .trim()
      .min(
        20,
        "Describe the proposed wording or change (at least 20 characters)."
      )
      .max(6000),
    clinicalRationale: z
      .string()
      .trim()
      .min(20, "Explain the clinical rationale (at least 20 characters).")
      .max(6000),
    citations: z
      .union([z.string(), z.array(z.string())])
      .transform((val, ctx) => {
        const parsed = parseCitationList(val);
        if (parsed.invalid.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsupported citation format: ${parsed.invalid[0]}. Use https:// URLs, PMID:12345678, or DOI:10....`,
          });
          return z.NEVER;
        }
        if (parsed.valid.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Provide at least one primary citation (https:// URL, PMID:..., or DOI:...).",
          });
          return z.NEVER;
        }
        return parsed.valid;
      }),
    locale: z.enum(["en", "fr"]).optional().default("en"),
  })
  .superRefine((data, ctx) => {
    if (
      (data.targetType === "herb" || data.targetType === "interaction") &&
      !data.herbSlug.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["herbSlug"],
        message: "Herb slug is required for herb or interaction requests.",
      });
    }
    if (
      (data.targetType === "interaction" || data.targetType === "medication") &&
      !data.drugName.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drugName"],
        message:
          "Medication name is required for interaction or medication requests.",
      });
    }
    if (data.herbSlug && !/^[a-z0-9-]+$/i.test(data.herbSlug.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["herbSlug"],
        message: "Herb slug may contain only letters, numbers, and hyphens.",
      });
    }
    if (data.surfaceUrl && !normalizeOptionalSurfaceUrl(data.surfaceUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["surfaceUrl"],
        message: "Surface URL must be an in-app path or http(s) URL.",
      });
    }
  });

export type ClinicalEditSubmissionInput = z.infer<
  typeof clinicalEditSubmissionSchema
>;

export const adminTriageEditSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(EDIT_REQUEST_STATUSES),
  adminNotes: z.string().trim().max(2000).optional().default(""),
  publishCorrection: z.boolean().optional().default(false),
  correctionSummary: z.string().trim().max(500).optional().default(""),
});
