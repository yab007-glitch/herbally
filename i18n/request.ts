import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

export default getRequestConfig(async ({ locale }) => {
  // For runtime SSR, read locale from middleware header.
  // During static generation, fall back to the provided locale or default.
  let resolvedLocale = locale || DEFAULT_LOCALE;
  try {
    const h = await headers();
    const headerLocale = h.get("x-locale");
    if (headerLocale === "fr" || headerLocale === "en") {
      resolvedLocale = headerLocale;
    }
  } catch {
    // headers() not available during static generation
  }
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale] ?? messages.en,
  };
});
