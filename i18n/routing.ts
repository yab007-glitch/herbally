import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
  localeCookie: {
    name: "herbally-locale",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  },
});
