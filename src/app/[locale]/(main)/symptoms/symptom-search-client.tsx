"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Loader2, Leaf, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface HerbResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  evidence_level: string | null;
  matchedBy: string;
}

export function SymptomSearchClient() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HerbResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 5) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      // First try AI-powered keyword extraction
      let keywords: string[] = [q.trim().toLowerCase()];

      try {
        const aiRes = await fetch("/api/interpret-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        if (aiRes.ok) {
          const data = await aiRes.json();
          if (data.keywords?.length > 0) {
            keywords = data.keywords;
          }
        }
      } catch {
        // Fall back to raw query
      }

      // Search herbs by keywords
      const searchTerm = keywords.join(" ");
      const res = await fetch(
        `/api/herbs/search?q=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data.slice(0, 12) : []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(query);
  }

  return (
    <div>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("symptomsPage.searchPlaceholder")}
            aria-label={t("symptomsPage.searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-background px-5 py-4 text-base text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <Button
            type="submit"
            disabled={isLoading || query.trim().length < 5}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {t("symptomsPage.search")}
            </span>
          </Button>
        </div>
      </form>

      {/* Example symptoms */}
      {!hasSearched && (
        <div className="mb-8">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {t("symptomsPage.examples")}
          </p>
          <div className="flex flex-wrap gap-2">
            {t.raw("symptomsPage.exampleSymptoms").map((example: string) => (
              <button
                key={example}
                onClick={() => {
                  setQuery(example);
                  search(example);
                }}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors text-left"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">
                {t("symptomsPage.searching")}
              </span>
            </div>
          ) : results.length > 0 ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                <Sparkles className="inline size-3.5 -mt-0.5 mr-1 text-primary" />
                {t("symptomsPage.foundHerbs", { count: results.length })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.map((herb) => (
                  <Link
                    key={herb.id}
                    href={`/herbs/${herb.slug}`}
                    className="group flex items-center gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/30 hover:bg-accent/20"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Leaf className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">
                        {herb.name}
                      </h3>
                      <p className="text-xs italic text-muted-foreground truncate">
                        {herb.scientific_name}
                      </p>
                      {herb.evidence_level && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {t("symptomsPage.evidenceLabel")}:{" "}
                          {herb.evidence_level}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href={`/herbalist?q=${encodeURIComponent(query)}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Sparkles className="size-3.5" />
                  {t("symptomsPage.askAI")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {t("symptomsPage.noResults")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("symptomsPage.tryDifferent")}
              </p>
              <Link
                href={`/herbalist?q=${encodeURIComponent(query)}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Sparkles className="size-3.5" />
                {t("symptomsPage.askAIFallback")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
