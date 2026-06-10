"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export function FDADisclaimerBanner() {
  const t = useTranslations();

  return (
    <div
      role="region"
      aria-label="Medical disclaimer"
      className="w-full border-b border-amber-200/50 bg-gradient-to-r from-amber-50 via-amber-50/80 to-amber-50 px-4 py-2 text-center text-xs leading-relaxed text-amber-800 dark:from-amber-950/50 dark:via-amber-950/30 dark:to-amber-950/50 dark:border-amber-900/50 dark:text-amber-200"
    >
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2">
        <AlertCircle className="size-3.5 shrink-0" />
        <span>{t("fda.disclaimer")}</span>
      </p>
    </div>
  );
}
