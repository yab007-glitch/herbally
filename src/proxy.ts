import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimit } from "@/lib/rate-limit";
import {
  isLocalePrefixed,
  getLocaleFromPathname,
  stripLocalePrefix,
  addLocalePrefix,
} from "@/lib/i18n/routing";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

function getClientIP(request: NextRequest): string {
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

function buildCSP(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' *.stripe.com",
    "connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com",
    "img-src 'self' data: blob: https:",
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

function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const entries = acceptLanguage.split(",").map((entry) => {
    const [tag] = entry.trim().split(";");
    const lang = tag.split("-")[0].toLowerCase();
    const q = parseFloat(entry.split("q=")[1]) || 1.0;
    return { lang, q };
  });
  for (const entry of entries.sort((a, b) => b.q - a.q)) {
    if (entry.lang === "fr") return "fr";
    if (entry.lang === "en") return DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
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
 * NOTE: Next.js 16 renames "middleware" to "proxy" (file convention + export),
 * with functionality unchanged. Kept as middleware.ts for now since the
 * proxy.ts convention isn't reliably recognized by this build setup; migrate
 * separately.
 */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Locale routing ─────────────────────────────────────────────────
  if (!shouldSkipLocaleRouting(pathname)) {
    const cookieLocale = request.cookies.get("herbally-locale")?.value as
      | Locale
      | undefined;
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
    });
  }

  // Supabase session refresh
  const { supabaseResponse } = await updateSession(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // API Chat Rate limit (Edge-native)
  if (pathname.startsWith("/api/chat")) {
    const ip = getClientIP(request);
    const { success } = await rateLimit(ip, 20, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
        }
      );
    }
  }

  // Admin authorization is handled by src/app/admin/layout.tsx, which
  // verifies the role against the database profiles table (not just JWT
  // metadata, which can be tampered with). No middleware-level check here
  // to avoid relying on client-controllable JWT claims.

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
