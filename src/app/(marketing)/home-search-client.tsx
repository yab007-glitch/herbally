"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles } from "lucide-react";

type Labels = {
  herbPlaceholder: string;
  medPlaceholder: string;
  checkButton: string;
  suggestionsTitle: string;
  suggestion1: string;
  suggestion2: string;
  suggestion3: string;
  suggestion4: string;
  trustLine: string;
};

interface HerbResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
}

const SUGGESTIONS = [
  { herb: "St. John's Wort", med: "SSRI antidepressants", query: "Is St. John's Wort safe to take with SSRIs?" },
  { herb: "Turmeric", med: "blood thinners like warfarin", query: "Can I take turmeric with blood thinners?" },
  { herb: "Ginkgo biloba", med: "aspirin", query: "Is ginkgo safe with aspirin?" },
  { herb: "Echinacea", med: "immunosuppressants", query: "Can I take echinacea with immunosuppressants?" },
];

export function HomeSearchClient({ labels }: { labels: Labels }) {
  const router = useRouter();
  const [herbInput, setHerbInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [herbResults, setHerbResults] = useState<HerbResult[]>([]);
  const [showHerbResults, setShowHerbResults] = useState(false);
  const [activeHerbIndex, setActiveHerbIndex] = useState(-1);
  const herbRef = useRef<HTMLInputElement>(null);
  const medRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const searchHerbs = useCallback(async (term: string) => {
    if (term.length < 2) {
      setHerbResults([]);
      setShowHerbResults(false);
      return;
    }
    try {
      const res = await fetch(`/api/herbs/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setHerbResults(Array.isArray(data) ? data.slice(0, 5) : []);
      setShowHerbResults(true);
      setActiveHerbIndex(-1);
    } catch {
      setHerbResults([]);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchHerbs(herbInput), 200);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [herbInput, searchHerbs]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node) &&
          herbRef.current && !herbRef.current.contains(e.target as Node)) {
        setShowHerbResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleCheck() {
    const herbName = herbInput.trim();
    const medName = medInput.trim();
    if (!herbName && !medName) return;
    let query = "";
    if (herbName && medName) {
      query = `Is ${herbName} safe to take with ${medName}?`;
    } else if (herbName) {
      query = `Tell me about ${herbName}`;
    } else {
      query = `Tell me about ${medName}`;
    }
    router.push(`/herbalist?q=${encodeURIComponent(query)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (showHerbResults && activeHerbIndex >= 0 && herbResults[activeHerbIndex]) {
        selectHerb(herbResults[activeHerbIndex]);
        return;
      }
      handleCheck();
      return;
    }
    if (e.key === "ArrowDown" && showHerbResults) {
      e.preventDefault();
      setActiveHerbIndex(i => Math.min(i + 1, herbResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && showHerbResults) {
      e.preventDefault();
      setActiveHerbIndex(i => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Escape") {
      setShowHerbResults(false);
    }
  }

  function selectHerb(herb: HerbResult) {
    setHerbInput(herb.name);
    setShowHerbResults(false);
    medRef.current?.focus();
  }

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        {/* Two-input interaction checker */}
        <div className="mt-8 space-y-3">
          <div className="relative">
            <input
              ref={herbRef}
              type="text"
              value={herbInput}
              onChange={(e) => setHerbInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => herbInput.length >= 2 && setShowHerbResults(true)}
              placeholder={labels.herbPlaceholder}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              autoComplete="off"
            />
            {showHerbResults && herbResults.length > 0 && (
              <div
                ref={resultsRef}
                className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-background shadow-lg"
              >
                {herbResults.map((herb, i) => (
                  <button
                    key={herb.id}
                    onClick={() => selectHerb(herb)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      i === activeHerbIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium text-foreground">{herb.name}</span>
                    <span className="text-xs italic text-muted-foreground">{herb.scientific_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span className="block h-px flex-1 bg-border" />
            <span className="px-2">+</span>
            <span className="block h-px flex-1 bg-border" />
          </div>

          <input
            ref={medRef}
            type="text"
            value={medInput}
            onChange={(e) => setMedInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder={labels.medPlaceholder}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />

          <Button
            onClick={handleCheck}
            className="w-full rounded-xl py-3 text-sm font-medium"
            size="lg"
          >
            <ShieldCheck className="size-4" />
            {labels.checkButton}
          </Button>
        </div>

        {/* Quick suggestions */}
        <div className="mt-8">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {labels.suggestionsTitle}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => router.push(`/herbalist?q=${encodeURIComponent(s.query)}`)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                {labels[`suggestion${i + 1}` as keyof Labels] || s.query}
              </button>
            ))}
          </div>
        </div>

        {/* Quick link to symptom search */}
        <div className="mt-6">
          <button
            onClick={() => router.push("/symptoms")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="size-3.5" />
            Not sure which herb? Describe your symptoms →
          </button>
        </div>

        {/* Trust line */}
        <p className="mt-8 text-xs text-muted-foreground">
          <ShieldCheck className="inline size-3 -mt-0.5 mr-1" />
          {labels.trustLine}
        </p>
      </div>
    </div>
  );
}
