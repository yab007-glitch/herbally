"use client";

import type { AbstractIntlMessages } from "next-intl";
import marketingMessages from "@/lib/i18n/dictionaries/en/marketing.json";
import { MergeIntlClientProvider } from "../merge-intl-provider";

export function EnMarketingMessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MergeIntlClientProvider
      messages={marketingMessages as unknown as AbstractIntlMessages}
    >
      {children}
    </MergeIntlClientProvider>
  );
}
