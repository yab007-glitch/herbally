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
import { ADS_LAUNCH_GATE } from "@/lib/ads/policy";
import { adsCspHosts, buildContentSecurityPolicy } from "@/lib/ads/csp";

function securityHeaders(opts?: {
  frameable?: boolean;
  adHosts?: readonly string[];
}): Record<string, string> {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "on",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": buildContentSecurityPolicy({
      adHosts: opts?.adHosts ?? [],
      frameable: opts?.frameable,
      dev: process.env.NODE_ENV !== "production",
    }),
  };
}

function applySecurityHeaders(
  response: NextResponse,
  opts?: { frameable?: boolean; adHosts?: readonly string[] }
): NextResponse {
  const baseSecurityHeaders = securityHeaders(opts);
  for (const [key, value] of Object.entries(baseSecurityHeaders)) {
    // /embed/* tools are designed to run inside third-party iframes: allow
    // framing and drop X-Frame-Options there. The CSP already carries
    // frame-ancestors * for that mode. The embeds contain no auth or
    // state-changing actions (search inputs + outbound links only), so the
    // clickjacking exposure is minimal. Everything else keeps DENY.
    // NOTE: next.config.ts headers() does not set X-Frame-Options; if another
    // layer adds it, delete it explicitly rather than skipping .set().
    if (key === "X-Frame-Options" && opts?.frameable) {
      response.headers.delete("X-Frame-Options");
      continue;
    }
    response.headers.set(key, value);
  }
  if (opts?.frameable) {
    response.headers.delete("X-Frame-Options");
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
  "/ads.txt",
  "/llms.txt",
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
  // CSP-wide ad permission is granted ONLY to an ad-eligible public herb
  // document and only when the hard launch gate is on. Sensitive documents
  // (chat, checker, calculator, garden, auth, API) never list an ad origin.
  const securityOpts = {
    frameable,
    adHosts: adsCspHosts(ADS_LAUNCH_GATE, publicPath),
  };

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
      securityOpts
    );
  }

  // ── API rate limiting (before session refresh) ────────────────────
  // Rate-limit /api/chat BEFORE the Supabase session refresh so an
  // unauthenticated flood is rejected without doing DB/session work first.
  // Separate key prefix (`proxy-chat`) from /api/chat (`chat`) so a single
  // request is not double-counted against the same quota bucket.
  if (pathname.startsWith("/api/chat")) {
    const ip = getClientIP(request);
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => /^sb-.*-auth-token/.test(c.name) && Boolean(c.value));
    const minuteCap = hasAuthCookie ? 20 : 10;
    const dayCap = hasAuthCookie ? 150 : 40;
    const perMinute = await rateLimit(
      `${ip}:proxy-chat:minute`,
      minuteCap,
      60_000
    );
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
    const perDay = await rateLimit(`${ip}:proxy-chat:day`, dayCap, 86_400_000);
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

      // Do not emit Set-Cookie on anonymous GETs: automatic Set-Cookie headers
      // force CDN caches (Cloudflare) to bypass edge caching (`DYNAMIC`) for
      // every crawler and first-time visitor. Explicit language changes still
      // persist `herbally-locale` client-side in `use-set-locale.ts`.

      // Refresh the Supabase session on French pages too. This branch used to
      // return before updateSession() ran, so /fr visitors never had expired
      // tokens rotated and were effectively signed out mid-session. The helper
      // short-circuits when no auth cookie is present, so anonymous traffic
      // still pays nothing.
      const { supabaseResponse } = await updateSession(request);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
      });

      return applySecurityHeaders(response, securityOpts);
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
      redirect.headers.set("Cache-Control", "private, no-store");
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

    // Do not set a default locale cookie automatically on anonymous GETs so
    // CDN edge caches can serve unauthenticated public English pages cleanly.

    // Supabase session refresh
    const { supabaseResponse } = await updateSession(request);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return applySecurityHeaders(response, securityOpts);
  }

  // Excluded paths (API, auth callback, static metadata) — no locale rewrite.
  // Propagate French locale when an API call originates from a /fr page,
  // carries an explicit x-locale header, or carries the French locale cookie.
  const requestHeaders = new Headers(request.headers);
  const explicitHeaderLocale = request.headers.get("x-locale");
  const referer = request.headers.get("referer");
  let refererIsFr = false;
  if (referer) {
    try {
      const refPath = new URL(referer).pathname;
      refererIsFr = refPath === "/fr" || refPath.startsWith("/fr/");
    } catch {
      // Ignore malformed Referer header
    }
  }
  const cookieLocaleValue = request.cookies.get("herbally-locale")?.value;
  const resolvedExcludedLocale: Locale =
    explicitHeaderLocale === "fr" || explicitHeaderLocale === "en"
      ? explicitHeaderLocale
      : refererIsFr
        ? "fr"
        : cookieLocaleValue === "fr"
          ? "fr"
          : DEFAULT_LOCALE;
  requestHeaders.set("x-locale", resolvedExcludedLocale);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const { supabaseResponse } = await updateSession(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Admin authorization is handled by src/app/[locale]/admin/layout.tsx, which
  // verifies the role against the database profiles table (not just JWT
  // metadata, which can be tampered with). No middleware-level check here
  // to avoid relying on client-controllable JWT claims.

  return applySecurityHeaders(response, securityOpts);
}

export const config = {
  matcher: [
    // Static files are excluded by path *and* by extension: the locale rewrite
    // would otherwise turn /media/x.mp4 into /en/media/x.mp4 and 404 it. `.js`
    // was missing from this list, so /sw.js (and every other public script)
    // was rewritten to /en/sw.js and answered 404 — the service worker could
    // never register.
    "/((?!monitoring|media/|_next/static|_next/image|favicon.ico|robots.txt|ads.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|ogg|mp3|wav|m4a|pdf|txt|html|js|mjs|css|map|xml|webmanifest|woff|woff2|ttf|otf|eot)$).*)",
  ],
};
