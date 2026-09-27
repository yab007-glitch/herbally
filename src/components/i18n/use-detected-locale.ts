"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Detect the visitor's preferred locale from the browser, hydration-safely.
 *
 * Read as an external store (the same idiom `use-theme.ts` uses) so the server
 * snapshot is deterministic (`null`) and the first client render matches it.
 * The real value arrives on the client snapshot AFTER hydration.
 *
 * Previously this computed the value inside `useMemo`, which also runs during
 * the client's hydration render — so the server emitted no suggestion while
 * the client's first pass emitted one, producing React hydration error #418
 * (HERBALLY-5, the ongoing /fr hydration error).
 *
 * Consumers already treat `null` as "no suggestion", so the affordance simply
 * appears a tick later.
 */
function getSnapshot(): Locale | null {
  if (typeof window === "undefined") return null;

  const saved = localStorage.getItem("herbally-locale");
  if (saved) return null;

  const browserLang = navigator.language.split("-")[0];
  if (browserLang === "fr" || browserLang === "en") {
    return browserLang as Locale;
  }
  return null;
}

function getServerSnapshot(): Locale | null {
  // Must match the client's first render — the real value is read after
  // hydration via useSyncExternalStore's client snapshot.
  return null;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useDetectedLocale(): Locale | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
