"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import type { Locale } from "@/lib/i18n/config";
import {
  addLocalePrefix,
  isLocalePrefixed,
  stripLocalePrefix,
} from "@/lib/i18n/routing";

function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Prefix an internal pathname with the active locale (e.g. `/herbs` →
 * `/fr/herbs` when the UI is French). Already-prefixed and external hrefs
 * pass through untouched. Query strings and hashes are preserved because the
 * prefix is prepended to the whole href.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!isInternalPath(href) || isLocalePrefixed(href)) return href;
  return addLocalePrefix(href, locale);
}

/**
 * Locale-aware active check: strips `/fr` from the browser pathname before
 * comparing, so nav highlighting works on French pages too (previously
 * `pathname === "/herbs"` never matched `/fr/herbs`).
 */
export function isActivePath(
  pathname: string | null,
  href: string,
  exact = false
): boolean {
  if (!pathname) return false;
  const canonical = stripLocalePrefix(pathname);
  if (exact) return canonical === href;
  return canonical === href || canonical.startsWith(href + "/");
}

/**
 * Drop-in replacement for next/link that keeps users inside their locale.
 * Previously every header/footer link pointed at the unprefixed path, so
 * French users depended on a cookie redirect to stay on /fr/* — and
 * right-click/copy-link, crawlers, and prefetch all used the English URL.
 */
export function LocalizedLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const locale = useLocale() as Locale;
  return <Link href={localizeHref(href, locale)} {...rest} />;
}
