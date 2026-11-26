"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  Search,
  Loader2,
  Leaf,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import {
  dedupeSymptomResults,
  sortSymptomResultsByRelevance,
} from "@/lib/search/symptom-results";
import {
  detectRedFlagSymptom,
  type RedFlagDetection,
} from "@/lib/safety/red-flag-symptoms";

interface HerbResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  evidence_level: string | null;
  isDangerous?: boolean;
  matchedBy: string;
  matchedKeywords?: string[];
  matchedInputs?: string[];
  aliases?: string[];
}

export function SymptomSearchClient() {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HerbResult[]>([]);
  const [redFlag, setRedFlag] = useState<RedFlagDetection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 5) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setHasSearched(true);

    const localRedFlag = detectRedFlagSymptom(q);
    if (localRedFlag.isRedFlag) {
      setRedFlag(localRedFlag);
      setResults([]);
      setIsLoading(false);
      return;
    }
    setRedFlag(null);

    try {
      // First try AI-powered keyword extraction. The AI keywords are
      // UNIONED with the user's own words, never used to replace them:
      // replacing dropped user terms (e.g. the AI returning "insomnia"
      // for a user who typed "sleep"), and with the one-way synonym map
      // that silently lost the sleep match entirely.
      const originalWords = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let keywords: string[] = originalWords;

      try {
        const aiRes = await fetch("/api/interpret-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (aiRes.ok) {
          const data = await aiRes.json();
          if (data?.redFlag && data?.guidance) {
            setRedFlag({
              isRedFlag: true,
              category: data.category,
              severity: data.severity ?? "emergency",
              guidance: data.guidance,
            });
            setResults([]);
            return;
          }
          if (data.keywords?.length > 0) {
            const aiKeywords = (data.keywords as string[]).map((k) =>
              k.toLowerCase()
            );
            keywords = Array.from(new Set([...originalWords, ...aiKeywords]));
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Fall back to raw query words
      }

      if (controller.signal.aborted) return;

      // Search herbs by keywords
      const searchTerm = keywords.join(" ");
      const res = await fetch("/api/herbs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchTerm }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      // De-duplicate by plant and order by relevance (matched search
      // terms first, then evidence grade) before capping at 12, so a
      // duplicate can never displace a distinct herb from the list.
      const processed = Array.isArray(data)
        ? sortSymptomResultsByRelevance(dedupeSymptomResults(data))
        : [];
      setResults(processed.slice(0, 12));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
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
            aria-label={t("symptomsPage.search")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {t("symptomsPage.search")}
            </span>
          </Button>
        </div>
      </form>

      {/* Example symptoms */}
      {!hasSearched && (
        <div className="mb-8 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {t("symptomsPage.privacyMinimizationNotice")}
          </p>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {t("symptomsPage.examples")}
          </p>
          <div className="flex flex-wrap gap-2">
            {t.raw("symptomsPage.exampleSymptoms").map((example: string) => (
              <button
                key={example}
                type="button"
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
          ) : redFlag?.isRedFlag ? (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl border-2 border-destructive/60 bg-destructive/10 p-6 text-foreground"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 size-6 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-destructive">
                    {redFlag.guidance?.[locale === "fr" ? "fr" : "en"]
                      ?.headline ??
                      (locale === "fr"
                        ? "Signe d'alerte détecté — consultez d'urgence"
                        : "Urgent warning symptom detected — seek emergency care")}
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {redFlag.guidance?.[locale === "fr" ? "fr" : "en"]?.body}
                  </p>
                  {redFlag.guidance?.[locale === "fr" ? "fr" : "en"]
                    ?.actions && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
                      {redFlag.guidance[
                        locale === "fr" ? "fr" : "en"
                      ].actions.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  )}
                  {redFlag.guidance?.[locale === "fr" ? "fr" : "en"]
                    ?.helpline && (
                    <p className="rounded-lg border border-destructive/30 bg-background/80 px-3 py-2 text-xs font-semibold text-destructive">
                      {redFlag.guidance[locale === "fr" ? "fr" : "en"].helpline}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                <Sparkles className="inline size-3.5 -mt-0.5 mr-1 text-primary" />
                {t("symptomsPage.foundHerbs", { count: results.length })}
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                {t("symptomsPage.orderingNote")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.map((herb) => (
                  <Link
                    key={herb.id}
                    href={`/herbs/${herb.slug}`}
                    className={`group flex items-center gap-4 rounded-xl border p-4 transition-all ${
                      herb.isDangerous
                        ? "border-destructive/50 bg-destructive/5 hover:border-destructive"
                        : "border-border hover:border-primary/30 hover:bg-accent/20"
                    }`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        herb.isDangerous
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      }`}
                    >
                      {herb.isDangerous ? (
                        <AlertTriangle className="size-5" aria-hidden="true" />
                      ) : (
                        <Leaf className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">
                        {herb.name}
                      </h3>
                      <p className="text-xs italic text-muted-foreground truncate">
                        {herb.scientific_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {herb.matchedInputs && herb.matchedInputs.length > 0
                          ? t("symptomsPage.matchReasonSymptom", {
                              symptoms: herb.matchedInputs.join(", "),
                            })
                          : herb.matchedBy === "symptom"
                            ? t("symptomsPage.matchReasonSymptomGeneral")
                            : t("symptomsPage.matchReasonName")}
                      </p>
                      {herb.aliases && herb.aliases.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("symptomsPage.alsoListedAs", {
                            names: herb.aliases.join(", "),
                          })}
                        </p>
                      )}
                      {herb.isDangerous ? (
                        <span className="mt-1 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          {locale === "fr"
                            ? "Plante toxique — ne pas utiliser"
                            : "Toxic plant — do not use"}
                        </span>
                      ) : (
                        herb.evidence_level && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {t("symptomsPage.evidenceLabel")}:{" "}
                            {herb.evidence_level}
                          </span>
                        )
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
