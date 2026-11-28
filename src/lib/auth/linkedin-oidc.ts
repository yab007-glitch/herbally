import crypto from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";
import { siteUrl } from "@/lib/seo/site-url";
import { safeNextPath } from "@/lib/utils/safe-redirect";

export const LINKEDIN_STATE_COOKIE = "herbally-li-oauth-state";
export const LINKEDIN_SESSION_COOKIE = "herbally-linkedin-reviewer";

export const LINKEDIN_STATE_TTL_SECONDS = 600;
export const LINKEDIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface LinkedInReviewerSession {
  sub: string;
  name: string;
  email: string;
  emailVerified: boolean;
  picture: string | null;
  iat: number;
  exp: number;
}

export interface LinkedInOAuthStatePayload {
  nonce: string;
  next: string;
  iat: number;
  exp: number;
}

export interface LinkedInOidcConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

const userInfoSchema = z.object({
  sub: z.string().trim().min(1).max(200),
  name: z.string().trim().max(200).optional(),
  given_name: z.string().trim().max(100).optional(),
  family_name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(320),
  email_verified: z.boolean().optional(),
  picture: z.string().trim().max(1000).optional(),
});

function isUsableCredential(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.length > 0 && !/^(placeholder|your-|xxx|changeme)/i.test(trimmed)
  );
}

export function resolveAppOrigin(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && !/your-domain\.com/i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return siteUrl().replace(/\/+$/, "");
  }
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin.replace(/\/+$/, "");
    } catch {
      // Fall through to siteUrl()
    }
  }
  return siteUrl().replace(/\/+$/, "");
}

export function getLinkedInOidcConfig(
  requestUrl?: string
): LinkedInOidcConfig | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!isUsableCredential(clientId) || !isUsableCredential(clientSecret)) {
    return null;
  }
  const explicitRedirect = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const redirectUri = explicitRedirect
    ? explicitRedirect
    : `${resolveAppOrigin(requestUrl)}/api/auth/linkedin/callback`;
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    redirectUri,
  };
}

export function isLinkedInOidcConfigured(requestUrl?: string): boolean {
  return getLinkedInOidcConfig(requestUrl) !== null;
}

const HERB_RETURN_PATH_RE = /^(\/fr)?\/herbs\/([a-z0-9-]+)$/i;

/**
 * Only permit in-app redirects back to `/clinical-review`, `/fr/clinical-review`,
 * `/herbs/<slug>`, or `/fr/herbs/<slug>` while preserving safe query parameters.
 */
export function sanitizeClinicalReviewNext(
  raw: string | null | undefined
): string {
  const safe = safeNextPath(raw);
  try {
    const parsed = new URL(safe, "https://herbally.local");
    const herbMatch = HERB_RETURN_PATH_RE.exec(parsed.pathname);
    if (herbMatch) {
      const prefix = herbMatch[1] ? "/fr" : "";
      const cleanHerbPath = `${prefix}/herbs/${herbMatch[2].toLowerCase()}`;
      const cleanParams = new URLSearchParams();
      cleanParams.set("suggestEdit", "1");
      const fieldVal = parsed.searchParams.get("field");
      if (
        fieldVal &&
        fieldVal.trim().length > 0 &&
        fieldVal.trim().length <= 80
      ) {
        cleanParams.set("field", fieldVal.trim());
      }
      return `${cleanHerbPath}?${cleanParams.toString()}`;
    }

    if (
      parsed.pathname !== "/clinical-review" &&
      parsed.pathname !== "/fr/clinical-review"
    ) {
      return "/clinical-review";
    }
    const cleanParams = new URLSearchParams();
    for (const key of [
      "targetType",
      "slug",
      "drug",
      "field",
      "intent",
    ] as const) {
      const val = parsed.searchParams.get(key);
      if (val && val.trim().length > 0 && val.trim().length <= 120) {
        cleanParams.set(key, val.trim());
      }
    }
    const qs = cleanParams.toString();
    return qs ? `${parsed.pathname}?${qs}` : parsed.pathname;
  } catch {
    return "/clinical-review";
  }
}

export function clinicalReviewPathOnly(nextPath: string): string {
  const sanitized = sanitizeClinicalReviewNext(nextPath);
  try {
    return new URL(sanitized, "https://herbally.local").pathname;
  } catch {
    return "/clinical-review";
  }
}

export function buildLinkedInErrorRedirect(
  origin: string,
  nextPath: string,
  errorCode: string
): string {
  const basePath = clinicalReviewPathOnly(nextPath);
  const params = new URLSearchParams();
  if (HERB_RETURN_PATH_RE.test(basePath)) {
    params.set("suggestEdit", "1");
  }
  params.set("authError", errorCode);
  return `${origin}${basePath}?${params.toString()}`;
}

export function extractNextFromStateCookie(
  cookieToken: string | null | undefined
): string {
  const payload = verifySignedToken<LinkedInOAuthStatePayload>(cookieToken);
  if (!payload || typeof payload.next !== "string") {
    return "/clinical-review";
  }
  return sanitizeClinicalReviewNext(payload.next);
}

