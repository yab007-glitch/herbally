"use server";

import { headers } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Read the locale from the x-locale header set by middleware during rewrites.
 * This allows /fr/* URLs to render in French on the server.
 */
export async function getLocaleFromRequest(): Promise<Locale> {
  try {
    const h = await headers();
    const locale = h.get("x-locale");
    if (locale === "fr" || locale === "en") {
      return locale;
    }
  } catch {
    // headers() may not be available in some contexts
  }
  return DEFAULT_LOCALE;
}
