"use client";

import type { AbstractIntlMessages } from "next-intl";
import clinicalMessages from "@/lib/i18n/dictionaries/en/clinical.json";
import herbsMessages from "@/lib/i18n/dictionaries/en/herbs.json";
import { mergeClientMessages } from "@/lib/i18n/merge-messages";
import { MergeIntlClientProvider } from "../merge-intl-provider";

const HERBS_MESSAGES = mergeClientMessages(
  clinicalMessages as unknown as AbstractIntlMessages,
  herbsMessages as unknown as AbstractIntlMessages
);

export function EnHerbsMessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MergeIntlClientProvider messages={HERBS_MESSAGES}>
      {children}
    </MergeIntlClientProvider>
  );
}