function getSigningKey(): Buffer | null {
  const dedicated = process.env.LINKEDIN_SESSION_SECRET?.trim();
  if (isUsableCredential(dedicated) && dedicated.length >= 16) {
    return crypto.createHash("sha256").update(dedicated, "utf8").digest();
  }
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!isUsableCredential(clientSecret)) {
    return null;
  }
  return crypto
    .createHmac("sha256", clientSecret)
    .update("herbally:linkedin-reviewer-session:v1", "utf8")
    .digest();
}

function signPayload(payload: object): string | null {
  const key = getSigningKey();
  if (!key) return null;
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", key)
    .update(encoded, "utf8")
    .digest("base64url");
  return `v1.${encoded}.${sig}`;
}

function verifySignedToken<T extends { exp?: unknown }>(
  token: string | null | undefined
): T | null {
  if (!token || typeof token !== "string") return null;
  const key = getSigningKey();
  if (!key) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(encoded, "utf8")
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as T;
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= nowSec
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createOAuthState(
  nextPath: string
): { state: string; cookieToken: string } | null {
  const nowSec = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload: LinkedInOAuthStatePayload = {
    nonce,
    next: sanitizeClinicalReviewNext(nextPath),
    iat: nowSec,
    exp: nowSec + LINKEDIN_STATE_TTL_SECONDS,
  };
  const cookieToken = signPayload(payload);
  if (!cookieToken) return null;
  return { state: nonce, cookieToken };
}

export function verifyOAuthState(
  cookieToken: string | null | undefined,
  returnedState: string | null | undefined
): LinkedInOAuthStatePayload | null {
  if (!returnedState || typeof returnedState !== "string") return null;
  const payload = verifySignedToken<LinkedInOAuthStatePayload>(cookieToken);
  if (!payload || typeof payload.nonce !== "string") return null;

  const a = Buffer.from(payload.nonce, "utf8");
  const b = Buffer.from(returnedState, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return {
    ...payload,
    next: sanitizeClinicalReviewNext(payload.next),
  };
}

export function createReviewerSessionToken(profile: {
  sub: string;
  name: string;
  email: string;
  emailVerified: boolean;
  picture?: string | null;
}): string | null {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: LinkedInReviewerSession = {
    sub: profile.sub,
    name: profile.name,
    email: profile.email,
    emailVerified: Boolean(profile.emailVerified),
    picture:
      profile.picture && profile.picture.startsWith("https://")
        ? profile.picture
        : null,
    iat: nowSec,
    exp: nowSec + LINKEDIN_SESSION_TTL_SECONDS,
  };
  return signPayload(payload);
}

export function verifyReviewerSessionToken(
  token: string | null | undefined
): LinkedInReviewerSession | null {
  const parsed = verifySignedToken<LinkedInReviewerSession>(token);
  if (
    !parsed ||
    typeof parsed.sub !== "string" ||
    !parsed.sub.trim() ||
    typeof parsed.email !== "string" ||
    !parsed.email.includes("@") ||
    typeof parsed.name !== "string" ||
    !parsed.name.trim()
  ) {
    return null;
  }
  return {
    ...parsed,
    emailVerified: Boolean(parsed.emailVerified),
    picture:
      typeof parsed.picture === "string" &&
      parsed.picture.startsWith("https://")
        ? parsed.picture
        : null,
  };
}

export async function getLinkedInReviewerSession(): Promise<LinkedInReviewerSession | null> {
  try {
    const store = await cookies();
    const raw = store.get(LINKEDIN_SESSION_COOKIE)?.value;
    return verifyReviewerSessionToken(raw);
  } catch {
    return null;
  }
}

export function reviewerCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function buildLinkedInAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid profile email");
  return url.toString();
}

export async function exchangeLinkedInCodeForUser({
  code,
  config,
}: {
  code: string;
  config: LinkedInOidcConfig;
}): Promise<{
  sub: string;
  name: string;
  email: string;
  emailVerified: boolean;
  picture: string | null;
}> {
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const tokenRes = await boundedFetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    }
  );
  if (!tokenRes.ok) {
    throw new Error(`linkedin_token_http_${tokenRes.status}`);
  }
  const tokenJson = tokenResponseSchema.parse(await tokenRes.json());

  const userRes = await boundedFetch("https://api.linkedin.com/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/json",
    },
  });
  if (!userRes.ok) {
    throw new Error(`linkedin_userinfo_http_${userRes.status}`);
  }
  const userInfo = userInfoSchema.parse(await userRes.json());
  const composedName = [userInfo.given_name, userInfo.family_name]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
  const displayName =
    (userInfo.name && userInfo.name.trim()) ||
    composedName ||
    userInfo.email.split("@")[0];

  return {
    sub: userInfo.sub,
    name: displayName,
    email: userInfo.email,
    emailVerified: Boolean(userInfo.email_verified),
    picture:
      userInfo.picture && userInfo.picture.startsWith("https://")
        ? userInfo.picture
        : null,
  };
}
