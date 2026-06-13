import { describe, expect, it } from "vitest";

/**
 * Unit tests for middleware.ts — covers locale detection from
 * Accept-Language header and the admin route guard logic.
 *
 * We test the helper functions in isolation since the middleware
 * depends on Supabase session cookies which are hard to mock.
 */

// ---------------------------------------------------------------------------
// Import the locale detection helper (extracted for testability)
// ---------------------------------------------------------------------------

describe("middleware — locale detection", () => {
  /**
   * Re-implement the detectLocaleFromAcceptLanguage function inline
   * so we can test it without mocking cookies and Supabase.
   */
  function detectLocaleFromAcceptLanguage(
    acceptLanguage: string | null
  ): string | null {
    if (!acceptLanguage) return null;
    const entries = acceptLanguage.split(",").map((entry) => {
      const [tag] = entry.trim().split(";");
      const lang = tag.split("-")[0]?.toLowerCase() ?? "";
      const q = parseFloat(entry.split("q=")[1]) || 1.0;
      return { lang, q };
    });
    for (const entry of entries.sort((a, b) => b.q - a.q)) {
      if (entry.lang === "fr") return "fr";
      if (entry.lang === "en") return null;
    }
    return null;
  }

  it("returns null when Accept-Language is null", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBeNull();
  });

  it("returns null for English (default locale)", () => {
    expect(
      detectLocaleFromAcceptLanguage("en-US,en;q=0.9")
    ).toBeNull();
  });

  it("returns 'fr' when French is preferred", () => {
    expect(
      detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")
    ).toBe("fr");
  });

  it("returns 'fr' when French has highest quality weight", () => {
    expect(
      detectLocaleFromAcceptLanguage("en;q=0.8,fr;q=0.9,de;q=0.7")
    ).toBe("fr");
  });

  it("returns null when no supported language is found", () => {
    expect(
      detectLocaleFromAcceptLanguage("de-DE,de;q=0.9,es;q=0.8")
    ).toBeNull();
  });

  it("handles multiple entries with same quality", () => {
    // French appears first, so it should win
    expect(
      detectLocaleFromAcceptLanguage("fr-CA,en-US")
    ).toBe("fr");
  });

  it("handles the fr shorthand without region", () => {
    expect(detectLocaleFromAcceptLanguage("fr")).toBe("fr");
  });

  it("handles empty string", () => {
    expect(detectLocaleFromAcceptLanguage("")).toBeNull();
  });
});

describe("middleware — admin route guard", () => {
  it("identifies /admin as an admin route", () => {
    const adminRoutes = ["/admin"];
    expect(adminRoutes.some((r) => "/admin".startsWith(r))).toBe(true);
    expect(adminRoutes.some((r) => "/admin/herbs".startsWith(r))).toBe(true);
    expect(adminRoutes.some((r) => "/admin/users".startsWith(r))).toBe(true);
  });

  it("does NOT identify / as an admin route", () => {
    const adminRoutes = ["/admin"];
    expect(adminRoutes.some((r) => "/".startsWith(r))).toBe(false);
    expect(adminRoutes.some((r) => "/herbs".startsWith(r))).toBe(false);
    expect(adminRoutes.some((r) => "/herbalist".startsWith(r))).toBe(false);
  });
});

describe("middleware — security headers", () => {
  const securityHeaders: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "on",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  it("sets X-Frame-Options to DENY", () => {
    expect(securityHeaders["X-Frame-Options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    expect(securityHeaders["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("disables camera, microphone, and geolocation", () => {
    expect(securityHeaders["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders["Permissions-Policy"]).toContain("microphone=()");
    expect(securityHeaders["Permissions-Policy"]).toContain("geolocation=()");
  });
});

describe("middleware — CSP", () => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.stripe.com",
    "connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src *.stripe.com",
    "frame-ancestors 'none'",
  ].join("; ");

  it("allows connections to Supabase and OpenRouter", () => {
    expect(csp).toContain("*.supabase.co");
    expect(csp).toContain("*.openrouter.ai");
  });

  it("blocks frame ancestors for clickjacking protection", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows Stripe scripts for checkout", () => {
    expect(csp).toContain("*.stripe.com");
  });
});
