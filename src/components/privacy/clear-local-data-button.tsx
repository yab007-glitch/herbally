"use client";

import { useState } from "react";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { clearAllLocalHerbAllyData } from "@/lib/privacy/storage-inventory";

export function ClearLocalDataButton() {
  const t = useTranslations("privacy.localStorageSection");
  const fr = useLocale() === "fr";
  const [status, setStatus] = useState<
    "idle" | "clearing" | "cleared" | "error"
  >("idle");

  async function handleClear() {
    setStatus("clearing");
    try {
      const result = await clearAllLocalHerbAllyData();
      setStatus(result.ok ? "cleared" : "error");
    } catch {
      setStatus("error");
    }
  }

  const cleared = status === "cleared";
  const failed = status === "error";
  const clearing = status === "clearing";

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t("controlTitle")}
          </p>
          <p className="text-xs text-muted-foreground">{t("controlDesc")}</p>
        </div>
        <Button
          type="button"
          variant={cleared ? "outline" : "secondary"}
          size="sm"
          disabled={clearing}
          onClick={handleClear}
          className="shrink-0"
        >
          {cleared ? (
            <Check
              className="mr-1.5 size-4 text-emerald-600"
              aria-hidden="true"
            />
          ) : failed ? (
            <AlertTriangle
              className="mr-1.5 size-4 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          )}
          {cleared ? t("clearedButton") : t("clearButton")}
        </Button>
      </div>
      {cleared && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
        >
          {fr
            ? "Les données locales HerbAlly (stockage local, session et cache navigateur) ont été supprimées de ce navigateur."
            : "Local HerbAlly browser data (local storage, session storage, and browser cache) has been removed from this browser."}
        </p>
      )}
      {failed && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-xs font-medium text-destructive"
        >
          {fr
            ? "Certaines données locales ou caches n'ont pas pu être supprimés par ce navigateur. Effacez manuellement les données du site dans les réglages du navigateur."
            : "Some browser storage or Cache Storage entries could not be cleared automatically. Please clear site data in your browser settings."}
        </p>
      )}
    </div>
  );
}
