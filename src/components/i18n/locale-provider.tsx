import type { Locale } from "@/lib/i18n/config";
import { EnLocaleProvider } from "./locale-provider-en";
import { FrLocaleProvider } from "./locale-provider-fr";

/**
 * Provides next-intl messages to client components without bundling the inactive
 * language's 120–137 KB dictionary into every page.
 *
 * The active `locale` is passed in from the server root layout, which reads
 * the `[locale]` root param, so the client provider only loads the active
 * locale bundle.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  if (locale === "fr") {
    return <FrLocaleProvider>{children}</FrLocaleProvider>;
  }
  return <EnLocaleProvider>{children}</EnLocaleProvider>;
}
