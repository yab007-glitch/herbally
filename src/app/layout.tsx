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
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  // Per-page hreflang is handled in individual page generateMetadata functions
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

const localeScript = `
  (function() {
    var m = document.cookie.match(/herbally-locale=([^;]+)/);
    if (m && m[1] === 'fr') document.documentElement.lang = 'fr';
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <OrganizationSchema />
        <script
          dangerouslySetInnerHTML={{ __html: localeScript }}
        />
      </head>
      <body className="bg-background text-foreground">
        <LocaleProvider>
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
