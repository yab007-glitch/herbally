"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const tabConfig = [
  { key: "overview", labelKey: "herbTabs.overview" },
  { key: "uses", labelKey: "herbTabs.uses" },
  { key: "science", labelKey: "herbTabs.science" },
  { key: "dosage", labelKey: "herbTabs.dosage" },
  { key: "safety", labelKey: "herbTabs.safety" },
] as const;

type TabKey = (typeof tabConfig)[number]["key"];

export interface TabItem {
  key: TabKey;
  content: React.ReactNode;
}

interface HerbDetailTabsProps {
  tabs: TabItem[];
}

export function HerbDetailTabs({ tabs }: HerbDetailTabsProps) {
  const t = useTranslations();
  const [active, setActive] = useState<TabKey>("overview");

  // Desktop: tab bar
  return (
    <div>
      {/* Desktop tab bar */}
      <div className="hidden sm:block">
        <div className="sticky top-12 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {tabConfig.map((tab) => (
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
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 animate-message-in">
          {tabs.find((tab) => tab.key === active)?.content}
        </div>
      </div>

      {/* Mobile: accordion */}
      <div className="space-y-2 sm:hidden">
        {tabConfig.map((tab) => {
          const tabItem = tabs.find((t) => t.key === tab.key);
          const isOpen = active === tab.key;
          return (
            <div key={tab.key} className="rounded-xl border border-border">
              <button
                onClick={() => setActive(isOpen ? ("" as TabKey) : tab.key)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground"
              >
                {t(tab.labelKey)}
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 pb-4 pt-3 animate-message-in">
                  {tabItem?.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
