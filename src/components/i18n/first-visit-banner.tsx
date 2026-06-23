"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useSetLocale } from "./use-set-locale";
import { useDetectedLocale } from "./use-detected-locale";
import { X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { useTranslations } from "next-intl";

export function FirstVisitBanner() {
  const locale = useLocale();
  const detected = useDetectedLocale();
  const setLocale = useSetLocale();
  const t = useTranslations();

  // `dismissed` is read once from sessionStorage (client) so we never call
  // setState inside an effect. SSR renders dismissed=true (banner hidden) to
  // avoid a flash; the banner can appear after hydration for first-time
  // visitors whose browser language differs from the current locale.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("herbally-lang-banner-dismissed") === "1";
  });

  const visible = !dismissed && detected !== null && detected !== locale;
  if (!visible || !detected) return null;

  const switchToKey =
    detected === "fr" ? "common.switchToFrench" : "common.switchToEnglish";
  const switchTo = t(switchToKey);
  const dismissLabel = t("common.dismiss");

  function handleSwitch() {
    if (!detected) return;
    trackEvent("language_changed", {
      locale: detected,
      source: "first_visit_banner",
    });
    setLocale(detected);
    setDismissed(true);
  }

  function handleDismiss() {
    sessionStorage.setItem("herbally-lang-banner-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="sticky top-12 z-40 w-full border-b border-border/50 bg-primary/5 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 text-sm">
          <Globe className="size-4 text-primary" />
          <span className="text-foreground">{switchTo}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleSwitch}
            className="h-7 text-xs"
          >
            {switchTo}
          </Button>
          <button
            onClick={handleDismiss}
            aria-label={dismissLabel}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
