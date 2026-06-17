"use server";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Read the locale from the herbally-locale cookie.
 * This is set by middleware when visiting /fr/* URLs.
 * Falls back to Accept-Language header parsing, then default.
 */
export async function getLocaleFromRequest(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("herbally-locale")?.value;
    if (cookieLocale === "fr" || cookieLocale === "en") {
      return cookieLocale;
    }
  } catch {
    // cookies() may not be available in some contexts
  }
  return DEFAULT_LOCALE;
}
