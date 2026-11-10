/**
 * Single source of truth for the Content-Security-Policy and baseline
 * security headers.
 *
 * Two call sites consume this module:
 * - `next.config.ts` applies headers to every route (including static
 *   assets the proxy matcher skips). It uses `framing: "omit"` because
 *   config-level headers are applied after the proxy and would re-block
 *   `/embed/*` if they carried framing directives.
 * - `src/proxy.ts` applies headers per request and owns the framing split:
 *   `/embed/*` is frameable, every other route is not.
 */

/**
 * Google AdSense domains are allowlisted only because the public herb pages
 * may carry a clearly labelled, non-personalised ad unit. Private tools
 * (chat, checker, calculator) never render an ad slot.
 */
export const AD_SOURCES = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://adservice.google.com",
  "https://www.google.com",
] as const;

/** How the policy treats being framed by another origin. */
export type FramingMode =
  /** Clickjacking protection: `frame-ancestors 'none'`. */
  | "deny"
  /** Partner embeds: `frame-ancestors *`. */
  | "allow"
  /**
   * No framing directive at all. Used by `next.config.ts`, whose headers
   * are applied after the proxy.
   */
  | "omit";

export interface CspOptions {
  /** Defaults to `"deny"`. */
  framing?: FramingMode;
  /**
   * Whether to emit the production policy. Defaults to
   * `process.env.NODE_ENV === "production"`; overridable so tests can assert
   * both branches without mutating the environment.
   */
  isProduction?: boolean;
}

export function buildCsp(options: CspOptions = {}): string {
  const { framing = "deny" } = options;
  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  const ads = AD_SOURCES.join(" ");

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    // React uses eval for enhanced debugging information in development.
    // Neither React nor Next.js use eval in production by default.
    ...(isProduction ? [] : ["'unsafe-eval'"]),
    "blob:",
    "*.stripe.com",
    ads,
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // The Ollama Cloud call is server-side only; the browser never talks to it.
    `connect-src 'self' *.supabase.co *.stripe.com ${ads}`,
    // L16 (audit 2026-06-22): scope img-src to the only remote image host we
    // actually use (Supabase Storage), matching next.config.ts remotePatterns.
    // A bare `https:` allowed any origin to be a CSP-permitted image source.
    "img-src 'self' data: blob: https://*.supabase.co https://*.googlesyndication.com https://*.doubleclick.net https://*.googleusercontent.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `frame-src *.stripe.com ${ads}`,
    "worker-src 'self' blob:",
    ...(framing === "omit"
      ? []
      : [`frame-ancestors ${framing === "allow" ? "*" : "'none'"}`]),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/**
 * Baseline response headers. `X-Frame-Options` is emitted only for the
 * default (`"deny"`) mode; both `"allow"` and `"omit"` leave framing to the
 * CSP (or to the absence of any framing directive).
 */
export function buildSecurityHeaders(
  options: CspOptions = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(options),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "on",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if ((options.framing ?? "deny") === "deny") {
    headers["X-Frame-Options"] = "DENY";
  }

  return headers;
}
