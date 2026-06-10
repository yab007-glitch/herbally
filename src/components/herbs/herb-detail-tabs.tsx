"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const tabs = [
  { key: "overview", labelKey: "herbTabs.overview" },
  { key: "uses", labelKey: "herbTabs.uses" },
  { key: "science", labelKey: "herbTabs.science" },
  { key: "dosage", labelKey: "herbTabs.dosage" },
  { key: "safety", labelKey: "herbTabs.safety" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

interface HerbDetailTabsProps {
  children: (activeTab: TabKey) => React.ReactNode;
}

export function HerbDetailTabs({ children }: HerbDetailTabsProps) {
  const t = useTranslations();
  const [active, setActive] = useState<TabKey>("overview");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="sticky top-14 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                "relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
                active === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t(tab.labelKey)}
              {active === tab.key && (
                <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-primary opacity-0 sm:hidden" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content with fade transition */}
      <div className="animate-message-in">{children(active)}</div>
    </div>
  );
}
