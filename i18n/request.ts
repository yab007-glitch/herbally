import { getRequestConfig } from "next-intl/server";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

export default getRequestConfig(async ({ locale }) => {
  // During static generation, default to English.
  // Runtime locale switching is handled by middleware rewrites (/fr/*)
  // and the client-side LocaleProvider.
  const resolvedLocale = locale || DEFAULT_LOCALE;
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale] ?? messages.en,
  };
});
