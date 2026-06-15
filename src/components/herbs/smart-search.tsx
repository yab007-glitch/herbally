"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  RecentSearches,
  useSaveSearch,
} from "@/components/herbs/recent-searches";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useTranslations } from "next-intl";
import { logger } from "@/lib/utils/logger";

interface SmartSearchProps {
  defaultValue?: string;
  category?: string;
}

export function SmartSearch({ defaultValue = "", category }: SmartSearchProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);
  const saveSearch = useSaveSearch();

  // Debounce the query value using the project's useDebounce hook
  const debouncedQuery = useDebounce(query, 300);

  // Build search URL - extracted to avoid recreating in effect
  const buildSearchUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();

      if (trimmed) {
        params.set("q", trimmed);
        saveSearch(trimmed);
      } else {
        params.delete("q");
      }

      if (category) {
        params.set("category", category);
      }

      return `/herbs?${params.toString()}`;
    },
    [category, searchParams, saveSearch]
  );

  // Update URL when debounced query changes (skip initial defaultValue)
  useEffect(() => {
    if (debouncedQuery && debouncedQuery !== defaultValue) {
      const url = buildSearchUrl(debouncedQuery);
      router.push(url);
    }
  }, [debouncedQuery, defaultValue, buildSearchUrl, router]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = buildSearchUrl(query);
    router.push(url);
  };

  const handleClear = () => {
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    if (category) {
      params.set("category", category);
    }
    router.push(`/herbs?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={handleChange}
            className="h-12 pl-10 pr-10 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("common.clearSearch")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="h-12">
          {t("search.search")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-2"
          onClick={async () => {
            try {
              const res = await fetch("/api/herbs/random");
              if (res.ok) {
                const data = await res.json();
                if (data?.slug) {
                  router.push(`/herbs/${data.slug}`);
                }
              }
            } catch (error) {
              logger.error("smart_search_random_herb", { error: error instanceof Error ? error.message : String(error) });
              router.push("/herbs");
            }
          }}
        >
          <Shuffle className="size-4" />
          {t("search.surpriseMe")}
        </Button>
      </form>
      <RecentSearches />
    </div>
  );
}
