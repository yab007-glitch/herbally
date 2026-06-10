import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-muted/30 overflow-hidden">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
      <UnifiedMobileBar />
    </div>
  );
}
