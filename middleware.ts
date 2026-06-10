import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const adminRoutes = ["/admin"];

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.stripe.com",
    "connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src *.stripe.com",
    "frame-ancestors 'none'",
  ].join("; "),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
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
 * Parse Accept-Language header and detect if French is the preferred language.
 */
function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null
): string | null {
  if (!acceptLanguage) return null;
  const entries = acceptLanguage.split(",").map((entry) => {
    const [tag] = entry.trim().split(";");
    const lang = tag.split("-")[0].toLowerCase();
    const q = parseFloat(entry.split("q=")[1]) || 1.0;
    return { lang, q };
  });
  for (const entry of entries.sort((a, b) => b.q - a.q)) {
    if (entry.lang === "fr") return "fr";
    if (entry.lang === "en") return null;
  }
  return null;
}

export default async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Locale detection: set cookie for first-time visitors
  const existingLocale = request.cookies.get("herbally-locale")?.value;
  if (!existingLocale) {
    const detected = detectLocaleFromAcceptLanguage(
      request.headers.get("accept-language")
    );
    if (detected) {
      response.cookies.set("herbally-locale", detected, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  // Supabase session refresh
  const { supabaseResponse, user } = await updateSession(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Route guards
  const pathname = request.nextUrl.pathname;

  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!user) {
      return Response.redirect(new URL("/", request.url));
    }
    const role = user?.user_metadata?.role ?? "user";
    if (role !== "admin") {
      return Response.redirect(new URL("/", request.url));
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
