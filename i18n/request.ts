import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

async function getLocaleFromHeaders(): Promise<Locale> {
  try {
    const h = await headers();
    const locale = h.get("x-locale");
    if (locale === "fr" || locale === "en") return locale;
  } catch {
    // headers() not available during static generation
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ locale: pathLocale }) => {
  const headerLocale = await getLocaleFromHeaders();
  const resolvedLocale = headerLocale || pathLocale || DEFAULT_LOCALE;
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale] ?? messages.en,
    timeZone: "America/Toronto",
  };
});
