"use client";

import { useMemo } from "react";
import {
  NextIntlClientProvider,
  useLocale,
  useMessages,
  type AbstractIntlMessages,
} from "next-intl";
import { mergeClientMessages } from "@/lib/i18n/merge-messages";

/**
 * Extends the ancestor `NextIntlClientProvider` messages with route-specific
 * namespaces picked on the server, avoiding shipping the entire dictionary to
 * every page.
 */
export function MergeIntlClientProvider({
  messages,
  children,
}: {
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const parentMessages = useMessages();

  const merged = useMemo(
    () => mergeClientMessages(parentMessages, messages),
    [parentMessages, messages]
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone="America/Toronto"
      messages={merged}
    >
      {children}
    </NextIntlClientProvider>
  );
}
