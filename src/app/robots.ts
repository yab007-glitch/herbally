import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/admin",
          "/fr/admin/",
          "/fr/admin",
          "/api/",
          "/profile",
          "/fr/profile",
          // Query-string URLs that select a client-side state rather than a
          // page: /calculator?herb=, /herbalist?q=, /?herb=. Every one of them
          // canonicalises back to its base page, so Google crawls it, reads
          // the canonical and drops it — but only after spending crawl budget
          // that the real pages need. 1,787 of these sat in "Alternative page
          // with proper canonical tag", against 374 real pages waiting in
          // "Discovered - currently not indexed".
          //
          // Blocking here rather than nofollowing each link also stops the
          // next component that adds one, which is how the count grew to
          // 2,198 the first time.
          "/*?herb=",
          "/*?q=",
          "/*?medications=",
        ],
      },
      {
        // The site runs on the Hobby plan, where function CPU is a hard
        // constraint. Scrapers and training crawlers sweep all ~2,700 herb
        // pages repeatedly without sending search traffic. Googlebot/Bingbot
        // as well as search-engine bots (OAI-SearchBot, PerplexityBot) are allowed.
        userAgent: [
          "GPTBot",
          // NOT ChatGPT-User: that is the browsing agent behind a ChatGPT
          // answer, not a trainer. Blocking it stops the site being read — and
          // cited — in the place a growing share of health questions end.
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
