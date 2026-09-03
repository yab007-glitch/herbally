import { siteUrl } from "@/lib/seo/site-url";

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
 */
export function BreadcrumbListSchema({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;
  const base = siteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url.startsWith("http") ? crumb.url : `${base}${crumb.url}`,
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
