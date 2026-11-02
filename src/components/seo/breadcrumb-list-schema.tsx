import { siteUrl } from "@/lib/seo/site-url";
import { getLocale } from "@/lib/i18n/page-locale";
import { addLocalePrefix, isLocalePrefixed } from "@/lib/i18n/routing";
import en from "@/lib/i18n/dictionaries/en.json";
import fr from "@/lib/i18n/dictionaries/fr.json";

interface Crumb {
  name: string;
  url: string;
}

/**
 * Standalone BreadcrumbList JSON-LD.
 *
 * Search Console's Breadcrumbs report (28 valid / 5,820 indexed, Sep 2026)
 * only counts top-level BreadcrumbList nodes. The previous implementation
 * nested breadcrumbs inside WebPage.breadcrumb, which Google largely ignores
 * for rich results. Render this alongside WebPageSchema on every indexable
 * content page (herbs, compare, calculator, symptoms, marketing).
 *
 * Locale handling lives here rather than in the 15 call sites: every page
 * passed the literal `"Home"` and an unprefixed `/`, so every French page
 * declared an English breadcrumb trail pointing at the English homepage.
 * Crumb URLs are prefixed with the active locale and the home label comes
 * from the dictionary; absolute (external) URLs pass through untouched.
 */
export async function BreadcrumbListSchema({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;
  const locale = await getLocale();
  const base = siteUrl();
  const homeLabel = locale === "fr" ? fr.common.home : en.common.home;

  // Callers pass a mix of paths (`/faq`) and absolute self-links
  // (`https://herbally.app/calculator`); both resolve to the active locale,
  // while a genuinely external URL is returned untouched.
  const localized = (url: string): string => {
    const path = url.startsWith(base) ? url.slice(base.length) || "/" : url;
    if (!path.startsWith("/")) return url;
    if (path === "/") return `${base}${locale === "fr" ? "/fr" : ""}`;
    if (isLocalePrefixed(path)) return `${base}${path}`;
    return `${base}${addLocalePrefix(path, locale)}`;
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      // "Home" is the sentinel every page passes; translate it rather than
      // leaking an English label into a French trail.
      name: crumb.name === "Home" ? homeLabel : crumb.name,
      item: localized(crumb.url),
    })),
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
