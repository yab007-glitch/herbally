import { headers } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Read the locale from the `x-locale` header set by the proxy during rewrites.
 * This is the server-side mirror of the URL: `/fr/*` → "fr", everything else →
 * "en". Used by server components (including the root layout) so that SSR and
 * the client provider always agree on the active locale.
 *
 * Plain server helper (not a Server Action) — safe to call during render.
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
