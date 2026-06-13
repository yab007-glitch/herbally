import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimit } from "@/lib/rate-limit";

function getClientIP(request: NextRequest): string {
  // Only trust Vercel-specific header when actually running on Vercel
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

const adminRoutes = ["/admin"];

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

  // Only allow eval in development; production standalone builds shouldn't need it
  if (process.env.NODE_ENV !== "production") {
    directives[1] = "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.stripe.com";
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
