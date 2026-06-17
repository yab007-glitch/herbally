"use client";

import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/i18n/dictionaries/en.json";
import frMessages from "@/lib/i18n/dictionaries/fr.json";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

const allMessages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  fr: frMessages,
};

function getCookieLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/herbally-locale=([^;]+)/);
  return match?.[1] === "fr" ? "fr" : "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale] = useState<Locale>(() => getCookieLocale());
  const messages = allMessages[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone="America/Toronto">
      {children}
    </NextIntlClientProvider>
  );
}
