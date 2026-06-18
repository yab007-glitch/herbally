"use client";

import { Globe, Check, Command, Shuffle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES } from "@/lib/i18n/config";
import { useTranslations, useLocale } from "next-intl";
import { useSetLocale } from "./use-set-locale";
import { trackEvent } from "@/lib/analytics";
import { useDetectedLocale } from "./use-detected-locale";
import { useLanguageHotkey } from "./use-language-hotkey";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSelector() {
  const t = useTranslations();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const detectedLocale = useDetectedLocale();

  // Toggle between en ↔ fr with Cmd/Ctrl + Shift + L
  useLanguageHotkey(() => {
    const next: Locale = locale === "en" ? "fr" : "en";
    trackEvent("language_changed", { locale: next, source: "hotkey" });
    setLocale(next);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("common.changeLanguage")}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full h-11 min-w-11 px-2.5 hover:bg-muted hover:text-foreground transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Globe className="size-5" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">
          {locale}
        </span>
        <span className="sr-only">{t("common.changeLanguage")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Detected language suggestion */}
        {detectedLocale && detectedLocale !== locale && (
          <div className="px-2 py-2 text-xs text-muted-foreground border-b mb-1">
            <span>{t("common.suggested")}</span>{" "}
            <button
              onClick={() => {
                trackEvent("language_changed", { locale: detectedLocale, source: "dropdown_suggestion" });
                setLocale(detectedLocale);
              }}
              className="text-primary hover:underline font-medium"
            >
              {LANGUAGES.find((l) => l.code === detectedLocale)?.nativeName}
            </button>
          </div>
        )}

        {/* Language options */}
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => {
              trackEvent("language_changed", { locale: lang.code, source: "dropdown" });
              setLocale(lang.code);
            }}
            aria-current={lang.code === locale ? "true" : undefined}
            className={lang.code === locale ? "bg-muted/50 font-medium" : ""}
          >
            <span className="mr-2 text-base" aria-hidden="true">
              {lang.flag}
            </span>
            <span className="flex-1">{lang.nativeName}</span>
            <span className="text-xs text-muted-foreground">
              {lang.name}
            </span>
            {lang.code === locale && (
              <Check className="size-4 ml-2 text-primary" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}

        {/* Keyboard hint */}
        <div className="mt-1 border-t px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Command className="size-3" />
            <span>+</span>
            <Shuffle className="size-3" />
            <span>+</span>
            <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 font-mono text-[10px]">L</kbd>
            <span className="ml-1">{t("common.toggleLanguage") || "Toggle language"}</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
