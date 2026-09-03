import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // NOTE: /garden, /profile, /login, /register, /reset-password and
      // /forgot-password are intentionally NOT disallowed here. They carry
      // `noindex` meta tags, and Google must be able to CRAWL a page to see
      // its noindex — disallowing them would hide the tag and leave
      // URL-only listings indexed (GSC showed /login drawing impressions).
      // /auth/ stays disallowed: it only serves the ?code= callback handler.
      disallow: ["/admin/", "/api/", "/auth/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
