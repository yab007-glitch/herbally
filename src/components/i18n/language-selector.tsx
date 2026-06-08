"use client";

import { Globe, Check } from "lucide-react";
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

export function LanguageSelector() {
  const t = useTranslations();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const detectedLocale = useDetectedLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full h-11 min-w-11 px-2.5 hover:bg-muted hover:text-foreground transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <Globe className="size-5" />
        <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">
          {locale}
        </span>
        <span className="sr-only">{t("common.changeLanguage")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Detected language suggestion */}
        {detectedLocale && detectedLocale !== locale && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b">
            <span>{t("common.suggested")}</span>
            <button
              onClick={() => {
                trackEvent("language_changed", { locale: detectedLocale });
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
              trackEvent("language_changed", { locale: lang.code });
              setLocale(lang.code);
            }}
            className={lang.code === locale ? "bg-muted/50 font-medium" : ""}
          >
            <span className="mr-2 text-base" aria-hidden="true">
              {lang.flag}
            </span>
            {lang.nativeName}
            <span className="ml-auto text-xs text-muted-foreground">
              {lang.name}
            </span>
            {lang.code === locale && (
              <Check className="size-4 ml-2 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
