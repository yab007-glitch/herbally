/**
 * Provenance — a structured record of *how* a herb or monograph was
 * verified. The shape lives in a jsonb column on `herbs` and
 * `herb_monographs` (see migration 00024_add_provenance.sql).
 *
 * Soft default is `{}` which parses to `verification_method: "unverified"`.
 * Use `parseProvenance(raw)` at the access site so an empty/malformed
 * jsonb value always lands on a safe shape.
 *
 * Implemented without `zod` so client components (`HerbCard`, `HerbHeroV2`,
 * `ProvenanceBadge`) do not pull ~400 KB of schema machinery into the browser.
 */

const VERIFICATION_METHODS = [
  "manual",
  "ai_summarized",
  "primary_source",
  "unverified",
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

const REVIEW_STATUSES = [
  "ai_generated",
  "not_reviewed",
  "human_reviewed",
  "needs_re_review",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const VERIFICATION_STATUSES = [
  "verified",
  "single_source",
  "unverified",
  "formula",
  "non_plant",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface Provenance {
  sources: string[];
  primary_url: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
  verification_method: VerificationMethod;
  notes?: string;
  review_status: ReviewStatus | null;
  reviewed_by_name: string | null;
  reviewed_on: string | null;
  review_notes?: string;
  verification_status: VerificationStatus | null;
  verified_source_count: number;
  verified_sources: string[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Lightweight drop-in replacement for the previous Zod schema's `safeParse`,
 * preserving exact validation and `.catch()` fallback semantics.
 */
export const ProvenanceSchema = {
  safeParse(
    raw: unknown
  ): { success: true; data: Provenance } | { success: false } {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { success: false };
    }
    const obj = raw as Record<string, unknown>;

    let sources: string[] = [];
    if (obj.sources !== undefined) {
      if (!isStringArray(obj.sources)) return { success: false };
      sources = obj.sources;
    }

    let primary_url: string | null = null;
    if (obj.primary_url !== undefined && obj.primary_url !== null) {
      if (typeof obj.primary_url !== "string" || !isValidUrl(obj.primary_url)) {
        return { success: false };
      }
      primary_url = obj.primary_url;
    }

    let last_verified_at: string | null = null;
    if (obj.last_verified_at !== undefined && obj.last_verified_at !== null) {
      if (
        typeof obj.last_verified_at !== "string" ||
        !ISO_DATETIME_RE.test(obj.last_verified_at) ||
        Number.isNaN(Date.parse(obj.last_verified_at))
      ) {
        return { success: false };
      }
      last_verified_at = obj.last_verified_at;
    }

    let verified_by: string | null = null;
    if (obj.verified_by !== undefined && obj.verified_by !== null) {
      if (typeof obj.verified_by !== "string") return { success: false };
      verified_by = obj.verified_by;
    }

    let verification_method: VerificationMethod = "unverified";
    if (obj.verification_method !== undefined) {
      if (!isOneOf(obj.verification_method, VERIFICATION_METHODS)) {
        return { success: false };
      }
      verification_method = obj.verification_method;
    }

    let notes: string | undefined;
    if (obj.notes !== undefined) {
      if (typeof obj.notes !== "string") return { success: false };
      notes = obj.notes;
    }

    let review_notes: string | undefined;
    if (obj.review_notes !== undefined) {
      if (typeof obj.review_notes !== "string") return { success: false };
      review_notes = obj.review_notes;
    }

    const review_status: ReviewStatus | null = isOneOf(
      obj.review_status,
      REVIEW_STATUSES
    )
      ? obj.review_status
      : null;

    let reviewed_by_name: string | null = null;
    if (obj.reviewed_by_name !== undefined && obj.reviewed_by_name !== null) {
      if (typeof obj.reviewed_by_name !== "string") return { success: false };
      reviewed_by_name = obj.reviewed_by_name;
    }

    const reviewed_on: string | null =
      typeof obj.reviewed_on === "string" && ISO_DATE_RE.test(obj.reviewed_on)
        ? obj.reviewed_on
        : null;

    const verification_status: VerificationStatus | null = isOneOf(
      obj.verification_status,
      VERIFICATION_STATUSES
    )
      ? obj.verification_status
      : null;

    const verified_source_count =
      typeof obj.verified_source_count === "number" &&
      Number.isFinite(obj.verified_source_count)
        ? obj.verified_source_count
        : 0;

    const verified_sources = isStringArray(obj.verified_sources)
      ? obj.verified_sources
      : [];

    const data: Provenance = {
      sources,
      primary_url,
      last_verified_at,
      verified_by,
      verification_method,
      ...(notes !== undefined ? { notes } : {}),
      review_status,
      reviewed_by_name,
      reviewed_on,
      ...(review_notes !== undefined ? { review_notes } : {}),
      verification_status,
      verified_source_count,
      verified_sources,
    };

    return { success: true, data };
  },
};

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
