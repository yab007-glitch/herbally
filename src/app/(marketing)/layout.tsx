import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <UnifiedMobileBar />
    </div>
  );
}
