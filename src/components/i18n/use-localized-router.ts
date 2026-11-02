"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { localizeHref } from "./localized-link";

type NavigateOptions = { scroll?: boolean };

/**
 * `useRouter` that keeps client-side navigation inside the active locale.
 *
 * `LocalizedLink` fixes anchors, but imperative navigation bypassed it
 * entirely: searching on `/fr/herbs` pushed `/herbs?q=…` and dropped the
 * visitor back into English. Every internal push/replace now runs through
 * `localizeHref`, so the same prefix rule governs links and redirects.
 */
export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale() as Locale;

  return useMemo(
    () => ({
      // Pass `options` only when the caller did: an explicit `undefined`
      // second argument is not the same call as a one-argument push, and
      // tests (rightly) assert on the exact call shape.
      push: (href: string, options?: NavigateOptions) =>
        options
          ? router.push(localizeHref(href, locale), options)
          : router.push(localizeHref(href, locale)),
      replace: (href: string, options?: NavigateOptions) =>
        options
          ? router.replace(localizeHref(href, locale), options)
          : router.replace(localizeHref(href, locale)),
      prefetch: (href: string) => router.prefetch(localizeHref(href, locale)),
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
    }),
    [router, locale]
  );
}
