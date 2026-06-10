import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { OrganizationSchema } from "@/components/seo/organization-schema";
import { SWRegistration } from "@/components/shared/service-worker-registration";
import { SkipToContent } from "@/components/shared/skip-to-content";
import { WebVitals } from "@/components/analytics/web-vitals";
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
  alternates: {
    canonical: "https://herbally.app",
  },
  openGraph: {
    type: "website",
    siteName: "HerbAlly",
    title: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    description:
      "Explore 2,700+ medicinal herbs, calculate dosages, and check drug interactions.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HerbAlly - Medicinal Herbs Database",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
    description:
      "Explore 2,700+ medicinal herbs, calculate dosages, and check drug interactions.",
    images: ["/og-image.png"],
  },
};

async function loadMessages(locale: string) {
  if (locale === "fr") {
    return (await import("@/lib/i18n/dictionaries/fr.json")).default;
  }
  return (await import("@/lib/i18n/dictionaries/en.json")).default;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale = localeCookie?.value === "fr" ? "fr" : "en";
  const messages = await loadMessages(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <OrganizationSchema />
      </head>
      <body className="bg-background text-foreground">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SkipToContent />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </NextIntlClientProvider>
        <SWRegistration />
        <WebVitals />
        <Analytics />
      </body>
    </html>
  );
}
