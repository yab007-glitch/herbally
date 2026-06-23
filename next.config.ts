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
  // Don't advertise the runtime/framework in response headers.
  poweredByHeader: false,
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
  // L15 (audit 2026-06-22): the proxy (middleware) matcher excludes static
  // asset extensions, so those responses never received CSP/HSTS/X-Frame-Options
  // and could be framed/fetched without the same protections. Apply the same
  // baseline security headers to static assets here at the config level so the
  // protection is uniform regardless of the proxy matcher.
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' *.stripe.com",
          "connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com",
          "img-src 'self' data: blob: https://*.supabase.co",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "frame-src *.stripe.com",
          "frame-ancestors 'none'",
        ].join("; "),
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
        source:
          "/:path*{svg,png,jpg,jpeg,gif,webp,ico,woff,woff2,ttf,eot,css,js}",
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
