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
    // headers() may throw during static generation
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await getLocaleFromHeaders();
  return {
    locale,
    messages: messages[locale] ?? messages.en,
  };
});
