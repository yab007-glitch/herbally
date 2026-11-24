"use client";

import type { AbstractIntlMessages } from "next-intl";
import clinicalMessages from "@/lib/i18n/dictionaries/en/clinical.json";
import toolsMessages from "@/lib/i18n/dictionaries/en/tools.json";
import { mergeClientMessages } from "@/lib/i18n/merge-messages";
import { MergeIntlClientProvider } from "../merge-intl-provider";

const TOOLS_MESSAGES = mergeClientMessages(
  clinicalMessages as unknown as AbstractIntlMessages,
  toolsMessages as unknown as AbstractIntlMessages
);

export function EnToolsMessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MergeIntlClientProvider messages={TOOLS_MESSAGES}>
      {children}
    </MergeIntlClientProvider>
  );
}
