import { describe, expect, it } from "vitest";
import {
  UNVERIFIED,
  getReviewState,
  isVerified,
  parseProvenance,
  ProvenanceSchema,
} from "../provenance";

describe("parseProvenance", () => {
  it("returns UNVERIFIED for null", () => {
    expect(parseProvenance(null)).toEqual(UNVERIFIED);
  });

  it("returns UNVERIFIED for undefined", () => {
    expect(parseProvenance(undefined)).toEqual(UNVERIFIED);
  });

  it("returns UNVERIFIED for an empty object (the migration default)", () => {
    expect(parseProvenance({})).toEqual(UNVERIFIED);
  });

  it("returns UNVERIFIED for garbage (never throws)", () => {
    expect(parseProvenance({ verification_method: "bogus" })).toEqual(
      UNVERIFIED
    );
    expect(parseProvenance("not-an-object")).toEqual(UNVERIFIED);
    expect(parseProvenance(42)).toEqual(UNVERIFIED);
  });

  it("parses a fully-populated manual record", () => {
    const result = parseProvenance({
      verification_method: "manual",
      sources: ["WHO", "NCCIH"],
      primary_url: "https://nccih.nih.gov/health/ginger",
      last_verified_at: "2026-06-09T12:00:00.000Z",
      verified_by: "Dr. Smith",
      notes: "Cross-checked WHO monograph 2024",
    });
    expect(result.verification_method).toBe("manual");
    expect(result.sources).toEqual(["WHO", "NCCIH"]);
    expect(result.primary_url).toBe("https://nccih.nih.gov/health/ginger");
    expect(result.verified_by).toBe("Dr. Smith");
    expect(result.notes).toBe("Cross-checked WHO monograph 2024");
  });

  it("applies default values for missing fields", () => {
    const result = parseProvenance({ verification_method: "ai_summarized" });
    expect(result.verification_method).toBe("ai_summarized");
    expect(result.sources).toEqual([]);
    expect(result.primary_url).toBeNull();
    expect(result.last_verified_at).toBeNull();
    expect(result.verified_by).toBeNull();
  });

  it("rejects a non-URL primary_url", () => {
    const result = parseProvenance({ primary_url: "not-a-url" });
    // falls back to default
    expect(result.primary_url).toBeNull();
  });
});

describe("isVerified", () => {
  it("returns true for manual", () => {
    expect(isVerified({ ...UNVERIFIED, verification_method: "manual" })).toBe(
      true
    );
  });

  it("returns true for primary_source with a named human reviewer", () => {
    expect(
      isVerified({
        ...UNVERIFIED,
        verification_method: "primary_source",
        verified_by: "Dr. Smith",
      })
    ).toBe(true);
  });

  it("returns false for primary_source without a reviewer", () => {
    // Citing a primary source is not a human review of the entry.
    expect(
      isVerified({ ...UNVERIFIED, verification_method: "primary_source" })
    ).toBe(false);
    expect(
      isVerified({
        ...UNVERIFIED,
        verification_method: "primary_source",
        verified_by: "   ",
      })
    ).toBe(false);
  });

  it("returns false when the recorded reviewer is automated", () => {
    // "auto-verification-script" was recorded as a reviewer in production
    // data; a script is not a human reviewer, whatever the method says.
    expect(
      isVerified({
        ...UNVERIFIED,
        verification_method: "manual",
        verified_by: "auto-verification-script",
      })
    ).toBe(false);
    expect(
      isVerified({
        ...UNVERIFIED,
        verification_method: "primary_source",
        verified_by: "auto-verification-script",
      })
    ).toBe(false);
  });

  it("returns false for ai_summarized", () => {
    expect(
      isVerified({ ...UNVERIFIED, verification_method: "ai_summarized" })
    ).toBe(false);
  });

  it("returns false for unverified", () => {
    expect(isVerified(UNVERIFIED)).toBe(false);
  });
});

describe("ProvenanceSchema", () => {
  it("rejects unknown verification_method", () => {
    expect(
      ProvenanceSchema.safeParse({ verification_method: "lol" }).success
    ).toBe(false);
  });

  it("accepts the four known methods", () => {
    for (const m of [
      "manual",
      "ai_summarized",
      "primary_source",
      "unverified",
    ]) {
      expect(
        ProvenanceSchema.safeParse({ verification_method: m }).success
      ).toBe(true);
    }
  });
});

describe("explicit review status", () => {
  const reviewed = {
    ...UNVERIFIED,
    review_status: "human_reviewed" as const,
    reviewed_by_name: "Dr Ada Lovelace",
    reviewed_on: "2026-11-02",
  };

  it("accepts a review only when a name and a date are both present", () => {
    expect(getReviewState(reviewed)).toEqual({
      kind: "human_reviewed",
      reviewer: "Dr Ada Lovelace",
      date: "2026-11-02",
    });
    expect(isVerified(reviewed)).toBe(true);
  });

  it("refuses a review with no date", () => {
    const noDate = { ...reviewed, reviewed_on: null };
    expect(getReviewState(noDate)).toEqual({ kind: "not_reviewed" });
    expect(isVerified(noDate)).toBe(false);
  });

  it("refuses a review attributed to a script", () => {
    const scripted = {
      ...reviewed,
      reviewed_by_name: "auto-verification-script",
    };
    expect(getReviewState(scripted)).toEqual({ kind: "not_reviewed" });
    expect(isVerified(scripted)).toBe(false);
  });

  it("takes the badge away when a page needs re-reviewing", () => {
    const stale = { ...reviewed, review_status: "needs_re_review" as const };
    expect(getReviewState(stale)).toEqual({
      kind: "needs_re_review",
      reviewer: "Dr Ada Lovelace",
    });
    expect(isVerified(stale)).toBe(false);
  });

  it("overrides a legacy primary_source verdict that has no reviewer", () => {
    const legacyShape = {
      ...UNVERIFIED,
      verification_method: "primary_source" as const,
      verified_by: "Someone",
      review_status: "not_reviewed" as const,
    };
    // The old derivation would call this verified; the explicit state wins.
    expect(isVerified(legacyShape)).toBe(false);
  });

  it("returns null for rows that predate the fields, so callers fall back", () => {
    expect(getReviewState(UNVERIFIED)).toBeNull();
  });

  it("survives a malformed status instead of losing the whole record", () => {
    const parsed = parseProvenance({
      verification_method: "primary_source",
      review_status: "probably-fine",
    });
    expect(parsed.verification_method).toBe("primary_source");
    expect(parsed.review_status).toBeNull();
  });
});
