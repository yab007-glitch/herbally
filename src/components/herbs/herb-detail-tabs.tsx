"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function isTabKey(value: string): value is TabKey {
  return tabConfig.some((tab) => tab.key === value);
}

export function HerbDetailTabs({ tabs }: HerbDetailTabsProps) {
  const t = useTranslations();
  const [active, setActive] = useState<TabKey>("overview");
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Deep links: `#safety` (from the hero's safety summary, or from a shared
   * link) must open that tab. Without this the hash did nothing on the tabbed
   * layout, because the safety content only exists once its tab is active.
   */
  useEffect(() => {
    const syncFromHash = () => {
      const key = window.location.hash.replace(/^#/, "");
      if (!isTabKey(key)) return;
      setActive(key);
      // The panel mounts after this render; scroll once it exists.
      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const selectTab = useCallback((key: TabKey) => {
    setActive(key);
    // Keep the URL shareable/back-button friendly without a server round trip.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${key}`);
    }
  }, []);

  // One content render, two navigation shells.
  //
  // The desktop tab panel and the mobile accordion used to each render the
  // active tab's content, so every herb page carried the same markup twice in
  // the DOM: two "Description" headings, ~100 KB of duplicated RSC payload in
  // a 212 KB document, and double the text for a crawler to read. The nav still
  // differs by viewport; the content now lives once, below both.
  return (
    <div ref={rootRef} className="scroll-mt-24">
      {/* Desktop: tab bar */}
      <div className="hidden sm:block">
        <div className="sticky top-12 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                aria-pressed={active === tab.key}
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
      </div>

      {/* Mobile: accordion headers, which select the panel rendered below */}
      <div className="space-y-2 sm:hidden">
        {tabConfig.map((tab) => {
          const isOpen = active === tab.key;
          return (
            <div key={tab.key} className="rounded-xl border border-border">
              <button
                onClick={() => {
                  if (isOpen) {
                    // Collapse without writing a "#" hash.
                    setActive("" as TabKey);
                  } else {
                    selectTab(tab.key);
                  }
                }}
                aria-expanded={isOpen}
                aria-controls="herb-tab-panel"
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
            </div>
          );
        })}
      </div>

      {/* The single content render. Hidden while the mobile accordion is fully
          collapsed, matching the previous behaviour. */}
      {active ? (
        <div id="herb-tab-panel" className="mt-6 animate-message-in sm:mt-6">
          {tabs.find((tab) => tab.key === active)?.content}
        </div>
      ) : null}
    </div>
  );
}
