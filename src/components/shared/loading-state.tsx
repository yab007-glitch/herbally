"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Shared loading state with localized "Loading..." text.
 * Used by all loading.tsx route segments so French visitors see
 * "Chargement..." instead of the English default.
 */
export function LoadingState() {
  const t = useTranslations();

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-primary"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}