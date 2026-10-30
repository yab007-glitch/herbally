import type { Metadata } from "next";
import { getLocale } from "./page-locale";
import { getTranslations } from "next-intl/server";
import { buildAlternateUrls } from "./routing";
import type { Locale } from "./config";

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
).replace(/\/$/, "");

/** The "website" flavour of Next's Open Graph type, which this helper builds. */
type WebsiteOpenGraph = Extract<
  NonNullable<Metadata["openGraph"]>,
  { type: "website" }
>;

/**
 * Per-page Open Graph fields. Merged *over* the shared defaults in
 * `buildPageMetadata`, so a page that supplies its own `openGraph` keeps
 * `og:image` and `og:locale` unless it overrides those keys explicitly.
 */
export type PageOpenGraph = Partial<Omit<WebsiteOpenGraph, "type">> & {
  type?: "website";
};

export interface PageMetaOptions {
  /** Translation key under the `meta` namespace, e.g. "herbsDatabase". */
  titleKey: string;
  /** Translation key under `meta` for the description. Defaults to appDescription. */
  descKey?: string;
  /** Path without locale prefix, e.g. "/herbs" or "/". */
  path: string;
  /**
   * Extra Open Graph fields for this page. Merged over the defaults so
   * overriding title/description cannot drop og:image or og:locale.
   */
  openGraph?: PageOpenGraph;
}

/**
 * Build locale-aware page metadata. Title/description come from the `meta`
 * dictionary in the current locale (read from the `[locale]` root param), and
 * canonical/hreflang alternates are generated from the public path.
 */
export async function buildPageMetadata({
  titleKey,
  descKey,
  path,
  openGraph: openGraphOverrides,
}: PageMetaOptions): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t(titleKey);
  const description = descKey ? t(descKey) : t("appDescription");
  const alternates = buildAlternateUrls(path, BASE_URL);

  // Next does not deep-merge a page's openGraph with the layout's: whatever a
  // page returns replaces the inherited object wholesale. These are therefore
  // the complete defaults every page needs, and page-level overrides are
  // spread on top of them rather than replacing them.
  const sharedOpenGraph: WebsiteOpenGraph = {
    title,
    description,
    url: alternates[locale],
    type: "website",
    siteName: "HerbAlly",
    locale: locale === "fr" ? "fr_FR" : "en_US",
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
      },
    ],
  };

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
    openGraph: { ...sharedOpenGraph, ...openGraphOverrides },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export { BASE_URL };
export type { Locale };
