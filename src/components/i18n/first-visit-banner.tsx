"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { useSetLocale } from "./use-set-locale";
import { useDetectedLocale } from "./use-detected-locale";
import { X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "herbally-lang-banner-dismissed";

/**
 * Read the dismiss flag as an external store (the same idiom as use-theme.ts).
 *
 * SSR and the first client render MUST agree, so the server snapshot is `true`
 * (hidden) and the stored value is only read on the client snapshot, i.e. after
 * hydration. Reading sessionStorage during render (the previous `useState`
 * initializer) made the server emit "hidden" while the client's first pass
 * computed "visible" for first-time visitors, which React reported as
 * hydration error #418 on every page mounting the navbar (HERBALLY-5).
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(DISMISS_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return true;
}

export function FirstVisitBanner() {
  const locale = useLocale();
  const detected = useDetectedLocale();
  const setLocale = useSetLocale();
  const t = useTranslations();

  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  function markDismissed() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    // The native storage event only fires in OTHER tabs, so dispatch one here
    // to make this tab's store re-read immediately.
    window.dispatchEvent(new StorageEvent("storage", { key: DISMISS_KEY }));
  }

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
    markDismissed();
  }

  function handleDismiss() {
    markDismissed();
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
