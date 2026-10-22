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
import { isLocale } from "@/lib/i18n/page-locale";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";

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
  // The URL is the single source of truth: the proxy maps it onto the
  // `[locale]` segment, and we read that root param here. No request header.
  const locale = await rootLocale();
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
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image"],
    },
  };
}

/**
 * The root layout lives under `[locale]`, so every rendered page has a locale
 * segment. `generateStaticParams` tells Next which values to prerender; the
 * proxy only ever produces `en` or `fr`, but validating here means an unknown
 * segment is a 404 rather than a silently English page.
 */
export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await rootLocale();
  if (!isLocale(locale)) {
    notFound();
  }

  // Enables static rendering for next-intl: message resolution reads this
  // value instead of falling back to a request API.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <link
          rel="preconnect"
          href="https://pnvltmyixympgammxvoo.supabase.co"
        />
        <link
          rel="dns-prefetch"
          href="https://pnvltmyixympgammxvoo.supabase.co"
        />
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
