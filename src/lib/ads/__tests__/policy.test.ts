import { describe, expect, it } from "vitest";
import {
  AD_CONSENT_VERSION,
  ADS_LAUNCH_GATE,
  classifyPage,
  evaluateAdGate,
  isAdEligiblePath,
  isSensitivePath,
  normalizePublicPath,
  parseAdConsent,
  regionForCountry,
  resolveAdRegion,
  serializeAdConsent,
  type AdGateInput,
} from "@/lib/ads/policy";

/**
 * The gate decision is the single most important piece of the ad programme:
 * every failure mode must land on "no ad". These tests pin the ordering, so a
 * future refactor cannot quietly move a permissive branch above a restrictive
 * one.
 */

const allowedInput: AdGateInput = {
  gate: true,
  client: "ca-pub-1901058826905247",
  slot: "1234567890",
  pathname: "/herbs/ginger",
  bootPathname: "/herbs/ginger",
  consent: "granted",
  region: "row",
};

describe("normalizePublicPath", () => {
  it("strips the /fr and internal /en prefixes", () => {
    expect(normalizePublicPath("/fr/herbs/ginger")).toBe("/herbs/ginger");
    expect(normalizePublicPath("/en/herbs/ginger")).toBe("/herbs/ginger");
    expect(normalizePublicPath("/fr")).toBe("/");
    expect(normalizePublicPath("/en")).toBe("/");
  });

  it("drops query strings and hashes so eligibility cannot be spoofed", () => {
    expect(normalizePublicPath("/herbs/ginger?q=secret")).toBe("/herbs/ginger");
    expect(normalizePublicPath("/herbalist?q=warfarin#answer")).toBe(
      "/herbalist"
    );
  });

  it("treats empty and relative inputs as root", () => {
    expect(normalizePublicPath("")).toBe("/");
    expect(normalizePublicPath("herbs/ginger")).toBe("/herbs/ginger");
  });
});

describe("isAdEligiblePath", () => {
  it("accepts exactly one public herb detail page", () => {
    expect(isAdEligiblePath("/herbs/ginger")).toBe(true);
    expect(isAdEligiblePath("/herbs/ginger/")).toBe(true);
    expect(isAdEligiblePath("/fr/herbs/ginger")).toBe(true);
    expect(isAdEligiblePath("/en/herbs/ginger")).toBe(true);
  });

  it("rejects the herb index, nested routes and every other page", () => {
    expect(isAdEligiblePath("/herbs")).toBe(false);
    expect(isAdEligiblePath("/herbs/ginger/dosage")).toBe(false);
    expect(isAdEligiblePath("/")).toBe(false);
    expect(isAdEligiblePath("/herbalist")).toBe(false);
    expect(isAdEligiblePath("/interactions/ginger")).toBe(false);
  });
});

describe("isSensitivePath", () => {
  it("covers every health-input and authenticated surface", () => {
    for (const path of [
      "/herbalist",
      "/herbalist?q=st+johns+wort",
      "/calculator",
      "/interactions",
      "/interactions/ginger",
      "/symptoms",
      "/compare",
      "/garden",
      "/profile",
      "/admin/herbs",
      "/embed/checker",
      "/auth/callback",
      "/login",
      "/api/ads/region",
    ]) {
      expect(isSensitivePath(path), path).toBe(true);
    }
  });

  it("does not flag public reference content", () => {
    expect(isSensitivePath("/herbs/ginger")).toBe(false);
    expect(isSensitivePath("/privacy")).toBe(false);
    expect(isSensitivePath("/sponsors")).toBe(false);
  });

  it("does not leak on prefix lookalikes", () => {
    // "/gardenia" must not be treated as a nested "/garden" route.
    expect(isSensitivePath("/gardenia")).toBe(false);
    expect(isSensitivePath("/apiary")).toBe(false);
  });
});

describe("classifyPage", () => {
  it("ranks ad-eligible above sensitive", () => {
    expect(classifyPage("/herbs/ginger")).toBe("ad-eligible");
    expect(classifyPage("/herbalist")).toBe("sensitive");
    expect(classifyPage("/about")).toBe("neutral");
  });
});

describe("ad consent cookie", () => {
  it("round-trips a granted and a denied choice", () => {
    expect(parseAdConsent(serializeAdConsent("granted"))).toBe("granted");
    expect(parseAdConsent(serializeAdConsent("denied"))).toBe("denied");
  });

  it("fails closed on anything it does not recognise", () => {
    expect(parseAdConsent(null)).toBeNull();
    expect(parseAdConsent("")).toBeNull();
    expect(parseAdConsent("granted")).toBeNull();
    expect(parseAdConsent("v1:yes")).toBeNull();
    expect(parseAdConsent(`v${AD_CONSENT_VERSION + 1}:granted`)).toBeNull();
  });
});

