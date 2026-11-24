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

import { AD_PROVIDER_HOSTS, isAdEligiblePath } from "./policy";
import { supabaseApiOrigin } from "../security/csp";

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
  // A custom/self-hosted Supabase API domain is not covered by `'self'`.
  const apiOrigin = supabaseApiOrigin();
  const apiSuffix = apiOrigin ? ` ${apiOrigin}` : "";
  const directives = [
    "default-src 'self'",
    // Cloudflare Web Analytics is injected by the Cloudflare zone in front of
    // the origin. Without these two hosts every page logged a CSP violation
    // and the beacon never reported, so the analytics dashboard stayed empty.
    `script-src 'self' 'unsafe-inline'${options.dev ? " 'unsafe-eval'" : ""} blob: *.stripe.com https://static.cloudflareinsights.com${adsSuffix}`,
    `connect-src 'self'${apiSuffix} *.stripe.com https://cloudflareinsights.com${adsSuffix}`,
    // Scope img-src to the remote image hosts actually used plus the ad
    // creative hosts when (and only when) ads are on.
    `img-src 'self' data: blob: https://*.googleusercontent.com${adsSuffix}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `frame-src 'self' *.stripe.com${adsSuffix}`,
    // PDF and other blob-backed workers need an explicit worker-src; the
    // browser does not fall back to script-src for them.
    "worker-src 'self' blob:",
    `frame-ancestors ${options.frameable ? "*" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}
