interface WebPageSchemaProps {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  breadcrumbs?: { name: string; url: string }[];
}

export function WebPageSchema({
  title,
  description,
  url,
  datePublished,
  dateModified,
  author,
  breadcrumbs,
}: WebPageSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: "https://herbally.app",
      logo: {
        "@type": "ImageObject",
        url: "https://herbally.app/icon.svg",
      },
    },
  };

  if (datePublished) {
    schema.datePublished = datePublished;
  }
  if (dateModified) {
    schema.dateModified = dateModified;
  }
  if (author) {
    schema.author = {
      "@type": "Organization",
      name: author,
    };
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    schema.breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
