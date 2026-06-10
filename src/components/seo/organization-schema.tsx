export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HerbAlly",
    alternateName: "Herb Ally",
    url: "https://herbally.app",
    description:
      "Explore the world's largest medicinal herb database with 2,700+ herbs. Calculate safe dosages and check drug interactions.",
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: "https://herbally.app",
      logo: {
        "@type": "ImageObject",
        url: "https://herbally.app/icon.svg",
        width: 512,
        height: 512,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://herbally.app/herbs?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    sameAs: ["https://www.facebook.com/herballyapp"],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
