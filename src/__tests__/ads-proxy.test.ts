import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const AD_ORIGINS = [
  /googlesyndication/,
  /doubleclick/,
  /adservice/,
  /google\.com/,
];

function cspOf(response: Response): string {
  return response.headers.get("content-security-policy") ?? "";
}

async function fetchPath(path: string, headers: Record<string, string> = {}) {
  return proxy(
    new NextRequest(new URL(path, "https://herbally.app"), { headers })
  );
}

function expectNoAdOrigins(csp: string, path: string) {
  for (const pattern of AD_ORIGINS) {
    expect(csp, `${path} must not grant ${pattern}`).not.toMatch(pattern);
  }
}

/**
 * Production shape: the launch gate is closed, so NOTHING the proxy emits may
 * mention an advertising origin — including the one page class that will
 * eventually carry ads. This is the header-level half of the "configured
 * identifiers with the gate off" guarantee.
 */
describe("proxy — security headers with the launch gate off", () => {
  it.each([
    "/herbs/ginger",
    "/fr/herbs/ginger",
    "/en/herbs/ginger",
    "/herbalist",
    "/calculator",
    "/interactions/ginger",
    "/medications",
    "/fr/medications/warfarin",
    "/surgery-planner",
    "/fr/surgery-planner",
    "/npn-checker",
    "/fr/npn-checker",
    "/widgets",
    "/symptoms",
    "/garden",
    "/admin/herbs",
    "/embed/checker",
    "/api/ads/region",
    "/",
  ])("emits a CSP without ad origins for %s", async (path) => {
    const response = await fetchPath(path);
    const csp = cspOf(response);

    expect(csp, path).not.toBe("");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expectNoAdOrigins(csp, path);
  });

  it.each([
    "/",
    "/herbs/ginger",
    "/fr/herbs/ginger",
    "/about",
    "/guides",
    "/ads.txt",
    "/npn-checker",
    "/widgets",
  ])("does not emit Set-Cookie on anonymous GET to %s", async (path) => {
    const response = await fetchPath(path);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("marks Accept-Language French redirects as private, no-store", async () => {
    const response = await fetchPath("/herbs/ginger", {
      "accept-language": "fr-CA,fr;q=0.9,en;q=0.8",
    });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toContain("/fr/herbs/ginger");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps X-Frame-Options DENY on ordinary pages", async () => {
    const response = await fetchPath("/herbs/ginger");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(cspOf(response)).toContain("frame-ancestors 'none'");
  });

  it("drops framing protection only for /embed routes", async () => {
    const response = await fetchPath("/embed/checker");
    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(cspOf(response)).toContain("frame-ancestors *");
  });

  it("keeps the English rewrite to the internal /en segment", async () => {
    const response = await fetchPath("/herbs/ginger");
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/en/herbs/ginger"
    );
  });

  it("still emits the baseline hardening headers", async () => {
    const response = await fetchPath("/herbalist");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("permissions-policy")).toContain(
      "microphone=()"
    );
  });

  it.each([
    "/api/health",
    "/api/ads/region",
    "/admin",
    "/fr/admin",
    "/admin/herbs",
  ])("sets X-Robots-Tag noindex, nofollow on %s", async (path) => {
    const response = await fetchPath(path);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each(["/", "/herbs/turmeric", "/fr/herbs/turmeric", "/widgets"])(
    "does not set X-Robots-Tag noindex on public route %s",
    async (path) => {
      const response = await fetchPath(path);
      expect(response.headers.get("x-robots-tag")).toBeNull();
    }
  );
});
