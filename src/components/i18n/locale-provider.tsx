"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n/config";

const EnCoreLocaleProvider = dynamic(() =>
  import("./providers/en-core").then((mod) => mod.EnCoreLocaleProvider)
);
const FrCoreLocaleProvider = dynamic(() =>
  import("./providers/fr-core").then((mod) => mod.FrCoreLocaleProvider)
);

/**
 * Provides only the shared `core` client messages for the active locale via a
 * per-locale dynamic client chunk so zero messages are serialized into the RSC
 * payload and the inactive locale stays off the route's initial bundle.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  if (locale === "fr") {
    return <FrCoreLocaleProvider>{children}</FrCoreLocaleProvider>;
  }
  return <EnCoreLocaleProvider>{children}</EnCoreLocaleProvider>;
}
