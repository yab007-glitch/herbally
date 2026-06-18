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
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  // URL is the single source of truth: the proxy sets x-locale from the path,
  // and we mirror it here so the default metadata is localized for /fr/* too.
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("homeTitle");
  const description = t("appDescription");

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
    ),
    title: {
      default: title,
      template: `%s | HerbAlly`,
    },
    description,
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
      title,
      description,
      url: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      images: [{
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
