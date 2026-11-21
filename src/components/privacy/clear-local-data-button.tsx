"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const EXACT_KEYS = [
  "herbally-my-stack-v1",
  "herbally-recent-searches",
  "herbally-chat-session-id",
  "herbally-garden",
  "herbally-streak",
  "herbally-last-visit",
  "herbally-explored-herbs",
  "herbally-explored-count",
  "herbally.chat.teaser.dismissedAt",
  "herbally.chat.teaser.seen",
];

const KEY_PREFIXES = ["herbally-viewed-"];

function wipeStorage(storage: Storage | undefined) {
  if (!storage) return;
  for (const key of EXACT_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage access errors in restricted browsing modes
    }
  }
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && KEY_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      storage.removeItem(k);
    }
  } catch {
    // Ignore enumeration errors
  }
}

export function ClearLocalDataButton() {
  const t = useTranslations("privacy.localStorageSection");
  const fr = useLocale() === "fr";
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    if (typeof window !== "undefined") {
      wipeStorage(window.localStorage);
      wipeStorage(window.sessionStorage);
    }
    setCleared(true);
  }

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
          onClick={handleClear}
          className="shrink-0"
        >
          {cleared ? (
            <Check
              className="mr-1.5 size-4 text-emerald-600"
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
            ? "Toutes les données locales HerbAlly enregistrées dans ce navigateur ont été supprimées."
            : "All local HerbAlly browser data has been removed from this browser."}
        </p>
      )}
    </div>
  );
}
