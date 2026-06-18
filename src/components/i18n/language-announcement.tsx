"use client";

import { useLocale } from "next-intl";

/**
 * Live region that announces locale changes to screen readers.
 * Hidden visually but available to assistive tech.
 */
export function LanguageAnnouncement() {
  const locale = useLocale();
  const messages: Record<string, string> = {
    en: "Language switched to English",
    fr: "Langue changée en Français",
  };
  const announcement = messages[locale] || "";

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="language-announcement"
    >
      {announcement}
    </div>
  );
}
