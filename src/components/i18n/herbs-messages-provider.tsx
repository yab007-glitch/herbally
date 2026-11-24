"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n/config";

const EnHerbsMessagesProvider = dynamic(() =>
  import("./providers/en-herbs").then((mod) => mod.EnHerbsMessagesProvider)
);
const FrHerbsMessagesProvider = dynamic(() =>
  import("./providers/fr-herbs").then((mod) => mod.FrHerbsMessagesProvider)
);

/**
 * Mounts the shared, per-locale herb/clinical client message chunk without
 * passing message JSON across the Server→Client boundary.
 */
export function HerbsMessagesProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  if (locale === "fr") {
    return <FrHerbsMessagesProvider>{children}</FrHerbsMessagesProvider>;
  }
  return <EnHerbsMessagesProvider>{children}</EnHerbsMessagesProvider>;
}
