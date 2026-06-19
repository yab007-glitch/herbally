import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace from the project dir so `node .next/standalone/server.js` is at a
  // flat, consistent path (matches the Dockerfile + Playwright webServer).
  outputFileTracingRoot: process.cwd(),
  experimental: {
    optimizePackageImports: ["lucide-react", "react-markdown"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  compress: true,
  trailingSlash: false,
  // Preserve deep links from the old home-page chat IA. `/?herb=ginger` and
  // `/?medications=warfarin` style URLs must continue to reach the chat.
  // Bare `/` falls through to the new marketing landing page.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "herb" }],
        destination: "/herbalist",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "query", key: "medications" }],
        destination: "/herbalist",
        permanent: true,
      },
    ];
  },
};

export default bundleAnalyzer(
  withSentryConfig(withNextIntl(nextConfig), {
    org: process.env.SENTRY_ORG || "",
    project: process.env.SENTRY_PROJECT || "",
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Upload wider set of client source files for better stack trace resolution
    widenClientFileUpload: true,
    // Create a proxy API route to bypass ad-blockers
    tunnelRoute: "/monitoring",
    // Suppress non-CI output
    silent: !process.env.CI,
  })
);
