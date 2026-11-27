import type { Locale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/seo/site-url";
import { getTranslations } from "next-intl/server";

export async function OrganizationSchema({ locale }: { locale: Locale }) {
  const base = siteUrl();
  // The site `url` and the publisher logo identify the site entity rather
  // than a page, so they stay at the root on every locale.
  const searchPath = locale === "fr" ? "/fr/herbs" : "/herbs";
  // This block is emitted on every page, French ones included. It carried a
  // hardcoded English description that also quoted "2,700+ herbs" — two
  // deploys out of date and the only English sentence left on a /fr page's
  // structured data (live QA finding).
  const t = await getTranslations({ locale, namespace: "seo" });
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HerbAlly",
    alternateName: "Herb Ally",
    url: base,
    inLanguage: locale === "fr" ? "fr-CA" : "en-CA",
    description: t("orgDesc"),
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: base,
      logo: {
        "@type": "ImageObject",
        url: `${base}/icon.svg`,
        width: 512,
        height: 512,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}${searchPath}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    sameAs: [
      "https://www.facebook.com/herballyapp",
      "https://www.linkedin.com/company/herbally-app",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
