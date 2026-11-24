"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import coreMessages from "@/lib/i18n/dictionaries/fr/core.json";

export function FrCoreLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      messages={coreMessages as unknown as AbstractIntlMessages}
      locale="fr"
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}
