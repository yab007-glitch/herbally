"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n/config";

const EnMarketingMessagesProvider = dynamic(() =>
  import("./providers/en-marketing").then(
    (mod) => mod.EnMarketingMessagesProvider
  )
);
const FrMarketingMessagesProvider = dynamic(() =>
  import("./providers/fr-marketing").then(
    (mod) => mod.FrMarketingMessagesProvider
  )
);

/**
 * Mounts the shared, per-locale marketing client message chunk without
 * passing message JSON across the Server→Client boundary.
 */
export function MarketingMessagesProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  if (locale === "fr") {
    return (
      <FrMarketingMessagesProvider>{children}</FrMarketingMessagesProvider>
    );
  }
  return <EnMarketingMessagesProvider>{children}</EnMarketingMessagesProvider>;
}
