import type { NextRequest } from "next/server";

/**
 * Extract the real client IP from request headers.
 *
 * Trust model (L4, audit 2026-06-22):
 *   - On Vercel (`VERCEL=1`), `x-vercel-forwarded-for` is set by the Vercel
 *     edge and is trustworthy — it is the source of truth.
 *   - Off-Vercel (self-hosted / Docker), `x-forwarded-for` is a client-
 *     controllable header. Only honor it when the operator has explicitly
 *     opted in via `TRUST_PROXY_HEADERS=1` (i.e. the deployment is behind a
 *     known reverse proxy that overwrites XFF). Otherwise a caller can spoof
 *     XFF to rotate their rate-limit key and bypass per-IP caps.
 *   - `cf-connecting-ip` is honored only on Vercel for the same reason
 *     (Cloudflare-fronted deployments set VERCEL=1 too); off-Vercel without
 *     the trust flag it is ignored.
 *
 * When no header is trusted, fall back to "unknown" — rate limiting then
 * buckets all unproxied local traffic together, which is safe (if coarse)
 * for self-hosted dev.
 */
export function getClientIP(request: NextRequest | Request): string {
  const onVercel = process.env.VERCEL === "1";
  const trustProxyHeaders = onVercel || process.env.TRUST_PROXY_HEADERS === "1";

  if (onVercel) {
    const vercelIP = request.headers.get("x-vercel-forwarded-for");
    if (vercelIP) return vercelIP.trim();
  }

  if (trustProxyHeaders) {
    const cfIP = request.headers.get("cf-connecting-ip");
    if (cfIP) return cfIP.trim();

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const ips = forwarded.split(",").map((s) => s.trim());
      return ips[0] || "unknown";
    }
  }

  return "unknown";
}
