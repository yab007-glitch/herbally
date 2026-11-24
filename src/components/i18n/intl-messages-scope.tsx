import type { Locale } from "@/lib/i18n/config";
import {
  pickClientMessages,
  type ClientMessageScope,
} from "@/lib/i18n/client-messages";
import { MergeIntlClientProvider } from "./merge-intl-provider";

/**
 * Server Component wrapper that injects only the client translation scope
 * required by a specific route segment, merging into the root `core` scope.
 */
export function IntlMessagesScope({
  locale,
  scope,
  children,
}: {
  locale: Locale;
  scope: ClientMessageScope;
  children: React.ReactNode;
}) {
  const messages = pickClientMessages(locale, scope);
  return (
    <MergeIntlClientProvider messages={messages}>
      {children}
    </MergeIntlClientProvider>
  );
}
