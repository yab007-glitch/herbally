import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/profile", "/fr/profile"],
      },
      {
        // The site runs on the Hobby plan, where function CPU is a hard
        // constraint. Scrapers and training crawlers sweep all ~2,700 herb
        // pages repeatedly without sending search traffic. Googlebot/Bingbot
        // as well as search-engine bots (OAI-SearchBot, PerplexityBot) are allowed.
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          "Google-Extended",
          "Applebot-Extended",
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
