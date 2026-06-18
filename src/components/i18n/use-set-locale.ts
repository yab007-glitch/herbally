"use client";

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

/**
 * Returns a function that switches the UI locale and navigates to the
 * correctly prefixed URL so the middleware can serve the right language
 * without a full reload.
 */
export function useSetLocale() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (locale: Locale) => {
      // 1. Persist preference
      document.cookie = `herbally-locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
      localStorage.setItem("herbally-locale", locale);

      // 2. Compute target URL
      let target = pathname;
      const isCurrentlyPrefixed = target.startsWith("/fr/");

      if (locale === "fr") {
        if (!isCurrentlyPrefixed) {
          target = `/fr${target === "/" ? "/" : target}`;
        }
      } else {
        // en — strip /fr/ prefix
        if (isCurrentlyPrefixed) {
          target = target.replace(/^\/fr/, "") || "/";
        }
      }

      // 3. Navigate smoothly instead of reloading
      router.push(target);
    },
    [router, pathname]
  );
}
