"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import coreMessages from "@/lib/i18n/dictionaries/en/core.json";

export function EnCoreLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      messages={coreMessages as unknown as AbstractIntlMessages}
      locale="en"
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}
