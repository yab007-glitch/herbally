import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { FloatingChatButton } from "@/components/layout/floating-chat-button";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main id="main-content" className="flex-1 pb-bottom-nav">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <MarketingFooter />
      <UnifiedMobileBar />
      <FloatingChatButton />
    </div>
  );
}
