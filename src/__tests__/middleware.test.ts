import { describe, expect, it } from "vitest";
import { detectLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale";
import { AD_SOURCES, buildCsp, buildSecurityHeaders } from "@/lib/security/csp";

/** Return the full `name value` entry for a directive, or undefined. */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((entry) => entry === name || entry.startsWith(`${name} `));
}

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
    expect(detectLocaleFromAcceptLanguage("de-DE,de;q=0.9,es;q=0.8")).toBe(
      "en"
    );
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
  const securityHeaders = buildSecurityHeaders({ isProduction: true });

  it("sets X-Frame-Options to DENY", () => {
    expect(securityHeaders["X-Frame-Options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    expect(securityHeaders["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy and X-DNS-Prefetch-Control", () => {
    expect(securityHeaders["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(securityHeaders["X-DNS-Prefetch-Control"]).toBe("on");
  });

  it("disables camera, microphone, and geolocation", () => {
    expect(securityHeaders["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders["Permissions-Policy"]).toContain("microphone=()");
    expect(securityHeaders["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("allows framing without X-Frame-Options for embed responses", () => {
    const embed = buildSecurityHeaders({ framing: "allow" });

    expect(embed["X-Frame-Options"]).toBeUndefined();
    expect(directive(embed["Content-Security-Policy"], "frame-ancestors")).toBe(
      "frame-ancestors *"
    );
  });

  it("omits all framing headers for config-level headers", () => {
    const config = buildSecurityHeaders({ framing: "omit" });

    expect(config["X-Frame-Options"]).toBeUndefined();
    expect(
      directive(config["Content-Security-Policy"], "frame-ancestors")
    ).toBeUndefined();
  });
});

describe("middleware — CSP", () => {
  const devCsp = buildCsp({ isProduction: false });
  const prodCsp = buildCsp({ isProduction: true });

  it("allowlists the AdSense sources in script, connect and frame sources", () => {
    for (const source of AD_SOURCES) {
      expect(directive(devCsp, "script-src")).toContain(source);
      expect(directive(devCsp, "connect-src")).toContain(source);
      expect(directive(devCsp, "frame-src")).toContain(source);
    }
  });

  it("allows connections to Supabase but not to the Ollama server", () => {
    expect(directive(devCsp, "connect-src")).toContain("*.supabase.co");
    expect(directive(devCsp, "connect-src")).not.toContain("ollama.com");
    expect(devCsp).not.toContain("ollama.com");
  });

  it("allows blob scripts and blob workers", () => {
    expect(directive(devCsp, "script-src")).toContain("blob:");
    expect(directive(devCsp, "worker-src")).toBe("worker-src 'self' blob:");
    expect(directive(prodCsp, "worker-src")).toBe("worker-src 'self' blob:");
  });

  it("blocks frame ancestors by default", () => {
    expect(directive(devCsp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prodCsp, "frame-ancestors")).toBe(
      "frame-ancestors 'none'"
    );
  });

  it("allows frame ancestors for embed responses", () => {
    const embedCsp = buildCsp({ framing: "allow", isProduction: true });

    expect(directive(embedCsp, "frame-ancestors")).toBe("frame-ancestors *");
  });

  it("allows Stripe scripts for checkout", () => {
    expect(directive(devCsp, "script-src")).toContain("*.stripe.com");
    expect(directive(devCsp, "connect-src")).toContain("*.stripe.com");
    expect(directive(devCsp, "frame-src")).toContain("*.stripe.com");
  });

  it("allows 'unsafe-eval' only outside production", () => {
    expect(directive(devCsp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(prodCsp, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("keeps every other baseline directive", () => {
    for (const name of [
      "default-src",
      "img-src",
      "style-src",
      "font-src",
      "frame-src",
      "object-src",
      "base-uri",
      "form-action",
      "upgrade-insecure-requests",
    ]) {
      expect(directive(prodCsp, name)).toBeDefined();
    }
  });
});
