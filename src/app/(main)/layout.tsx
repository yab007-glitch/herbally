import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main
        id="main-content"
        className="flex-1 pb-bottom-nav"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
      <MarketingFooter />
      <UnifiedMobileBar />
    </div>
  );
}
