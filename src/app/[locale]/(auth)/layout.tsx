import Link from "next/link";
import { Leaf } from "lucide-react";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { LocalizedLink } from "@/components/i18n/localized-link";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";

// Auth pages previously rendered only a logo above a centred card: no
// navigation, no footer, no FDA disclaimer, and no privacy/terms links.
// This layout reuses the shared marketing chrome while keeping the card
// centred, so signing in no longer feels like leaving the site. The mobile
// bar and floating chat launcher are intentionally left out here: auth
// pages are not app pages, and the navbar + footer already cover navigation.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2"
          aria-label="HerbAlly home"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-4" />
          </div>
          <span className="text-base font-semibold">
            Herb<span className="gradient-text">Ally</span>
          </span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
          aria-label={t("common.navFooter")}
        >
          <LocalizedLink href="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </LocalizedLink>
          <LocalizedLink href="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </LocalizedLink>
          <LocalizedLink href="/contact" className="hover:text-foreground">
            {t("footer.contact")}
          </LocalizedLink>
        </nav>
      </main>
      <MarketingFooter />
    </div>
  );
}
