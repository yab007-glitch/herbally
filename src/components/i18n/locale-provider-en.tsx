"use client";

import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/i18n/dictionaries/en.json";

export function EnLocaleProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      messages={enMessages}
      locale="en"
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}
