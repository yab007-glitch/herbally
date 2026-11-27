import { siteUrl } from "@/lib/seo/site-url";

interface WebApplicationSchemaProps {
  name: string;
  description: string;
  url: string;
  featureList: readonly string[];
  applicationCategory?: string;
}

/**
 * Schema.org WebApplication JSON-LD for HerbAlly's free public tools
 * (NPN Decoder, Pre-Surgery Checklist, Adult Monograph Reference, Widgets).
 */
export function WebApplicationSchema({
  name,
  description,
  url,
  featureList,
  applicationCategory = "HealthApplication",
}: WebApplicationSchemaProps) {
  const baseUrl = siteUrl();
  const payload = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory,
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    inLanguage: ["en", "fr"],
    featureList: [...featureList],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
    },
    publisher: {
      "@type": "Organization",
      name: "HerbAlly",
      url: baseUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
