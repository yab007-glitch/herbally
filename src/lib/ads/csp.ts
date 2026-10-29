/**
 * Content-Security-Policy helpers shared by the proxy (per-request headers)
 * and next.config.ts (static-asset headers).
 *
 * The advertising origins are the one part of the CSP that is *conditional*.
 * They may appear only when BOTH:
 *   - the hard launch gate is on, and
 *   - the request is an ad-eligible public herb document.
 *
 * Every other response — chat, interaction checker, calculator, garden,
 * profile, auth, API — must ship a policy with no ad origin at all. That is
 * defence in depth: even if a component mistakenly rendered an ad slot or a
 * stale bundle injected the provider script, the browser would refuse the
 * request.
 */

import {
  AD_PROVIDER_HOSTS,
  isAdEligiblePath,
} from "./policy";

/** Ad origins for this request, or an empty list when ads are not allowed. */
export function adsCspHosts(
  gate: boolean,
  pathname: string
): readonly string[] {
  return gate && isAdEligiblePath(pathname) ? AD_PROVIDER_HOSTS : [];
}

export function buildContentSecurityPolicy(options: {
  adHosts?: readonly string[];
  frameable?: boolean;
  dev?: boolean;
}): string {
  const ads = (options.adHosts ?? []).join(" ");
  const adsSuffix = ads ? ` ${ads}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.dev ? " 'unsafe-eval'" : ""} *.stripe.com${adsSuffix}`,
    `connect-src 'self' *.supabase.co https://ollama.com *.stripe.com${adsSuffix}`,
    // Scope img-src to the only remote image hosts actually used: Supabase
    // Storage plus the ad creative hosts when (and only when) ads are on.
    `img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com${adsSuffix}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `frame-src *.stripe.com${adsSuffix}`,
    `frame-ancestors ${options.frameable ? "*" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}
