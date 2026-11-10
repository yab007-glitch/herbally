import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { FloatingChatButton } from "@/components/layout/floating-chat-button";
import { AdConsent } from "@/components/ads/ad-consent";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <AdConsent />
      <UnifiedMobileBar />
      <FloatingChatButton />
    </div>
  );
}
