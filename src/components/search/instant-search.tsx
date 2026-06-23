"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useTranslations } from "next-intl";
import { logger } from "@/lib/utils/logger";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  evidence_level: string;
  category?: string;
  traditional_uses: string[];
}

interface InstantSearchProps {
  placeholder?: string;
  className?: string;
}

export function InstantSearch({ placeholder, className }: InstantSearchProps) {
  const t = useTranslations();
  const router = useRouter();
  const resolvedPlaceholder = placeholder || t("search.placeholder");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 150);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Abort the in-flight search request when a newer query supersedes it,
  // so a slow earlier response can't overwrite a faster newer one (race) and
  // we don't burn server work on stale queries.
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // Cancel any previous in-flight request before issuing a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/herbs/search?q=${encodeURIComponent(searchQuery)}&limit=8`,
        { signal: controller.signal }
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.herbs || []);
      }
    } catch (error) {
      // Aborted requests are expected when a newer query supersedes this one.
      if (error instanceof DOMException && error.name === "AbortError") return;
      logger.error("instant_search_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Only clear the spinner if this is still the active request; a
      // superseded request leaves loading state to its successor.
      if (abortRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  // Abort any in-flight search on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : prev));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        // Client-side nav instead of a full page reload (audit frontend Low,
        // conf 0.85): keeps SPA state and avoids refetching shared layout.
        router.push(`/herbs/${selected.slug}`);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          className="h-12 pl-10 pr-10"
          aria-label={t("search.search")}
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={isOpen && results.length > 0}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("common.clearSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isOpen && results.length > 0 && (
        <div
          id="search-results"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
          role="listbox"
        >
          <ul className="max-h-[400px] overflow-auto py-1">
            {results.map((herb, index) => (
              <li
                key={herb.id}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <Link
                  href={`/herbs/${herb.slug}`}
                  className={`flex items-center gap-3 px-4 py-2 hover:bg-accent ${
                    index === selectedIndex ? "bg-accent" : ""
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{herb.name}</span>
                      <EvidenceGrade
                        level={
                          herb.evidence_level as "A" | "B" | "C" | "D" | "trad"
                        }
                        showLabel={false}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {herb.scientific_name}
                    </p>
                    {herb.traditional_uses?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {herb.traditional_uses.slice(0, 3).map((use) => (
                          <Badge
                            key={use}
                            variant="outline"
                            className="text-xs"
                          >
                            {use}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
