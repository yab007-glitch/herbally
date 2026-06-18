"use client";

import { useCallback } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Switches locale by updating the cookie and performing a hard navigation.
 * A full reload guarantees the middleware sees the fresh cookie and serves
 * the correct language without any stale-layout or soft-navigation bugs.
 */
export function useSetLocale() {
  return useCallback((locale: Locale) => {
    // Persist preference in cookie (sent to server) and localStorage (client backup)
    document.cookie = `herbally-locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
    localStorage.setItem("herbally-locale", locale);

    // Compute the target URL based on the *current* browser location so we
    // land on the same page in the new language.
    const currentPath = window.location.pathname;
    let target = currentPath;

    if (locale === "fr") {
      if (!target.startsWith("/fr/")) {
        target = `/fr${target === "/" ? "/" : target}`;
      }
    } else {
      // en — strip /fr/ prefix
      if (target.startsWith("/fr/")) {
        target = target.replace(/^\/fr/, "") || "/";
      }
    }

    // Hard navigation: guarantees middleware sees the new cookie and
    // eliminates any stale state in the persistent root layout.
    window.location.assign(target);
  }, []);
}
