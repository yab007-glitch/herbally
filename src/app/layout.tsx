import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { OrganizationSchema } from "@/components/seo/organization-schema";
import { SWRegistration } from "@/components/shared/service-worker-registration";
import { SkipToContent } from "@/components/shared/skip-to-content";
import { WebVitals } from "@/components/analytics/web-vitals";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
  ),
  title: {
    default: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    template: "%s | HerbAlly",
  },
  description:
    "Explore the world's largest medicinal herb database with 2,700+ herbs. Calculate safe dosages and check drug interactions with our AI-powered virtual herbalist.",
  keywords: [
    "medicinal herbs",
    "herbal medicine",
    "drug interactions",
    "dosage calculator",
    "herbal remedies",
    "natural medicine",
    "herb database",
    "virtual herbalist",
    "herb-drug interactions",
    "herbal supplements",
    "alternative medicine",
    "holistic health",
    "plant medicine",
    "phytotherapy",
  ],
  authors: [{ name: "HerbAlly Team" }],
  creator: "HerbAlly",
  publisher: "HerbAlly",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "HerbAlly",
    title: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    description:
      "Explore 2,700+ medicinal herbs, calculate dosages, and check drug interactions.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
    locale: "en_US",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    description:
      "Explore 2,700+ medicinal herbs, calculate dosages, and check drug interactions.",
    images: ["/twitter-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // URL is the single source of truth: the proxy sets x-locale from the path,
  // and we mirror it here so SSR, <html lang>, and the client provider all
  // agree — no cookie/URL drift, no hydration flash.
  const locale = await getLocaleFromRequest();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://pnvltmyixympgammxvoo.supabase.co" />
        <link rel="dns-prefetch" href="https://pnvltmyixympgammxvoo.supabase.co" />
        <OrganizationSchema />
      </head>
      <body className="bg-background text-foreground">
        <LocaleProvider locale={locale}>
          <SkipToContent />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </LocaleProvider>
        <SWRegistration />
        <WebVitals />
        <Analytics />
      </body>
    </html>
  );
}
