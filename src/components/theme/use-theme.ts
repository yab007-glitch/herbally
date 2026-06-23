"use client";

import { useSyncExternalStore, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";

/**
 * Apply a theme to <html> by toggling the `light`/`dark` class. "system"
 * resolves via the prefers-color-scheme media query.
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

function getSnapshot(): Theme {
  // Guard against SSR / non-browser environments (defensive — this only runs
  // client-side via useSyncExternalStore, but jsdom tests may stub storage).
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) || "system";
}

function getServerSnapshot(): Theme {
  // M17 (audit 2026-06-22): the server and the first client render MUST agree
  // to avoid a hydration mismatch on the theme icon. The real client value is
  // read after hydration via useSyncExternalStore's client snapshot.
  return "system";
}

function subscribe(callback: () => void): () => void {
  // Re-resolve when the stored value changes (other tabs) OR when the system
  // preference flips while in "system" mode.
  window.addEventListener("storage", callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", callback);
  };
}

/**
 * Read the persisted theme as an external store (React 19 idiom).
 *
 * This replaces the older `useState("system") + useEffect(setState)` pattern,
 * which lint flags as setState-in-effect. useSyncExternalStore reads
 * client-only state (localStorage) without an effect-setState cycle and
 * keeps the server snapshot deterministic ("system") so the first client
 * render matches the server render (no hydration mismatch). The DOM
 * side-effect (applyTheme) runs in a separate effect keyed on `theme`.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sync the <html> class whenever the resolved theme changes (initial mount +
  // system-preference changes + explicit setTheme). This is an effect that
  // updates an external system (the DOM), which is the intended use of effect.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    // Dispatch a storage event so this tab's useSyncExternalStore re-reads
    // (the native storage event only fires for OTHER tabs).
    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY })
    );
  }, []);

  return { theme, setTheme };
}
