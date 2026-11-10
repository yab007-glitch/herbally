/**
 * Contract tests for the interaction seed validator. Every RejectionCode gets
 * its own case so a rule cannot silently widen to cover two failure modes.
 */
import { describe, expect, it } from "vitest";
import type { SeedPair } from "../../../../scripts/interactions/seed";
import {
  pairKey,
  validatePair,
  type RejectionCode,
  type ValidateContext,
  type ValidationResult,
} from "../../../../scripts/interactions/validate";

const PUBLISHED = new Set(["turmeric", "st-johns-wort"]);

function makePair(overrides: Partial<SeedPair> = {}): SeedPair {
  return {
    drug_name: "Warfarin (Coumadin)",
    severity: "severe",
    description:
      "Turmeric may increase the risk of bleeding when combined with warfarin.",
    mechanism: "Adds antiplatelet and anticoagulant effects.",
    evidence_level: "well-documented",
    source: "NIH ODS",
    source_licence: "us-federal-public-domain",
    source_url:
      "https://ods.od.nih.gov/factsheets/Turmeric-HealthProfessional/",
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ValidateContext> = {}
): ValidateContext {
  return {
    herbSlug: "turmeric",
    publishedHerbSlugs: PUBLISHED,
    acceptedPairKeys: new Set<string>(),
    existingPairs: [],
    ...overrides,
  };
}

function expectRejection(result: ValidationResult, code: RejectionCode): void {
  if (result.ok) {
    throw new Error(`expected ${code}, but the pair was accepted`);
  }
  expect(result.code).toBe(code);
}

describe("validatePair", () => {
  it("accepts a complete pair and returns its canonical identity", () => {
    const result = validatePair(makePair(), makeContext());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.pairKey).toBe("turmeric/warfarin");
    expect(result.drugSlug).toBe("warfarin");
  });

  it("accepts a URL on a subdomain of the host its source must cite", () => {
    const result = validatePair(
      makePair({
        source_url:
          "https://www.ods.od.nih.gov/factsheets/Turmeric-HealthProfessional/",
      }),
      makeContext()
    );

    expect(result.ok).toBe(true);
  });

  it("allows an existing pair with the same drug name (idempotent update)", () => {
    const result = validatePair(
      makePair(),
      makeContext({
        existingPairs: [
          { drugName: "Warfarin (Coumadin)", drugSlug: "warfarin" },
        ],
      })
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a missing herb slug with HERB_SLUG_MISSING", () => {
    const result = validatePair(makePair(), makeContext({ herbSlug: "   " }));
    expectRejection(result, "HERB_SLUG_MISSING");
  });

  it("rejects an unpublished herb with HERB_NOT_PUBLISHED", () => {
    const result = validatePair(
      makePair(),
      makeContext({ herbSlug: "unpublished-herb" })
    );
    expectRejection(result, "HERB_NOT_PUBLISHED");
  });

  it("rejects a one-character drug name with DRUG_NAME_TOO_SHORT", () => {
    const result = validatePair(makePair({ drug_name: " X " }), makeContext());
    expectRejection(result, "DRUG_NAME_TOO_SHORT");
  });

  it("rejects an 81-character drug name with DRUG_NAME_TOO_LONG", () => {
    const result = validatePair(
      makePair({ drug_name: "A".repeat(81) }),
      makeContext()
    );
    expectRejection(result, "DRUG_NAME_TOO_LONG");
  });

  it("rejects markdown characters in a drug name with DRUG_NAME_MARKDOWN", () => {
    const result = validatePair(
      makePair({ drug_name: "**Warfarin**" }),
      makeContext()
    );
    expectRejection(result, "DRUG_NAME_MARKDOWN");
  });

  it("rejects an unknown severity with SEVERITY_INVALID", () => {
    const result = validatePair(makePair({ severity: "high" }), makeContext());
    expectRejection(result, "SEVERITY_INVALID");
  });

  it("rejects a short description with DESCRIPTION_TOO_SHORT", () => {
    const result = validatePair(
      makePair({ description: "Bleeding risk." }),
      makeContext()
    );
    expectRejection(result, "DESCRIPTION_TOO_SHORT");
  });

  it("rejects a blank mechanism with MECHANISM_MISSING", () => {
    const result = validatePair(makePair({ mechanism: "   " }), makeContext());
    expectRejection(result, "MECHANISM_MISSING");
  });

  it("rejects a short mechanism with MECHANISM_TOO_SHORT", () => {
    const result = validatePair(
      makePair({ mechanism: "Adds bleeding." }),
      makeContext()
    );
    expectRejection(result, "MECHANISM_TOO_SHORT");
  });

  it("rejects an unknown evidence level with EVIDENCE_LEVEL_INVALID", () => {
    const result = validatePair(
      makePair({ evidence_level: "anecdotal" }),
      makeContext()
    );
    expectRejection(result, "EVIDENCE_LEVEL_INVALID");
  });

  it("rejects a blank source with SOURCE_MISSING", () => {
    const result = validatePair(makePair({ source: "  " }), makeContext());
    expectRejection(result, "SOURCE_MISSING");
  });

  it("rejects a source outside SOURCE_VALUES with SOURCE_NOT_ALLOWED", () => {
    const result = validatePair(
      makePair({ source: "Natural Medicines Database" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_NOT_ALLOWED");
  });

  it("rejects a missing source_licence with SOURCE_LICENCE_MISSING", () => {
    const result = validatePair(
      makePair({ source_licence: "" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_LICENCE_MISSING");
  });

  it("rejects an unknown source_licence with SOURCE_LICENCE_INVALID", () => {
    const result = validatePair(
      makePair({ source_licence: "public-domain" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_LICENCE_INVALID");
  });

  it("rejects a licence that is not the cited host's licence with SOURCE_LICENCE_MISMATCH", () => {
    const result = validatePair(
      makePair({ source: "NIH ODS", source_licence: "ema-legal-notice" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_LICENCE_MISMATCH");
  });

  it("rejects a citation host the declared source does not own with SOURCE_LICENCE_MISMATCH", () => {
    const result = validatePair(
      makePair({
        source: "NIH ODS",
        source_url: "https://nccih.nih.gov/health/turmeric",
      }),
      makeContext()
    );
    expectRejection(result, "SOURCE_LICENCE_MISMATCH");
  });

  it("rejects the WHO non-commercial licence with LICENCE_NOT_COMMERCIAL_USE", () => {
    // The licence gate runs before the host checks, so a non-commercial
    // licence is named as the reason rather than surfacing as a mismatch.
    const result = validatePair(
      makePair({
        source_licence: "who-cc-by-nc-sa",
        source_url: "https://www.who.int/publications/monographs",
      }),
      makeContext()
    );
    expectRejection(result, "LICENCE_NOT_COMMERCIAL_USE");
  });

  it("rejects the Cochrane non-commercial licence with LICENCE_NOT_COMMERCIAL_USE", () => {
    const result = validatePair(
      makePair({
        source_licence: "cochrane-abstract-licence",
        source_url: "https://www.cochrane.org/evidence/turmeric",
      }),
      makeContext()
    );
    expectRejection(result, "LICENCE_NOT_COMMERCIAL_USE");
  });

  it("rejects a missing source_url with SOURCE_URL_MISSING", () => {
    const result = validatePair(
      makePair({ source_url: undefined }),
      makeContext()
    );
    expectRejection(result, "SOURCE_URL_MISSING");
  });

  it("rejects an unparseable source_url with SOURCE_URL_INVALID", () => {
    const result = validatePair(
      makePair({ source_url: "ods.od.nih.gov/factsheets" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_URL_INVALID");
  });

  it("rejects an http source_url with SOURCE_URL_NOT_HTTPS", () => {
    const result = validatePair(
      makePair({
        source_url:
          "http://ods.od.nih.gov/factsheets/Turmeric-HealthProfessional/",
      }),
      makeContext()
    );
    expectRejection(result, "SOURCE_URL_NOT_HTTPS");
  });

  it("rejects a host outside the allowlist with SOURCE_HOST_NOT_ALLOWED", () => {
    const result = validatePair(
      makePair({ source_url: "https://example.com/turmeric-warfarin" }),
      makeContext()
    );
    expectRejection(result, "SOURCE_HOST_NOT_ALLOWED");
  });

  it("rejects a pair already accepted in this run with DUPLICATE_PAIR", () => {
    const result = validatePair(
      makePair(),
      makeContext({
        acceptedPairKeys: new Set([pairKey("turmeric", "Warfarin (Coumadin)")]),
      })
    );
    expectRejection(result, "DUPLICATE_PAIR");
  });

  it("rejects a different drug name with the same slug with DRUG_SLUG_COLLISION", () => {
    const result = validatePair(
      makePair(),
      makeContext({
        existingPairs: [{ drugName: "Warfarin Sodium", drugSlug: "warfarin" }],
      })
    );
    expectRejection(result, "DRUG_SLUG_COLLISION");
  });

  it("never mutates the pair or fills in a missing source_url", () => {
    const pair = makePair();
    delete pair.source_url;
    const before = JSON.stringify(pair);

    const result = validatePair(pair, makeContext());

    expectRejection(result, "SOURCE_URL_MISSING");
    expect(JSON.stringify(pair)).toBe(before);
    expect(pair).not.toHaveProperty("source_url");
  });
});
