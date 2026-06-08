"use client";

import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

interface I18nProviderProps {
  children: ReactNode;
  messages: Record<string, unknown>;
  locale: string;
}

/**
 * Thin wrapper around NextIntlClientProvider.
 * Kept as a local component to maintain the existing import path
 * and allow future customizations (e.g., additional context values).
 */
export function I18nProvider({
  children,
  messages,
  locale,
}: I18nProviderProps) {
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
