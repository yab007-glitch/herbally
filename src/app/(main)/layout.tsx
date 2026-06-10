import { UnifiedNavbar } from "@/components/layout/unified-navbar";
import { FDADisclaimerBanner } from "@/components/layout/fda-disclaimer-banner";
import { UnifiedMobileBar } from "@/components/layout/unified-mobile-bar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-muted/30 overflow-hidden">
      <FDADisclaimerBanner />
      <UnifiedNavbar />
      <main
        id="main-content"
        className="flex-1 pb-bottom-nav"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 overflow-y-auto">
          {children}
        </div>
      </main>
      <UnifiedMobileBar />
    </div>
  );
}
