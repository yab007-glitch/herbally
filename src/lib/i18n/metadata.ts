import type { Metadata } from "next";
import { getLocaleFromRequest } from "./server-locale";
import { getTranslations } from "next-intl/server";
import { buildAlternateUrls } from "./routing";
import type { Locale } from "./config";

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
).replace(/\/$/, "");

export interface PageMetaOptions {
  /** Translation key under the `meta` namespace, e.g. "herbsDatabase". */
  titleKey: string;
  /** Translation key under `meta` for the description. Defaults to appDescription. */
  descKey?: string;
  /** Path without locale prefix, e.g. "/herbs" or "/". */
  path: string;
}

/**
 * Build locale-aware page metadata. Title/description come from the `meta`
 * dictionary in the current locale (derived from the URL via the proxy
 * header), and canonical/hreflang alternates are generated from the path.
 */
export async function buildPageMetadata({
  titleKey,
  descKey,
  path,
}: PageMetaOptions): Promise<Metadata> {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t(titleKey);
  const description = descKey ? t(descKey) : t("appDescription");
  const alternates = buildAlternateUrls(path, BASE_URL);

  return {
    title,
    description,
    alternates: {
      canonical: alternates[locale],
      languages: {
        en: alternates.en,
        fr: alternates.fr,
        "x-default": alternates["x-default"],
      },
    },
    openGraph: {
      title,
      description,
      url: alternates[locale],
      type: "website",
      siteName: "HerbAlly",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export { BASE_URL };
export type { Locale };
