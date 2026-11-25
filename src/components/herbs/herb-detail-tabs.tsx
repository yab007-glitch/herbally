"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { HerbOverviewPanel } from "@/components/herbs/herb-overview-panel";
import { HerbUsesPanel } from "@/components/herbs/herb-uses-panel";
import { HerbSciencePanel } from "@/components/herbs/herb-science-panel";
import { HerbDosagePanel } from "@/components/herbs/herb-dosage-panel";
import { HerbSafetyPanel } from "@/components/herbs/herb-safety-panel";
import { PrintSafetyFooter } from "@/components/shared/print-safety-footer";
import type { Monograph } from "@/lib/data/monographs";
import type { CopyLocale } from "@/lib/i18n/herb-page-copy";

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

export interface MonographTabData {
  herb: {
    slug: string;
    description: string;
    provenance: Record<string, unknown> | null;
    traditional_uses: string[] | null;
    modern_uses: string[] | null;
    active_compounds: string[] | null;
    dosage_forms: string[] | null;
    dosage_adult: string | null;
    preparation_notes: string | null;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    contraindications: string[] | null;
    side_effects: string[] | null;
  };
  monograph: {
    slug: string;
    summary: string;
    mechanism: string;
    claims: Monograph["claims"];
  };
  isClinicallyReviewed: boolean;
  lastReviewed?: string;
  reviewedBy?: string;
  regulatorName: string | null;
  interactionCount: number;
  severityCounts: {
    contraindicated: number;
    severe: number;
    moderate: number;
    mild: number;
  };
  locale: CopyLocale;
}

interface HerbDetailTabsProps {
  tabs?: TabItem[];
  data?: MonographTabData;
}

function isTabKey(value: string): value is TabKey {
  return tabConfig.some((tab) => tab.key === value);
}

export function HerbDetailTabs({ tabs, data }: HerbDetailTabsProps) {
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

  const renderDataPanel = (key: TabKey): React.ReactNode => {
    if (!data) return null;
    switch (key) {
      case "overview":
        return (
          <HerbOverviewPanel
            herb={data.herb}
            monograph={{
              ...data.monograph,
              safetyNotes: [],
              drugInteractions: [],
              pregnancyCategory: "insufficient",
              keyCitations: [],
            }}
            lastReviewed={data.lastReviewed}
            reviewedBy={data.reviewedBy}
            isClinicallyReviewed={data.isClinicallyReviewed}
            locale={data.locale}
          />
        );
      case "uses":
        return <HerbUsesPanel herb={data.herb} />;
      case "science":
        return (
          <HerbSciencePanel
            herb={data.herb}
            monograph={{
              ...data.monograph,
              safetyNotes: [],
              drugInteractions: [],
              pregnancyCategory: "insufficient",
              keyCitations: [],
            }}
            locale={data.locale}
          />
        );
      case "dosage":
        return (
          <HerbDosagePanel
            herb={data.herb}
            regulatorName={data.regulatorName}
          />
        );
      case "safety":
        return (
          <HerbSafetyPanel
            herb={data.herb}
            interactionCount={data.interactionCount}
            severityCounts={data.severityCounts}
            showInteractions={false}
          />
        );
    }
  };

  return (
    <div ref={rootRef} className="scroll-mt-24">
      {/* Desktop: tab bar */}
      <div className="hidden sm:block">
        <div className="sticky top-12 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                type="button"
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
                type="button"
                onClick={() => {
                  if (isOpen) {
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

      {/* The single content render. Hidden while the mobile accordion is fully collapsed. */}
      {active ? (
        <div id="herb-tab-panel" className="mt-6 animate-message-in sm:mt-6">
          {data
            ? renderDataPanel(active)
            : tabs?.find((tab) => tab.key === active)?.content}
          {data && active !== "safety" && (
            <div className="print-only mt-6">
              <HerbSafetyPanel
                herb={data.herb}
                interactionCount={data.interactionCount}
                severityCounts={data.severityCounts}
                showInteractions={false}
              />
            </div>
          )}
          {data && (
            <div className="print-only">
              <PrintSafetyFooter locale={data.locale === "fr" ? "fr" : "en"} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
