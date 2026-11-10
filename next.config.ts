import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import herbMergeRedirects from "./data/herb-merge-redirects.json";
import herbSlugRenames from "./data/herb-slug-renames.json";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Standalone output is for Docker/self-host only (`node
  // .next/standalone/server.js`). On Vercel it must be OFF: Vercel's build
  // hook expects the default trace layout (.next/*.nft.json), and Next 16.3
  // changed the standalone trace layout, breaking Vercel's onBuildComplete
  // with ENOENT on .next/next-server.js.nft.json. Vercel sets VERCEL=1.
  ...(process.env.VERCEL
    ? {}
    : {
        output: "standalone" as const,
        // Trace from the project dir so `node .next/standalone/server.js` is
        // at a flat, consistent path (matches Dockerfile + Playwright
        // webServer).
        outputFileTracingRoot: process.cwd(),
      }),
  // Don't advertise the runtime/framework in response headers.
  poweredByHeader: false,
  // Build-time static generation is DB-backed (symptom hubs, herb pages,
  // sitemap). Next's default per-page cap is 60s; when Supabase answers slowly
  // a single symptom hub can exceed it, the page is retried, and the whole
  // deploy dies with BUILD_UTILS_SPAWN_1 ("npm run build" exited with 1) —
  // observed 2026-11-02 on commit 75eaee54, where /fr/symptoms/* took >60s and
  // the sitemap exhausted its 40s DB budget. Give each page room to finish
  // instead of failing the deployment; a genuinely broken query still fails,
  // just later. Vercel's build ceiling (45 min) is the outer bound.
  staticPageGenerationTimeout: 180,
  experimental: {
    optimizePackageImports: ["lucide-react", "react-markdown"],
  },
  images: {
    // Constrain the variant matrix. The defaults are 8 device widths × 7 icon
    // widths × 2 formats, so one photo can produce up to 30 derivatives; every
    // derivative is a billed transformation and a billed cache write. The app
    // has only three <Image> call sites, and their `sizes` props resolve to
    // widths covered by these breakpoints. `qualities` is required in Next 16;
    // 75 is the global default and no call site overrides it.
    deviceSizes: [640, 1080, 1920],
    imageSizes: [96, 128, 256, 384],
    qualities: [75],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Botanical photographs come from Wikimedia Commons; every one carries its
      // author and licence in provenance.image and is credited under the figure.
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  compress: true,
  trailingSlash: false,
  // L15 (audit 2026-06-22): the proxy (middleware) matcher excludes static
  // asset extensions, so those responses never received HSTS/X-Frame-Options
  // and could be framed/fetched without the same protections. Apply the same
  // baseline security headers to static assets here at the config level so the
  // protection is uniform regardless of the proxy matcher.
  //
  // Content-Security-Policy is deliberately NOT set here. Two policies on one
  // response are enforced as an intersection, so a config-level policy would
  // silently veto any directive the proxy widens for an ad-eligible document
  // (see src/lib/ads/csp.ts) — ads would fail to load even with the gate on,
  // while every sensitive page still looked correctly locked down. The proxy
  // is the only layer that can decide per request, so it owns the document
  // CSP outright; it covers every document route (its matcher only skips
  // non-document asset paths). CSP is not enforced on non-document responses,
  // so nothing is lost for statics.
  //
  // NOTE (embed framing): X-Frame-Options and CSP frame-ancestors are
  // likewise owned exclusively by src/proxy.ts, which must exempt /embed/*
  // (partner iframes). Config-level headers merge over middleware deletions,
  // so allowlisting there is the only way to un-frame a route.
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ]
        : []),
    ];
    return [
      {
        // Apply to ALL routes (including static assets). The proxy matcher
        // excludes statics, so next.config headers is the uniform layer.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Preserve deep links from the old home-page chat IA. `/?herb=ginger` and
  // `/?medications=warfarin` style URLs must continue to reach the chat.
  // Bare `/` falls through to the new marketing landing page.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "herb" }],
        destination: "/herbalist",
        statusCode: 301,
      },
      {
        source: "/",
        has: [{ type: "query", key: "medications" }],
        destination: "/herbalist",
        statusCode: 301,
      },
      {
        source: "/herbs/ginkgo",
        destination: "/herbs/ginkgo-biloba",
        statusCode: 301,
      },
      {
        source: "/:locale(en|fr)/herbs/ginkgo",
        destination: "/:locale/herbs/ginkgo-biloba",
        statusCode: 301,
      },
      // The interaction hub has lived at /herb-drug-interactions since launch,
      // but "interactions" is the shorter, more guessable URL — people and
      // crawlers try it, and it 404'd. Same for the pair pattern written with
      // the hub as its prefix.
      {
        source: "/interactions",
        destination: "/herb-drug-interactions",
        statusCode: 301,
      },
      {
        source: "/:locale(en|fr)/interactions",
        destination: "/:locale/herb-drug-interactions",
        statusCode: 301,
      },
      {
        source: "/herb-drug-interactions/:herb/:drug",
        destination: "/interactions/:herb/:drug",
        statusCode: 301,
      },
      {
        source: "/:locale(en|fr)/herb-drug-interactions/:herb/:drug",
        destination: "/:locale/interactions/:herb/:drug",
        statusCode: 301,
      },
      // Search Console reported /pharmacist as a 404: it was a real URL people
      // followed, and the herbalist page is what it meant.
      { source: "/pharmacist", destination: "/herbalist", permanent: true },
      {
        source: "/:locale(en|fr)/pharmacist",
        destination: "/:locale/herbalist",
        permanent: true,
      },
      // Merged duplicate herbs. Each pair was reviewed (same species, same part
      // or preparation) and the duplicate was unpublished rather than deleted,
      // so the old URL still resolves through a permanent redirect instead of
      // 404ing on a page that has real historical traffic.
      // Corrected species names: the old slug was a misspelling of the accepted
      // name, so the URL moved once the name was fixed. Same permanent-redirect
      // treatment as the merges — the old URL has traffic and should not 404.
      ...(herbSlugRenames.activation === "active"
        ? herbSlugRenames.renames.flatMap(({ from, to }) => [
            { source: from, destination: to, permanent: true },
            { source: `/fr${from}`, destination: `/fr${to}`, permanent: true },
          ])
        : []),
      ...herbMergeRedirects.flatMap(({ from, to }) => [
        { source: from, destination: to, permanent: true },
        {
          source: `/fr${from}`,
          destination: `/fr${to}`,
          permanent: true,
        },
      ]),
    ];
  },
};

export default bundleAnalyzer(
  withSentryConfig(withNextIntl(nextConfig), {
    org: process.env.SENTRY_ORG || "",
    project: process.env.SENTRY_PROJECT || "",
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Create a proxy API route to bypass ad-blockers
    tunnelRoute: "/monitoring",
    // Suppress non-CI output
    silent: !process.env.CI,
  })
);
