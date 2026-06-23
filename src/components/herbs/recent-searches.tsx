"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

const MAX_RECENT = 5;
const STORAGE_KEY = "herbally-recent-searches";

export function RecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    const loadSearches = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setSearches(JSON.parse(saved));
        } catch {
          // Ignore parse errors
        }
      }
      setMounted(true);
    };

    const timer = setTimeout(loadSearches, 0);
    return () => clearTimeout(timer);
  }, []);

  const clearSearch = (term: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = searches.filter((s) => s !== term);
    setSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAll = () => {
    setSearches([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!mounted || searches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>{t("recentSearches.title")}</span>
        </div>
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("recentSearches.clearAll")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((term) => (
          <Link key={term} href={`/herbs?q=${encodeURIComponent(term)}`}>
            <Badge
              variant="outline"
              className="group cursor-pointer border-border/50 bg-muted/30 transition-all hover:border-primary/50 hover:bg-primary/5 pr-6 relative"
            >
              {term}
              <button
                onClick={(e) => clearSearch(term, e)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Hook for saving searches
export function useSaveSearch() {
  return (query: string) => {
    if (!query.trim()) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    // L25 (audit 2026-06-22): guard the JSON.parse — a corrupted/tampered
    // localStorage value used to throw and abort saving the new search.
    let existing: string[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed))
          existing = parsed.filter((s) => typeof s === "string");
      } catch {
        existing = [];
      }
    }

    const updated = [
      query.trim(),
      ...existing.filter((s) => s !== query.trim()),
    ].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };
}
