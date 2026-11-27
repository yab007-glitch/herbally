import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { DeferredFloatingChat } from "@/components/layout/deferred-floating-chat";
import { AdConsent } from "@/components/ads/ad-consent";
import { BackToTop } from "@/components/shared/back-to-top";

/**
 * Standard main-section page chrome shared by regular reference routes and
 * non-quarantined herb monograph pages.
 */
export function MainPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main id="main-content" className="flex-1 pb-bottom-nav">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <MarketingFooter />
      {/* Ad choice control. Renders nothing at all while the hard launch gate
          is off, so it costs no markup, no request and no banner today. */}
      <AdConsent />
      <UnifiedMobileBar />
      <DeferredFloatingChat />
      <BackToTop />
    </div>
  );
}
