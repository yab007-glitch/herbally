import { z } from "zod";

/**
 * Provenance — a structured record of *how* a herb or monograph was
 * verified. The shape lives in a jsonb column on `herbs` and
 * `herb_monographs` (see migration 00024_add_provenance.sql).
 *
 * Soft default is `{}` which parses to `verification_method: "unverified"`.
 * Use `parseProvenance(raw)` at the access site so an empty/malformed
 * jsonb value always lands on a safe shape.
 */
export const VerificationMethodSchema = z.enum([
  "manual",
  "ai_summarized",
  "primary_source",
  "unverified",
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const ProvenanceSchema = z.object({
  sources: z.array(z.string()).default([]),
  primary_url: z.string().url().nullable().default(null),
  last_verified_at: z.string().datetime().nullable().default(null),
  verified_by: z.string().nullable().default(null),
  verification_method: VerificationMethodSchema.default("unverified"),
  notes: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const UNVERIFIED: Provenance = {
  sources: [],
  primary_url: null,
  last_verified_at: null,
  verified_by: null,
  verification_method: "unverified",
};

/**
 * Parse a raw jsonb value (or null/undefined) into a Provenance record.
 * Always returns a valid record — never throws. On parse failure we
 * fall back to UNVERIFIED so the UI never crashes on bad data.
 */
export function parseProvenance(raw: unknown): Provenance {
  const result = ProvenanceSchema.safeParse(raw ?? {});
  return result.success ? result.data : UNVERIFIED;
}

/**
 * True if the entry has been reviewed by a human against a primary source.
 * Drives the "Verified" badge — and the pregnancy/nursing verdicts in the
 * herb hero, which are only shown for verified entries.
 *
 * Two data shapes used to slip through as "Verified" even though no human
 * had reviewed them:
 * - `primary_source` with no reviewer: citing a primary source is not the
 *   same as a human checking the entry against it. The badge's own fallback
 *   comment said exactly this, but it was unreachable because isVerified()
 *   returned true for every `primary_source` record.
 * - a reviewer that is plainly automated (e.g. "auto-verification-script"
 *   in production data): a script is not a human reviewer, even when the
 *   method is recorded as "manual".
 *
 * `manual` with no named reviewer still counts: the method itself records
 * a human review process, just without an attributed name.
 */
function isNamedHumanReviewer(name: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  // Automated reviewer names seen in production data. A real person's name
  // does not contain these tokens.
  return !/auto|script|bot/i.test(trimmed);
}

export function isVerified(p: Provenance): boolean {
  if (p.verification_method === "manual") {
    return p.verified_by == null || isNamedHumanReviewer(p.verified_by);
  }
  if (p.verification_method === "primary_source") {
    return isNamedHumanReviewer(p.verified_by);
  }
  return false;
}
