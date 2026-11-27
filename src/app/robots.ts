import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const sharedDisallows = [
    "/admin/",
    "/admin",
    "/fr/admin/",
    "/fr/admin",
    "/api/",
    "/profile",
    "/fr/profile",
    // Query-string URLs that select a client-side state rather than a page:
    // /calculator?herb=, /herbalist?q=, /?herb=. Canonicalised URLs stay
    // excluded from crawl budget.
    "/*?herb=",
    "/*?q=",
    "/*?medications=",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: sharedDisallows,
      },
      {
        // Explicitly allow major search engines and AI browsing / retrieval /
        // answer-engine crawlers so HerbAlly is discoverable, readable, and
        // accurately cited across AI evaluations and health-reference search.
        userAgent: [
          "Googlebot",
          "Google-Extended",
          "Bingbot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "PerplexityBot",
          "Perplexity-User",
          "ClaudeBot",
          "Claude-Web",
          "Claude-SearchBot",
          "Claude-User",
          "Applebot",
          "Applebot-Extended",
          "DuckAssistBot",
        ],
        allow: "/",
        disallow: sharedDisallows,
      },
      {
        // Block low-value bulk scrapers and SEO backlink harvesters that consume
        // origin capacity without delivering search or reader referrals.
        userAgent: [
          "CCBot",
          "Bytespider",
          "Amazonbot",
          "meta-externalagent",
          "FacebookBot",
          "cohere-ai",
          "Diffbot",
          "Omgilibot",
          "YouBot",
          "AI2Bot",
          "Timpibot",
          "MJ12bot",
          "DotBot",
          "PetalBot",
          "Barkrowler",
          "DataForSeoBot",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
