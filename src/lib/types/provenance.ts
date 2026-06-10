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
 * Drives the "Verified" badge.
 */
export function isVerified(p: Provenance): boolean {
  return p.verification_method === "manual" || p.verification_method === "primary_source";
}
