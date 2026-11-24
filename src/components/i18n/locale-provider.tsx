import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { pickClientMessages } from "@/lib/i18n/client-messages";

/**
 * Provides only the shared `core` client messages for the active locale so the
 * full 125–142 KB dictionaries stay on the server and route-level pages can add
 * their own narrow scopes via `IntlMessagesScope`.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const messages = pickClientMessages(locale, "core");

  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}
