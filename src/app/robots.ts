import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        // The site runs on the Hobby plan, where function CPU is a hard
        // constraint. These crawlers do not send search traffic but sweep all
        // ~2,700 herb pages repeatedly. Googlebot/Bingbot are unaffected.
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "CCBot",
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          "Google-Extended",
          "Applebot-Extended",
          "Bytespider",
          "Amazonbot",
          "PerplexityBot",
          "meta-externalagent",
          "FacebookBot",
          "cohere-ai",
          "Diffbot",
          "Omgilibot",
          "YouBot",
          "AI2Bot",
          "Timpibot",
          "AhrefsBot",
          "SemrushBot",
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
