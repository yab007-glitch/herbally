import { headers } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Read the locale from the `x-locale` header set by the proxy from the URL.
 *
 * This is the header-based helper and it is only for code that cannot read
 * route params: Route Handlers (`/api/*`) and Server Actions invoked from
 * Client Components. Server Components must use `getLocale()` from
 * `page-locale.ts` instead — calling `headers()` during render forces the
 * whole route into dynamic rendering and defeats ISR.
 */
export async function getLocaleFromRequest(): Promise<Locale> {
  try {
    const h = await headers();
    const locale = h.get("x-locale");
    if (locale === "fr" || locale === "en") {
      return locale;
    }
  } catch {
    // headers() may be unavailable during static generation / offline builds.
  }
  return DEFAULT_LOCALE;
}
