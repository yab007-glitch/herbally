import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import {
  LINKEDIN_STATE_COOKIE,
  LINKEDIN_STATE_TTL_SECONDS,
  buildLinkedInAuthorizeUrl,
  buildLinkedInErrorRedirect,
  createOAuthState,
  getLinkedInOidcConfig,
  resolveAppOrigin,
  reviewerCookieOptions,
  sanitizeClinicalReviewNext,
} from "@/lib/auth/linkedin-oidc";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = resolveAppOrigin(request.url);
  const safeNext = sanitizeClinicalReviewNext(url.searchParams.get("next"));

  const ip = getClientIP(request);
  const rl = await rateLimit(
    rateLimitKey("linkedin-oauth-start", ip),
    20,
    60_000
  );
  if (!rl.success) {
    return NextResponse.redirect(
      buildLinkedInErrorRedirect(origin, safeNext, "rate_limited"),
      { status: 302, headers: NO_STORE }
    );
  }

  const config = getLinkedInOidcConfig(request.url);
  if (!config) {
    return NextResponse.redirect(
      buildLinkedInErrorRedirect(origin, safeNext, "not_configured"),
      { status: 302, headers: NO_STORE }
    );
  }

  const issued = createOAuthState(safeNext);
  if (!issued) {
    return NextResponse.redirect(
      buildLinkedInErrorRedirect(origin, safeNext, "not_configured"),
      { status: 302, headers: NO_STORE }
    );
  }

  const authorizeUrl = buildLinkedInAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: issued.state,
  });

  const res = NextResponse.redirect(authorizeUrl, {
    status: 302,
    headers: NO_STORE,
  });
  res.cookies.set(
    LINKEDIN_STATE_COOKIE,
    issued.cookieToken,
    reviewerCookieOptions(LINKEDIN_STATE_TTL_SECONDS)
  );
  return res;
}
