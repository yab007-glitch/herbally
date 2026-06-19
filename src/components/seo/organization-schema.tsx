import { siteUrl } from "@/lib/seo/site-url";

export function OrganizationSchema() {
  const base = siteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HerbAlly",
    alternateName: "Herb Ally",
    url: base,
    description:
      "Explore the world's largest medicinal herb database with 2,700+ herbs. Calculate safe dosages and check drug interactions.",
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
        urlTemplate: `${base}/herbs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    sameAs: ["https://www.facebook.com/herballyapp"],
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
