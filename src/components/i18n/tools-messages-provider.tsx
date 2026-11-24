"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n/config";

const EnToolsMessagesProvider = dynamic(() =>
  import("./providers/en-tools").then((mod) => mod.EnToolsMessagesProvider)
);
const FrToolsMessagesProvider = dynamic(() =>
  import("./providers/fr-tools").then((mod) => mod.FrToolsMessagesProvider)
);

/**
 * Mounts the shared, per-locale interactive-tools client message chunk without
 * passing message JSON across the Server→Client boundary.
 */
export function ToolsMessagesProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  if (locale === "fr") {
    return <FrToolsMessagesProvider>{children}</FrToolsMessagesProvider>;
  }
  return <EnToolsMessagesProvider>{children}</EnToolsMessagesProvider>;
}
