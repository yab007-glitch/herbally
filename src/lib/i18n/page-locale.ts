import { locale as rootLocale } from "next/root-params";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Locale for Server Components and server-side utilities, read from the
 * `[locale]` root param.
 *
 * The proxy rewrites public English URLs onto the internal `/en` segment and
 * passes `/fr/*` through, so the param is always present on a rendered page.
 * Reading it here — instead of a request header — is what lets pages be
 * prerendered and cached: request APIs such as `headers()` force every route
 * that touches them into dynamic rendering.
 *
 * Do NOT call this from a Server Action or Route Handler; `next/root-params`
 * is not available there. Those keep using `getLocaleFromRequest()` (the
 * `x-locale` header), or accept the locale as an argument.
 */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fr";
}
