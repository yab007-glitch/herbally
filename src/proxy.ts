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
    "connect-src 'self' *.supabase.co https://ollama.com *.stripe.com",
    // L16 (audit 2026-06-22): scope img-src to the only remote image host we
    // actually use (Supabase Storage), matching next.config.ts remotePatterns.
    // A bare `https:` allowed any origin to be a CSP-permitted image source.
    "img-src 'self' data: blob: https://*.supabase.co",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src *.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
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

function applySecurityHeaders(
  response: NextResponse,
  opts?: { frameable?: boolean }
): NextResponse {
  for (const [key, value] of Object.entries(baseSecurityHeaders)) {
    // /embed/* tools are designed to run inside third-party iframes: allow
    // framing and drop X-Frame-Options there. The embeds contain no auth or
    // state-changing actions (search inputs + outbound links only), so the
    // clickjacking exposure is minimal. Everything else keeps DENY.
    // NOTE: next.config.ts headers() also sets X-Frame-Options: DENY, and
    // skipping .set() here does NOT remove it — delete explicitly.
    if (key === "X-Frame-Options" && opts?.frameable) {
      response.headers.delete("X-Frame-Options");
      continue;
    }
    if (key === "Content-Security-Policy" && opts?.frameable) {
      response.headers.set(
        key,
        value.replace("frame-ancestors 'none'", "frame-ancestors *")
      );
      continue;
    }
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
 *
 * Public scheme (unchanged): English is unprefixed, French is under /fr.
 * Internally every page lives under `app/[locale]`, so the proxy maps the
 * public path onto that segment:
 *
 *   /herbs/ginger  → rewrite /en/herbs/ginger (browser keeps the bare URL)
 *   /fr/herbes     → passes through unchanged (already carries the segment)
 *   /en/herbs      → 308 → /herbs (one canonical English URL, never served)
 *   /*             → redirect to /fr/* only for first-time visitors whose
 *                    saved preference (cookie) or Accept-Language is French.
 *
 * The internal `/en` prefix must stay invisible: it is a rewrite target only.
 * Rewriting (rather than redirecting) is what keeps the canonical URL scheme
 * stable, and keeping `/fr` on the public path is what lets the route segment
 * be read as a root param instead of a request header.
 *
 * The `herbally-locale` cookie is a *first-visit hint only*; rendering is
 * always driven by the URL, so the cookie and the URL can never drift and
 * cause partial translations.
 *
 * Next.js 16 renames "middleware" to "proxy" (file convention + export), with
 * functionality unchanged.
 */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Embeddable tools (/embed/*) must be frameable by third-party sites.
  // Compare against the public path: strip the visible /fr segment, and also
  // the internal /en prefix used by the English rewrite. stripLocalePrefix()
  // only knows about /fr (English is unprefixed publicly), so without the
  // explicit /en case the rewritten /en/embed/* request lost its framing
  // exemption and came back with X-Frame-Options: DENY while /fr/embed/* did
  // not — the two locales disagreed on frameability.
  const publicPath =
    pathname === "/en"
      ? "/"
      : pathname.startsWith("/en/")
        ? pathname.slice(3)
        : stripLocalePrefix(pathname);
  const frameable = publicPath === "/embed" || publicPath.startsWith("/embed/");
  const frameOpts = frameable ? { frameable: true } : undefined;

  // Internal pass guard. Next re-enters the proxy with the rewritten path
  // (`/en/...`), and without this marker the "public /en/* redirects" rule
  // below would turn every English rewrite into a 308 back to the unprefixed
  // URL — an infinite redirect loop. The header is set only on rewrites and
  // is internal to the request.
  if (request.headers.get("x-herbally-internal-locale") === "1") {
    const internalLocale: Locale =
      pathname === "/en" || pathname.startsWith("/en/")
        ? DEFAULT_LOCALE
        : getLocaleFromPathname(pathname);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", internalLocale);
    requestHeaders.set("x-pathname", stripLocalePrefix(pathname));
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      frameOpts
    );
  }

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

    // /en and /en/* are an internal implementation detail. Redirect to the
    // canonical unprefixed URL with 308 so crawlers and clients do not index
    // or cache a duplicate English path. This runs before the first-visit
    // French redirect: /en/* is never a French destination.
    if (pathname === "/en" || pathname.startsWith("/en/")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
      return applySecurityHeaders(NextResponse.redirect(url, 308));
    }

    if (isLocalePrefixed(pathname)) {
      // /fr/* — already carries the [locale] segment; pass it through
      // unchanged. Re-prefixing here is what would create /fr/fr/*.
      const locale = getLocaleFromPathname(pathname);
      const internalPath = stripLocalePrefix(pathname);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-locale", locale);
      requestHeaders.set("x-pathname", internalPath);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });

      // Only seed the cookie for first-time visitors so /fr links don't
      // override a previously saved English preference.
      if (!cookieLocale) {
        response.cookies.set("herbally-locale", locale, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }

      // Refresh the Supabase session on French pages too. This branch used to
      // return before updateSession() ran, so /fr visitors never had expired
      // tokens rotated and were effectively signed out mid-session. The helper
      // short-circuits when no auth cookie is present, so anonymous traffic
      // still pays nothing.
      const { supabaseResponse } = await updateSession(request);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
      });

      return applySecurityHeaders(response, frameOpts);
    }

    // Unprefixed path — redirect to /fr/* only if the user prefers French
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

    // English: rewrite the public path onto the internal /en segment. The
    // browser URL stays unprefixed, so canonical/hreflang/sitemap are
    // unaffected and there is only one public English URL.
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", DEFAULT_LOCALE);
    requestHeaders.set("x-pathname", pathname);
    // Marks the internal pass so the `/en/*` redirect rule does not fire on
    // the rewritten path (see the guard at the top of this function).
    requestHeaders.set("x-herbally-internal-locale", "1");
    let response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });

    // Locale cookie for first-time visitors (English default)
    if (!cookieLocale) {
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

    return applySecurityHeaders(response, frameOpts);
  }

  // Excluded paths (API, auth callback, static metadata) — no locale rewrite.
  // x-locale stays available for route handlers and server actions, which
  // cannot read next/root-params.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", DEFAULT_LOCALE);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

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

  const { supabaseResponse } = await updateSession(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Admin authorization is handled by src/app/[locale]/admin/layout.tsx, which
  // verifies the role against the database profiles table (not just JWT
  // metadata, which can be tampered with). No middleware-level check here
  // to avoid relying on client-controllable JWT claims.

  return applySecurityHeaders(response, frameOpts);
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
