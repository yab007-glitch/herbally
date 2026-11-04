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

export const ReviewStatusSchema = z.enum([
  "ai_generated",
  "not_reviewed",
  "human_reviewed",
  "needs_re_review",
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ProvenanceSchema = z.object({
  sources: z.array(z.string()).default([]),
  primary_url: z.string().url().nullable().default(null),
  last_verified_at: z.string().datetime().nullable().default(null),
  verified_by: z.string().nullable().default(null),
  verification_method: VerificationMethodSchema.default("unverified"),
  notes: z.string().optional(),
  /**
   * Explicit human-review state (SEO brief, Workstream E).
   *
   * `verification_method` says how the text was produced; it is not the same
   * question as "did a named person read it". These fields answer the second
   * question and stay `null` on every row that has not been reviewed, so the
   * legacy derivation below keeps deciding what those pages show.
   */
  review_status: z
    .union([ReviewStatusSchema, z.null()])
    .catch(null)
    .default(null),
  /** A real person's name. Never a script, a bot, or the editorial team. */
  reviewed_by_name: z.string().nullable().default(null),
  /** ISO date (YYYY-MM-DD) of the review itself. */
  reviewed_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null)
    .default(null),
  review_notes: z.string().optional(),
  /**
   * Cross-check state: how many independent sources attest to this entry.
   *
   * This is NOT human review. It says the plant identity and regulator record were
   * confirmed by two or more named sources, which is what the "Verified · N
   * sources" badge claims. `review_status` above stays the only field that can say
   * a person read the page.
   */
  verification_status: z
    .enum(["verified", "single_source", "unverified", "formula"])
    .nullable()
    .catch(null)
    .default(null),
  verified_source_count: z.number().catch(0).default(0),
  verified_sources: z.array(z.string()).catch([]).default([]),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const UNVERIFIED: Provenance = {
  sources: [],
  primary_url: null,
  last_verified_at: null,
  verified_by: null,
  verification_method: "unverified",
  review_status: null,
  reviewed_by_name: null,
  reviewed_on: null,
  verification_status: null,
  verified_source_count: 0,
  verified_sources: [],
};

/**
 * Parse a raw jsonb value (or null/undefined) into a Provenance record.
 * Always returns a valid record — never throws. On parse failure we
 * fall back to UNVERIFIED so the UI never crashes on bad data.
 */
export function parseProvenance(raw: unknown): Provenance {
  // `sources` arrives in two shapes: legacy string labels, and the richer objects
  // written by the data pipeline ({type, name, licence, url}). The schema wants
  // strings, so a single object-shaped entry used to fail the whole parse and drop
  // the record to UNVERIFIED — which is why 3,251 cross-checked herbs still showed
  // the amber "AI-Generated" badge. Normalise before validating.
  const input: Record<string, unknown> =
    typeof raw === "object" && raw !== null
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (Array.isArray(input.sources)) {
    input.sources = (input.sources as unknown[])
      .map((s) => {
        if (typeof s === "string") return s;
        if (s && typeof s === "object") {
          const o = s as Record<string, unknown>;
          return String(o.name ?? o.type ?? o.url ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  const result = ProvenanceSchema.safeParse(input);
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
  // An explicit review state wins over the legacy derivation: it is the only
  // field that can say "a named person read this", and the only one that can
  // take the badge away again when a page needs re-reviewing.
  const explicit = getReviewState(p);
  if (explicit) return explicit.kind === "human_reviewed";

  if (p.verification_method === "manual") {
    return p.verified_by == null || isNamedHumanReviewer(p.verified_by);
  }
  if (p.verification_method === "primary_source") {
    return isNamedHumanReviewer(p.verified_by);
  }
  return false;
}

/**
 * What the page is allowed to claim about human review.
 *
 * `human_reviewed` requires all three: the status, a named reviewer that is not
 * a script, and the date the review happened. Anything less is `not_reviewed` —
 * a badge that says "reviewed" without a person and a date is a fabricated
 * credential, which is worse than no badge at all.
 *
 * Returns null for rows that predate these fields, so callers fall back to the
 * `verification_method` label they already render.
 */
export type ReviewState =
  | { kind: "human_reviewed"; reviewer: string; date: string }
  | { kind: "needs_re_review"; reviewer: string | null }
  | { kind: "ai_generated" }
  | { kind: "not_reviewed" };

export function getReviewState(p: Provenance): ReviewState | null {
  switch (p.review_status) {
    case "human_reviewed":
      if (
        p.reviewed_by_name &&
        p.reviewed_on &&
        isNamedHumanReviewer(p.reviewed_by_name)
      ) {
        return {
          kind: "human_reviewed",
          reviewer: p.reviewed_by_name,
          date: p.reviewed_on,
        };
      }
      return { kind: "not_reviewed" };
    case "needs_re_review":
      return { kind: "needs_re_review", reviewer: p.reviewed_by_name };
    case "ai_generated":
      return { kind: "ai_generated" };
    case "not_reviewed":
      return { kind: "not_reviewed" };
    default:
      return null;
  }
}
