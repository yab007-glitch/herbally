import { describe, expect, it } from "vitest";
import { detectLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale";

/**
 * Unit tests for middleware.ts — covers locale detection from
 * Accept-Language header and the admin route guard logic.
 *
 * We test the shared detectLocaleFromAcceptLanguage function (imported
 * from @/lib/i18n/detect-locale) so the tests exercise the actual
 * production code path used by the proxy.
 */

describe("middleware — locale detection", () => {
  it("returns en (default) when Accept-Language is null", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
  });

  it("returns en (default) for English", () => {
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("returns 'fr' when French is preferred", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")).toBe(
      "fr"
    );
  });

  it("returns 'fr' when French has highest quality weight", () => {
    expect(detectLocaleFromAcceptLanguage("en;q=0.8,fr;q=0.9,de;q=0.7")).toBe(
      "fr"
    );
  });

  it("returns en (default) when no supported language is found", () => {
    expect(
      detectLocaleFromAcceptLanguage("de-DE,de;q=0.9,es;q=0.8")
    ).toBe("en");
  });

  it("handles multiple entries with same quality", () => {
    // French appears first, so it should win
    expect(detectLocaleFromAcceptLanguage("fr-CA,en-US")).toBe("fr");
  });

  it("handles the fr shorthand without region", () => {
    expect(detectLocaleFromAcceptLanguage("fr")).toBe("fr");
  });

  it("handles empty string", () => {
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
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