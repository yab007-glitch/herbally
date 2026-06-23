"use client";

import { Globe, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LANGUAGES } from "@/lib/i18n/config";
import { useTranslations, useLocale } from "next-intl";
import { useSetLocale } from "./use-set-locale";
import { useDetectedLocale } from "./use-detected-locale";
import { trackEvent } from "@/lib/analytics";

interface LanguageDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function LanguageDrawer({
  open,
  onOpenChange,
  hideTrigger,
}: LanguageDrawerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const detectedLocale = useDetectedLocale();

  const trigger = (
    <SheetTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full h-11 min-w-11 px-2.5 hover:bg-muted hover:text-foreground transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
      <Globe className="size-5" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">
        {locale}
      </span>
      <span className="sr-only">{t("common.changeLanguage")}</span>
    </SheetTrigger>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && trigger}
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>{t("common.changeLanguage")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {detectedLocale && detectedLocale !== locale && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b">
              <span>{t("common.suggested")}</span>
              <button
                onClick={() => {
                  trackEvent("language_changed", {
                    locale: detectedLocale,
                    source: "drawer_suggestion",
                  });
                  onOpenChange?.(false);
                  setLocale(detectedLocale);
                }}
                className="text-primary hover:underline font-medium"
              >
                {LANGUAGES.find((l) => l.code === detectedLocale)?.nativeName}
              </button>
            </div>
          )}
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                trackEvent("language_changed", {
                  locale: lang.code,
                  source: "drawer",
                });
                onOpenChange?.(false);
                setLocale(lang.code);
              }}
              aria-current={lang.code === locale ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                lang.code === locale
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {lang.flag}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{lang.nativeName}</p>
                <p className="text-xs text-muted-foreground">{lang.name}</p>
              </div>
              {lang.code === locale && (
                <Check className="size-5 text-primary" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