describe("regionForCountry", () => {
  it("blocks the EU/EEA, the UK and Switzerland", () => {
    for (const country of ["FR", "DE", "IE", "NO", "IS", "LI", "GB", "CH"]) {
      expect(regionForCountry(country), country).toBe("eea");
    }
  });

  it("allows a positively known rest-of-world country", () => {
    expect(regionForCountry("CA")).toBe("row");
    expect(regionForCountry("US")).toBe("row");
    expect(regionForCountry("ca")).toBe("row");
  });

  it("fails closed when the country is missing or unusable", () => {
    expect(regionForCountry(null)).toBe("unknown");
    expect(regionForCountry("")).toBe("unknown");
    expect(regionForCountry("XYZ")).toBe("unknown");
    expect(regionForCountry("1")).toBe("unknown");
  });

  it("treats a failed or anonymised geo lookup as unknown, not row", () => {
    // Cloudflare emits XX when it cannot resolve a country and T1 for Tor.
    // Both previously fell through to "row", which would have served ads to a
    // visitor whose region was never established.
    expect(regionForCountry("XX")).toBe("unknown");
    expect(regionForCountry("T1")).toBe("unknown");
    expect(regionForCountry("xx")).toBe("unknown");
  });

  it("treats the EU pseudo-code as restricted rather than rest-of-world", () => {
    expect(regionForCountry("EU")).toBe("eea");
  });
});

describe("resolveAdRegion", () => {
  it("uses a single present header", () => {
    expect(resolveAdRegion("CA", null)).toBe("row");
    expect(resolveAdRegion(null, "FR")).toBe("eea");
  });

  it("fails closed when no signal is present", () => {
    expect(resolveAdRegion(null, undefined, "")).toBe("unknown");
  });

  it("accepts agreeing headers, including two restricted countries", () => {
    expect(resolveAdRegion("CA", "US")).toBe("row");
    expect(resolveAdRegion("FR", "DE")).toBe("eea");
  });

  it("refuses to pick a winner when the headers disagree", () => {
    // A forged cf-ipcountry must not upgrade a restricted visitor to row.
    expect(resolveAdRegion("FR", "US")).toBe("unknown");
    expect(resolveAdRegion("CA", "GB")).toBe("unknown");
    // Nor may an undeterminable signal be outvoted by a permissive one.
    expect(resolveAdRegion("XX", "US")).toBe("unknown");
  });
});

describe("evaluateAdGate", () => {
  it("is inert while the hard launch gate is off", () => {
    expect(ADS_LAUNCH_GATE).toBe(false);
    expect(evaluateAdGate({ ...allowedInput, gate: ADS_LAUNCH_GATE })).toEqual({
      allowed: false,
      reason: "gate-off",
    });
  });

  it("stays inert with the gate off even when identifiers are configured", () => {
    // The production-shaped case: a deploy sets both env vars and the gate is
    // still closed. Nothing about the configuration may enable ads.
    expect(
      evaluateAdGate({
        ...allowedInput,
        gate: false,
        client: "ca-pub-1901058826905247",
        slot: "9876543210",
      })
    ).toEqual({ allowed: false, reason: "gate-off" });
  });

  it("requires both a publisher client and an ad-unit slot", () => {
    expect(evaluateAdGate({ ...allowedInput, client: null })).toEqual({
      allowed: false,
      reason: "not-configured",
    });
    expect(evaluateAdGate({ ...allowedInput, slot: "" })).toEqual({
      allowed: false,
      reason: "not-configured",
    });
  });

  it("refuses any page that is not a public herb reference", () => {
    for (const pathname of [
      "/herbalist",
      "/calculator",
      "/herbs",
      "/herbs/ginger/dosage",
    ]) {
      expect(
        evaluateAdGate({ ...allowedInput, pathname, bootPathname: pathname })
      ).toEqual({ allowed: false, reason: "page-not-ad-eligible" });
    }
  });

  it("refuses a document that was not born at an ad-eligible URL", () => {
    // Client-side navigation from a health tool onto /herbs/ginger: the DOM
    // already holds tool code, so no ad script may be injected into it.
    expect(
      evaluateAdGate({
        ...allowedInput,
        pathname: "/herbs/ginger",
        bootPathname: "/herbalist",
      })
    ).toEqual({ allowed: false, reason: "document-not-ad-eligible" });

    expect(
      evaluateAdGate({ ...allowedInput, bootPathname: null })
    ).toEqual({ allowed: false, reason: "document-not-ad-eligible" });
  });

  it("requires explicit consent, never implied consent", () => {
    expect(evaluateAdGate({ ...allowedInput, consent: null })).toEqual({
      allowed: false,
      reason: "consent-missing",
    });
    expect(evaluateAdGate({ ...allowedInput, consent: "denied" })).toEqual({
      allowed: false,
      reason: "consent-denied",
    });
  });

  it("blocks restricted and unknown regions", () => {
    expect(evaluateAdGate({ ...allowedInput, region: "eea" })).toEqual({
      allowed: false,
      reason: "region-restricted",
    });
    expect(evaluateAdGate({ ...allowedInput, region: "unknown" })).toEqual({
      allowed: false,
      reason: "region-unknown",
    });
  });

  it("checks the gate before consent and region", () => {
    // A closed gate reports "gate-off", not some downstream reason: the
    // decision must be explainable without knowing the visitor.
    expect(
      evaluateAdGate({
        ...allowedInput,
        gate: false,
        consent: "denied",
        region: "eea",
        client: null,
      })
    ).toEqual({ allowed: false, reason: "gate-off" });
  });

  it("allows only the fully satisfied case", () => {
    expect(evaluateAdGate(allowedInput)).toEqual({
      allowed: true,
      reason: "allowed",
    });
  });
});
