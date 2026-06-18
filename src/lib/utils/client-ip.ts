import type { NextRequest } from "next/server";

/**
 * Extract the real client IP from request headers.
 * Handles Vercel (x-vercel-forwarded-for), Cloudflare (cf-connecting-ip),
 * and the standard x-forwarded-for (rightmost entry).
 */
export function getClientIP(request: NextRequest | Request): string {
  if (process.env.VERCEL === "1") {
    const vercelIP = request.headers.get("x-vercel-forwarded-for");
    if (vercelIP) return vercelIP.trim();
  }
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim());
    return ips[ips.length - 1] || "unknown";
  }
  return "unknown";
}
