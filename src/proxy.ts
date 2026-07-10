import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import {
  isLocalePrefixed,
  getLocaleFromPathname,
  stripLocalePrefix,
  addLocalePrefix,
} from "@/lib/i18n/routing";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { detectLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale";

function buildCSP(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' *.stripe.com",
    "connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com",
    // L16 (audit 2026-06-22): scope img-src to the only remote image host we
    // actually use (Supabase Storage), matching next.config.ts remotePatterns.
    // A bare `https:` allowed any origin to be a CSP-permitted image source.
    "img-src 'self' data: blob: https://*.supabase.co",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src *.stripe.com",
    "frame-ancestors 'none'",
  ];
  if (process.env.NODE_ENV !== "production") {
    directives[1] =
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.stripe.com";
  }
  return directives.join("; ");
}

const baseSecurityHeaders: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": buildCSP(),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(baseSecurityHeaders)) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

/**
 * Paths that should NOT be locale-prefixed or redirected.
 */
const LOCALE_EXCLUDED_PATHS = [
  "/api",
  "/auth",
  "/_next",
  "/static",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest",
  "/opengraph-image",
  "/twitter-image",
  "/icon",
  "/apple-icon",
];

function shouldSkipLocaleRouting(pathname: string): boolean {
  return LOCALE_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Locale routing: the URL is the single source of truth.
 *   - /fr/*  → rewritten to the internal path with x-locale: "fr"
 *   - /*     → served as English, redirecting to /fr/* only for first-time
 *              visitors whose saved preference (cookie) or Accept-Language
 *              indicates French.
 *
 * The `herbally-locale` cookie is a *first-visit hint only*; rendering is
 * always driven by the URL via the x-locale header, so the cookie and the URL
 * can never drift and cause partial translations.
 *
 * Next.js 16 renames "middleware" to "proxy" (file convention + export), with
 * functionality unchanged.
 */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── API rate limiting (before session refresh) ────────────────────
  // Rate-limit /api/chat BEFORE the Supabase session refresh so an
  // unauthenticated flood is rejected without doing DB/session work first.
  if (pathname.startsWith("/api/chat")) {
    const ip = getClientIP(request);
    // Two-tier limit: a short per-minute burst cap (20/min) and a daily
    // cap (200/day) so a single IP cannot run up free-tier AI costs all
    // day (20/min alone allows ~28,800/day). Distinct keys per window.
    const perMinute = await rateLimit(`${ip}:chat:minute`, 20, 60_000);
    if (!perMinute.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
          }
        )
      );
    }
    const perDay = await rateLimit(`${ip}:chat:day`, 200, 86_400_000);
    if (!perDay.success) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: "Daily message limit reached. Please come back tomorrow.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": "3600",
              "X-RateLimit-Remaining": "0",
            },
          }
        )
      );
    }
  }

  // ── Supabase auth code redirect ────────────────────────────────────
  // When the Supabase dashboard Site URL is misconfigured (e.g., set to
  // localhost:3000 instead of herbally.app), password-reset and email-confirmation
  // links arrive at the wrong URL with ?code=... This catches the code on ANY
  // page and redirects to /auth/callback which exchanges it for a session.
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode && !pathname.startsWith("/auth/callback")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.searchParams.set("next", "/reset-password");
    return applySecurityHeaders(NextResponse.redirect(callbackUrl));
  }

  // ── Locale routing ─────────────────────────────────────────────────
  if (!shouldSkipLocaleRouting(pathname)) {
    const cookieLocale = request.cookies.get("herbally-locale")?.value as
      Locale | undefined;
    const acceptLangLocale = detectLocaleFromAcceptLanguage(
      request.headers.get("accept-language")
    );

    if (isLocalePrefixed(pathname)) {
      // /fr/* — rewrite to internal path and pass locale header through
      const locale = getLocaleFromPathname(pathname);
      const internalPath = stripLocalePrefix(pathname);
      const url = request.nextUrl.clone();
      url.pathname = internalPath;
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-locale", locale);
      requestHeaders.set("x-pathname", internalPath);
      const rewrite = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
      // Only seed the cookie for first-time visitors so /fr links don't
      // override a previously saved English preference.
      if (!cookieLocale) {
        rewrite.cookies.set("herbally-locale", locale, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return applySecurityHeaders(rewrite);
    }

    // No locale prefix — redirect to /fr/* only if the user prefers French
    // (first visit via cookie or Accept-Language).
    const preferredLocale = cookieLocale ?? acceptLangLocale;
    if (preferredLocale === "fr") {
      const redirectPath = addLocalePrefix(
        pathname === "/" ? "/" : pathname,
        "fr"
      );
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      const redirect = NextResponse.redirect(url);
      return applySecurityHeaders(redirect);
    }
  }

  // Default (English) path — set locale header for downstream consumption
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", DEFAULT_LOCALE);
  requestHeaders.set("x-pathname", pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Locale cookie for first-time visitors (English default)
  const existingLocale = request.cookies.get("herbally-locale")?.value;
  if (!existingLocale) {
    const detected = detectLocaleFromAcceptLanguage(
      request.headers.get("accept-language")
    );
    response.cookies.set("herbally-locale", detected, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Supabase session refresh
  const { supabaseResponse } = await updateSession(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Admin authorization is handled by src/app/admin/layout.tsx, which
  // verifies the role against the database profiles table (not just JWT
  // metadata, which can be tampered with). No middleware-level check here
  // to avoid relying on client-controllable JWT claims.

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
