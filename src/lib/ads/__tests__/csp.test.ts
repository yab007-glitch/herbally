import { describe, expect, it } from "vitest";
import {
  adsCspHosts,
  buildContentSecurityPolicy,
} from "@/lib/ads/csp";
import { AD_PROVIDER_HOSTS } from "@/lib/ads/policy";

const AD_HOST_PATTERNS = [/googlesyndication/, /doubleclick/, /adservice/, /google\.com/];

function expectNoAdHosts(policy: string) {
  for (const pattern of AD_HOST_PATTERNS) {
    expect(policy, `unexpected ad origin matching ${pattern}`).not.toMatch(
      pattern
    );
  }
}

describe("adsCspHosts", () => {
  it("grants nothing while the gate is off, on every path", () => {
    for (const path of ["/herbs/ginger", "/fr/herbs/ginger", "/", "/herbalist"]) {
      expect(adsCspHosts(false, path), path).toEqual([]);
    }
  });

  it("grants the provider hosts to an ad-eligible document when the gate is on", () => {
    expect(adsCspHosts(true, "/herbs/ginger")).toEqual(AD_PROVIDER_HOSTS);
    expect(adsCspHosts(true, "/fr/herbs/ginger")).toEqual(AD_PROVIDER_HOSTS);
  });

  it("never grants them to a sensitive or neutral document", () => {
    for (const path of [
      "/herbalist",
      "/calculator",
      "/interactions/ginger",
      "/symptoms",
      "/garden",
      "/profile",
      "/admin/herbs",
      "/embed/checker",
      "/api/ads/region",
      "/herbs",
      "/privacy",
    ]) {
      expect(adsCspHosts(true, path), path).toEqual([]);
    }
  });
});

describe("buildContentSecurityPolicy", () => {
  it("ships no advertising origin by default", () => {
    const policy = buildContentSecurityPolicy({});
    expectNoAdHosts(policy);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("adds the ad origins to every directive that needs them when granted", () => {
    const policy = buildContentSecurityPolicy({
      adHosts: AD_PROVIDER_HOSTS,
    });
    for (const directive of ["script-src", "connect-src", "img-src", "frame-src"]) {
      const value = policy
        .split("; ")
        .find((part) => part.startsWith(`${directive} `));
      expect(value, directive).toContain("pagead2.googlesyndication.com");
    }
  });

  it("keeps dev-only eval while never widening the ad surface", () => {
    const dev = buildContentSecurityPolicy({ dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expectNoAdHosts(dev);
  });

  it("only relaxes frame-ancestors for embed routes", () => {
    expect(buildContentSecurityPolicy({ frameable: true })).toContain(
      "frame-ancestors *"
    );
    expect(buildContentSecurityPolicy({ frameable: true })).not.toContain(
      "frame-ancestors 'none'"
    );
  });

  it("never grants an ad origin to the embed policy", () => {
    expectNoAdHosts(
      buildContentSecurityPolicy({ frameable: true, adHosts: adsCspHosts(true, "/embed/checker") })
    );
  });
});
