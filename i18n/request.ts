import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

async function getLocaleFromCookie(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get("herbally-locale")?.value;
    if (locale === "fr" || locale === "en") return locale;
  } catch {
    // cookies() not available during static generation
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ locale: pathLocale }) => {
  // Priority: cookie locale > path locale > default
  const cookieLocale = await getLocaleFromCookie();
  const resolvedLocale = cookieLocale || pathLocale || DEFAULT_LOCALE;
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale] ?? messages.en,
  };
});
