import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Detect the preferred locale from the Accept-Language header.
 * Parses q-weights and returns the first supported locale found,
 * falling back to DEFAULT_LOCALE.
 *
 * Shared between the proxy (middleware) and unit tests so the test
 * exercises the actual production function, not a re-implementation.
 */
export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const entries = acceptLanguage.split(",").map((entry) => {
    const [tag] = entry.trim().split(";");
    const lang = tag.split("-")[0]?.toLowerCase() ?? "";
    const q = parseFloat(entry.split("q=")[1]) || 1.0;
    return { lang, q };
  });
  for (const entry of entries.sort((a, b) => b.q - a.q)) {
    if (entry.lang === "fr") return "fr";
    if (entry.lang === "en") return DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}