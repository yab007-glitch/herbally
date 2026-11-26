import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import {
  LINKEDIN_SESSION_COOKIE,
  LINKEDIN_SESSION_TTL_SECONDS,
  LINKEDIN_STATE_COOKIE,
  clinicalReviewPathOnly,
  createReviewerSessionToken,
  exchangeLinkedInCodeForUser,
  getLinkedInOidcConfig,
  resolveAppOrigin,
  reviewerCookieOptions,
  verifyOAuthState,
} from "@/lib/auth/linkedin-oidc";

const NO_STORE = { "Cache-Control": "private, no-store" };

function redirectWithClearedState(location: string) {
  const res = NextResponse.redirect(location, {
    status: 302,
    headers: NO_STORE,
  });
  res.cookies.set(LINKEDIN_STATE_COOKIE, "", reviewerCookieOptions(0));
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = resolveAppOrigin(request.url);
  const stateCookie = request.cookies.get(LINKEDIN_STATE_COOKIE)?.value;

  const ip = getClientIP(request);
  const rl = await rateLimit(
    rateLimitKey("linkedin-oauth-callback", ip),
    20,
    60_000
  );
  if (!rl.success) {
    return redirectWithClearedState(
      `${origin}/clinical-review?authError=rate_limited`
    );
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    const code =
      providerError === "user_cancelled_login" ||
      providerError === "user_cancelled_authorize" ||
      providerError === "access_denied"
        ? "cancelled"
        : "provider_error";
    logger.warn("linkedin_oauth_provider_error", { error: providerError });
    return redirectWithClearedState(
      `${origin}/clinical-review?authError=${code}`
    );
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const verifiedState = verifyOAuthState(stateCookie, returnedState);
  if (!code || !verifiedState) {
    return redirectWithClearedState(
      `${origin}/clinical-review?authError=invalid_state`
    );
  }

  const targetNext = verifiedState.next;
  const reviewPath = clinicalReviewPathOnly(targetNext);
  const config = getLinkedInOidcConfig(request.url);
  if (!config) {
    return redirectWithClearedState(
      `${origin}${reviewPath}?authError=not_configured`
    );
  }

  try {
    const user = await exchangeLinkedInCodeForUser({ code, config });
    const sessionToken = createReviewerSessionToken(user);
    if (!sessionToken) {
      return redirectWithClearedState(
        `${origin}${reviewPath}?authError=not_configured`
      );
    }

    const res = NextResponse.redirect(`${origin}${targetNext}`, {
      status: 302,
      headers: NO_STORE,
    });
    res.cookies.set(LINKEDIN_STATE_COOKIE, "", reviewerCookieOptions(0));
    res.cookies.set(
      LINKEDIN_SESSION_COOKIE,
      sessionToken,
      reviewerCookieOptions(LINKEDIN_SESSION_TTL_SECONDS)
    );
    return res;
  } catch (err) {
    logger.warn("linkedin_oauth_exchange_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return redirectWithClearedState(
      `${origin}${reviewPath}?authError=exchange_failed`
    );
  }
}
