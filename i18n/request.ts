import { getRequestConfig } from "next-intl/server";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale || DEFAULT_LOCALE;
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale] ?? messages.en,
  };
});
