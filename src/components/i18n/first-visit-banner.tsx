"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { useSetLocale } from "./use-set-locale";
import { useDetectedLocale } from "./use-detected-locale";
import { X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n/config";

export function FirstVisitBanner() {
  const locale = useLocale();
  const detected = useDetectedLocale();
  const setLocale = useSetLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!detected || detected === locale) return;
    const dismissed = sessionStorage.getItem("herbally-lang-banner-dismissed");
    if (!dismissed) setVisible(true);
  }, [detected, locale]);

  if (!visible || !detected) return null;

  const labels: Record<Locale, { switchTo: string; dismiss: string }> = {
    en: { switchTo: "Switch to English", dismiss: "Dismiss" },
    fr: { switchTo: "Passer en Français", dismiss: "Ignorer" },
  };

  const t = labels[detected];

  function handleSwitch() {
    if (!detected) return;
    trackEvent("language_changed", { locale: detected, source: "first_visit_banner" });
    setLocale(detected);
    setVisible(false);
  }

  function handleDismiss() {
    sessionStorage.setItem("herbally-lang-banner-dismissed", "1");
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="sticky top-12 z-40 w-full border-b border-border/50 bg-primary/5 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 text-sm">
          <Globe className="size-4 text-primary" />
          <span className="text-foreground">{t.switchTo}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleSwitch}
            className="h-7 text-xs"
          >
            {t.switchTo}
          </Button>
          <button
            onClick={handleDismiss}
            aria-label={t.dismiss}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
