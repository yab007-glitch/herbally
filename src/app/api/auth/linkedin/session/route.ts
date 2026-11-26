import { NextResponse, type NextRequest } from "next/server";
import {
  getLinkedInReviewerSession,
  isLinkedInOidcConfigured,
} from "@/lib/auth/linkedin-oidc";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Lightweight HTTP 200 status endpoint read on demand by the inline herb edit
 * drawer so SSG/ISR herb pages stay cacheable and signed-out visitors never
 * trigger browser 401 console errors.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = await rateLimit(
    rateLimitKey("linkedin-session-get", ip),
    60,
    60_000
  );
  if (!rl.success) {
    return NextResponse.json(
      {
        configured: isLinkedInOidcConfigured(request.url),
        authenticated: false,
        reviewer: null,
        error: "Too many requests.",
      },
      { status: 429, headers: NO_STORE }
    );
  }

  const [session, configured] = await Promise.all([
    getLinkedInReviewerSession(),
    Promise.resolve(isLinkedInOidcConfigured(request.url)),
  ]);

  return NextResponse.json(
    {
      configured,
      authenticated: Boolean(session),
      reviewer: session
        ? {
            name: session.name,
            email: session.email,
            emailVerified: session.emailVerified,
          }
        : null,
    },
    { status: 200, headers: NO_STORE }
  );
}
