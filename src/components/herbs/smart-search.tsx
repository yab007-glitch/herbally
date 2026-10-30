"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Shuffle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  RecentSearches,
  useSaveSearch,
} from "@/components/herbs/recent-searches";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { buildHerbListUrl } from "@/lib/search/herb-list-url";
import { useTranslations } from "next-intl";
import { logger } from "@/lib/utils/logger";

interface SmartSearchProps {
  defaultValue?: string;
  category?: string;
  sort?: string;
}

export function SmartSearch({
  defaultValue = "",
  category,
  sort,
}: SmartSearchProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  // The random-herb button fetches before navigating; without this it
  // gave no feedback at all while the fetch resolved (the same "appeared
  // dead" symptom as the old Surprise Me button).
  const [randomLoading, setRandomLoading] = useState(false);
  const saveSearch = useSaveSearch();
  const lastNavigatedQ = useRef<string | null>(null);

  // Debounce the query value using the project's useDebounce hook
  const debouncedQuery = useDebounce(query, 300);

  // The URL query parameter, not the initial prop, is the source of truth.
  // Without this, back/forward navigation and category links leave a stale
  // value in the input, and the debounced effect below compares against a
  // stale defaultValue — the combination that made the first search on a
  // fresh page look like it did nothing.
  const urlQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    setQuery(urlQuery);
    lastNavigatedQ.current = urlQuery;
  }, [urlQuery]);

  // Build the canonical search URL for a value. Searching always resets
  // to page 1: previously the current ?page= was preserved, so searching
  // from page 5 could land on an empty or out-of-range page.
  const buildSearchUrl = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      return buildHerbListUrl({
        q: trimmed || undefined,
        category,
        sort,
        anchor: null,
      });
    },
    [category, sort]
  );

  // Live search: when the debounced value differs from the URL, replace
  // the URL (replace, not push, so typing does not flood history). An
  // empty debounced value clears the search — previously only the X
  // button could clear it, and backspacing to empty did nothing.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed === (lastNavigatedQ.current ?? "").trim()) return;
    const url = buildSearchUrl(debouncedQuery);
    lastNavigatedQ.current = trimmed;
    if (trimmed) saveSearch(trimmed);
    startTransition(() => {
      router.replace(url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) saveSearch(trimmed);
    lastNavigatedQ.current = trimmed;
    const url = buildSearchUrl(query);
    startTransition(() => {
      router.push(url);
    });
  };

  const handleClear = () => {
    setQuery("");
    lastNavigatedQ.current = "";
    const url = buildSearchUrl("");
    startTransition(() => {
      router.push(url);
    });
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
            aria-label={t("search.placeholder")}
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
        <Button type="submit" className="h-12" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t("search.searching") : t("search.search")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-2"
          disabled={isPending || randomLoading}
          aria-busy={randomLoading}
          onClick={async () => {
            setRandomLoading(true);
            try {
              const res = await fetch("/api/herbs/random");
              if (res.ok) {
                const data = await res.json();
                if (data?.slug) {
                  router.push(`/herbs/${data.slug}`);
                }
              }
            } catch (error) {
              logger.error("smart_search_random_herb", {
                error: error instanceof Error ? error.message : String(error),
              });
              router.push("/herbs");
            } finally {
              setRandomLoading(false);
            }
          }}
        >
          {randomLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Shuffle className="size-4" />
          )}
          {t("search.surpriseMe")}
        </Button>
      </form>
      <RecentSearches />
    </div>
  );
}
