import { type Locale, LOCALES, DEFAULT_LOCALE } from "./config";

const LOCALE_PREFIX = "/fr";

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
