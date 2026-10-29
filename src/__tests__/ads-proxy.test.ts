import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const AD_ORIGINS = [/googlesyndication/, /doubleclick/, /adservice/, /google\.com/];

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
});
