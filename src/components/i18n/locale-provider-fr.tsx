"use client";

import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/lib/i18n/dictionaries/fr.json";

export function FrLocaleProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      messages={frMessages}
      locale="fr"
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}
