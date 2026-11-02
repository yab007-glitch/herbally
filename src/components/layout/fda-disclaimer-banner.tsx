"use client";

import { useTranslations } from "next-intl";

/**
 * The statutory disclaimer.
 *
 * It has to be on the page; it does not have to look like an error. The
 * previous version was an amber gradient with a warning icon across the full
 * width — the loudest thing above the fold on a site whose whole promise is
 * calm. Here it is a hairline rule and small print: present, readable, quiet.
 * The text itself is unchanged.
 */
export function FDADisclaimerBanner() {
  const t = useTranslations();

  return (
    <div
      role="region"
      aria-label={t("common.medicalDisclaimerLabel")}
      className="w-full border-b border-border bg-background px-4 py-1 text-center sm:py-1.5"
    >
      <p className="mx-auto max-w-5xl text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">
        {t("fda.disclaimer")}
      </p>
    </div>
  );
}
