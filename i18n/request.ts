import { getRequestConfig } from "next-intl/server";
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const messages: Record<string, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fr";
}

/**
 * Resolve messages from the locale Next passes down for the current route.
 *
 * The locale now comes from the `[locale]` route segment (via
 * `setRequestLocale` in the root layout), never from request headers. The old
 * `headers()` fallback made every page that called `getTranslations` dynamic;
 * removing it is a precondition for ISR.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: messages[locale] ?? messages.en,
    timeZone: "America/Toronto",
  };
});
