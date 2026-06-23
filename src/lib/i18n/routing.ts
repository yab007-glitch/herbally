import { type Locale, LOCALES, DEFAULT_LOCALE } from "./config";

/**
 * Custom locale routing contract (NOT next-intl's built-in middleware).
 *
 * This project does not use `next-intl` middleware / `defineRouting` for
 * routing. Instead the App Router serves localized pages under URL prefixes
 * for non-default locales (e.g. `/fr/herbs`) while the default locale (`en`)
 * is served unprefixed at `/herbs`. Locale is resolved per-request:
 *
 *   - On the server: `getLocaleFromRequest` (server-locale.ts) reads the
 *     `x-locale` request header.
 *   - The header is set by `proxy.ts` (Next.js 16 middleware replacement),
 *     which inspects the pathname and injects `x-locale` before the request
 *     reaches the route handler / server component.
 *   - On the client: `next-intl`'s `useLocale()` is wired via the
 *     `NextIntlClientProvider` in the root layout, fed from the same source.
 *
 * `next-intl` is therefore used only for message resolution (`useTranslations`
 * / `getTranslations`), not for routing. All prefix add/strip/inspect logic
 * lives here so the routing contract has one source of truth.
 */

// Derive the prefix for non-default locales (e.g. "/fr" when default is "en").
const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
const LOCALE_PREFIX =
  NON_DEFAULT_LOCALES.length > 0 ? `/${NON_DEFAULT_LOCALES[0]}` : "";

/**
 * Returns true if the pathname starts with a locale prefix (e.g. /fr/herbs).
 */
export function isLocalePrefixed(pathname: string): boolean {
  return pathname.startsWith(LOCALE_PREFIX + "/") || pathname === LOCALE_PREFIX;
}

/**
 * Extract locale from pathname. Returns default if not prefixed.
 */
export function getLocaleFromPathname(pathname: string): Locale {
  if (pathname.startsWith(LOCALE_PREFIX + "/") || pathname === LOCALE_PREFIX) {
    return "fr";
  }
  return DEFAULT_LOCALE;
}

/**
 * Strip the locale prefix from a pathname.
 */
export function stripLocalePrefix(pathname: string): string {
  if (pathname.startsWith(LOCALE_PREFIX + "/")) {
    return pathname.slice(LOCALE_PREFIX.length);
  }
  if (pathname === LOCALE_PREFIX) {
    return "/";
  }
  return pathname;
}

/**
 * Add locale prefix to a pathname if locale is non-default.
 */
export function addLocalePrefix(pathname: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return pathname;
  if (pathname === "/") return LOCALE_PREFIX;
  return LOCALE_PREFIX + pathname;
}

/**
 * Build full alternate URLs for hreflang tags.
 */
export function buildAlternateUrls(
  pathnameWithoutLocale: string,
  baseUrl: string
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) {
    const path = addLocalePrefix(pathnameWithoutLocale, locale);
    alternates[locale] = `${baseUrl}${path}`;
  }
  alternates["x-default"] = `${baseUrl}${pathnameWithoutLocale}`;
  return alternates;
}
