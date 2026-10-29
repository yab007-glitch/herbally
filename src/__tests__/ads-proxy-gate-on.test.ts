import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

vi.mock("@/lib/ads/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ads/policy")>();
  return { ...actual, ADS_LAUNCH_GATE: true };
});

const AD_ORIGINS = [/googlesyndication/, /doubleclick/, /adservice/, /google\.com/];

function cspOf(response: Response): string {
  return response.headers.get("content-security-policy") ?? "";
}

async function fetchPath(path: string, headers: Record<string, string> = {}) {
  return proxy(
    new NextRequest(new URL(path, "https://herbally.app"), { headers })
  );
}

/**
 * The "gate on" contract at the header layer: the provider origins appear on
 * exactly one page class and nowhere else. If this file ever needs loosening,
 * the CSP defence-in-depth story has changed and the checklist needs review.
 */
describe("proxy — CSP with the launch gate on", () => {
  it.each(["/herbs/ginger", "/fr/herbs/ginger"])(
    "grants the provider origins to %s",
    async (path) => {
      const csp = cspOf(await fetchPath(path));
      expect(csp).toContain("https://pagead2.googlesyndication.com");
      expect(csp).toContain("https://*.doubleclick.net");
    }
  );

  it("grants them on the internal /en pass as well", async () => {
    const csp = cspOf(
      await fetchPath("/en/herbs/ginger", { "x-herbally-internal-locale": "1" })
    );
    expect(csp).toContain("https://pagead2.googlesyndication.com");
  });

  it.each([
    "/herbalist",
    "/calculator",
    "/interactions/ginger",
    "/symptoms",
    "/garden",
    "/profile",
    "/admin/herbs",
    "/embed/checker",
    "/api/ads/region",
    "/api/chat",
    "/herbs",
    "/privacy",
    "/",
  ])("keeps %s free of every ad origin", async (path) => {
    const csp = cspOf(await fetchPath(path));
    for (const pattern of AD_ORIGINS) {
      expect(csp, `${path} must not grant ${pattern}`).not.toMatch(pattern);
    }
  });

  it("keeps the ad origins out of a rate-limited API response", async () => {
    // Exhaust the chat burst limit (20/minute) and confirm the 429 the proxy
    // renders itself carries the same strict policy.
    let response: Response | null = null;
    for (let i = 0; i < 25; i += 1) {
      response = await fetchPath("/api/chat", { "x-vercel-forwarded-for": "9.9.9.9" });
      if (response.status === 429) break;
    }
    expect(response?.status).toBe(429);
    for (const pattern of AD_ORIGINS) {
      expect(cspOf(response as Response)).not.toMatch(pattern);
    }
  });
});
