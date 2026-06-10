import { describe, expect, it } from "vitest";
import {
  UNVERIFIED,
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

  it("returns true for primary_source", () => {
    expect(
      isVerified({ ...UNVERIFIED, verification_method: "primary_source" })
    ).toBe(true);
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
