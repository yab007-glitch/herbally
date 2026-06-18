"use client";

import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/i18n/dictionaries/en.json";
import frMessages from "@/lib/i18n/dictionaries/fr.json";
import type { Locale } from "@/lib/i18n/config";

const allMessages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  fr: frMessages,
};

/**
 * Provides next-intl messages to all client components.
 *
 * The active `locale` is passed in from the server root layout, which reads it
 * from the `x-locale` request header set by the proxy. Because the locale is
 * derived from the URL (the single source of truth) and the language toggle
 * performs a hard navigation, this prop is always correct and never drifts
 * from what the server rendered — eliminating the partial-translation bug
 * where the cookie and the URL disagreed.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const messages = allMessages[locale];

  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone="America/Toronto">
      {children}
    </NextIntlClientProvider>
  );
}
