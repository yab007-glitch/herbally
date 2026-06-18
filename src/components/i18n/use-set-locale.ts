"use client";

import { useCallback } from "react";
import type { Locale } from "@/lib/i18n/config";
import {
  isLocalePrefixed,
  addLocalePrefix,
  stripLocalePrefix,
} from "@/lib/i18n/routing";

/**
 * Switches locale by performing a hard navigation to the correct URL.
 *
 * The URL is the single source of truth for the active locale:
 *   - French  → /fr prefix is added to the current path
 *   - English → /fr prefix is stripped from the current path
 *
 * The cookie/localStorage writes below are only a first-visit hint for the
 * proxy middleware's redirect; rendering is always driven by the URL, so the
 * two can never drift and cause partial translations.
 */
export function useSetLocale() {
  return useCallback((locale: Locale) => {
    // Persist preference as a first-visit redirect hint for the proxy.
    document.cookie = `herbally-locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
    localStorage.setItem("herbally-locale", locale);

    const currentPath = window.location.pathname;
    const alreadyPrefixed = isLocalePrefixed(currentPath);

    // Build the target URL from the *current browser path*. Using the canonical
    // routing helpers (instead of hand-rolled startsWith checks) guarantees
    // every path is handled, including the bare "/fr" homepage.
    const target =
      locale === "fr"
        ? alreadyPrefixed
          ? currentPath
          : addLocalePrefix(currentPath, "fr")
        : alreadyPrefixed
          ? stripLocalePrefix(currentPath)
          : currentPath;

    // Hard navigation guarantees the proxy sees the fresh URL and serves a
    // fully re-rendered page in the new language with no stale state.
    window.location.assign(target);
  }, []);
}
