"use client";

import { useLocale, useTranslations } from "next-intl";

/**
 * Live region that announces locale changes to screen readers.
 * Hidden visually but available to assistive tech.
 */
export function LanguageAnnouncement() {
  const locale = useLocale();
  const t = useTranslations();
  const announcementKey =
    locale === "fr" ? "common.languageSwitchedFr" : "common.languageSwitchedEn";
  const announcement = t(announcementKey);

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
