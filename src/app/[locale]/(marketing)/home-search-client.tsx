"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, MessageCircle } from "lucide-react";

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
  symptomsLink: string;
  emptyCheckError: string;
  sameCheckError: string;
  checking: string;
  checkerFoundTitle: string;
  checkerAskHerbalist: string;
  checkerViewPair: string;
  checkerViewHerb: string;
  checkerDisclaimer: string;
  checkerNotFoundTitle: string;
  checkerNotFoundBody: string;
  checkerAiNote: string;
  checkerError: string;
  checkerSource: string;
  checkerEvidence: string;
  checkerMechanism: string;
  severityMild: string;
  severityModerate: string;
  severitySevere: string;
  severityContraindicated: string;
};

interface HerbResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
}

interface CheckPair {
  id: string;
  drugName: string;
  severity: "mild" | "moderate" | "severe" | "contraindicated";
  description: string;
  mechanism: string | null;
  evidenceLevel: string | null;
  source: string | null;
  sourceUrl: string | null;
  pairUrl: string;
}

type CheckResult =
  | {
      found: true;
      herb: { slug: string; name: string };
      pair: CheckPair;
    }
  | {
      found: false;
      herb: { slug: string; name: string } | null;
      unavailable?: boolean;
    };

const SEVERITY_STYLES: Record<CheckPair["severity"], string> = {
  mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  moderate:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  contraindicated:
    "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200",
};

const SUGGESTIONS = [
  {
    herb: "St. John's Wort",
    med: "SSRI antidepressants",
    query: "Is St. John's Wort safe to take with SSRIs?",
  },
  {
    herb: "Turmeric",
    med: "blood thinners like warfarin",
    query: "Can I take turmeric with blood thinners?",
  },
  {
    herb: "Ginkgo biloba",
    med: "aspirin",
    query: "Is ginkgo safe with aspirin?",
  },
  {
    herb: "Echinacea",
    med: "immunosuppressants",
    query: "Can I take echinacea with immunosuppressants?",
  },
];

export function HomeSearchClient({ labels }: { labels: Labels }) {
  const router = useRouter();
  const [herbInput, setHerbInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [herbResults, setHerbResults] = useState<HerbResult[]>([]);
  const [showHerbResults, setShowHerbResults] = useState(false);
  const [activeHerbIndex, setActiveHerbIndex] = useState(-1);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const herbRef = useRef<HTMLInputElement>(null);
  const medRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchAbort = useRef<AbortController | null>(null);
  const justSelected = useRef<string | null>(null);

  const searchHerbs = useCallback(async (term: string) => {
    if (term.length < 2) {
      setHerbResults([]);
      setShowHerbResults(false);
      return;
    }
    if (justSelected.current !== null && term === justSelected.current) {
      setShowHerbResults(false);
      return;
    }
    justSelected.current = null;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    try {
      const res = await fetch(
        `/api/herbs/search?q=${encodeURIComponent(term)}`,
        { signal: controller.signal }
      );
      const data = await res.json();
      setHerbResults(Array.isArray(data) ? data.slice(0, 5) : []);
      setShowHerbResults(true);
      setActiveHerbIndex(-1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setHerbResults([]);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchHerbs(herbInput), 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [herbInput, searchHerbs]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node) &&
        herbRef.current &&
        !herbRef.current.contains(e.target as Node)
      ) {
        setShowHerbResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCheck(herbOverride?: string, medOverride?: string) {
    setShowHerbResults(false);
    const herbName = (herbOverride ?? herbInput).trim();
    const medName = (medOverride ?? medInput).trim();
    if (!herbName && !medName) {
      setCheckError(labels.emptyCheckError);
      return;
    }
    if (
      herbName &&
      medName &&
      herbName.localeCompare(medName, undefined, { sensitivity: "base" }) === 0
    ) {
      setCheckError(labels.sameCheckError);
      return;
    }
    setCheckError(null);
    setCheckResult(null);

    if (!herbName || !medName) {
      const query = herbName
        ? `Tell me about ${herbName}`
        : `Tell me about ${medName}`;
      router.push(`/herbalist?q=${encodeURIComponent(query)}`);
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(
        `/api/interactions/check?herb=${encodeURIComponent(herbName)}&drug=${encodeURIComponent(medName)}`
      );
      const data = (await res.json()) as CheckResult & {
        unavailable?: boolean;
      };
      if (!res.ok || data.unavailable) {
        setCheckError(labels.checkerError);
        setCheckResult(null);
        return;
      }
      setCheckResult(data);
    } catch {
      setCheckError(labels.checkerError);
      setCheckResult(null);
    } finally {
      setChecking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (
        showHerbResults &&
        activeHerbIndex >= 0 &&
        herbResults[activeHerbIndex]
      ) {
        selectHerb(herbResults[activeHerbIndex]);
        return;
      }
      void handleCheck();
      return;
    }
    if (e.key === "ArrowDown" && showHerbResults) {
      e.preventDefault();
      setActiveHerbIndex((i) => Math.min(i + 1, herbResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && showHerbResults) {
      e.preventDefault();
      setActiveHerbIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Escape") {
      setShowHerbResults(false);
    }
  }

  function selectHerb(herb: HerbResult) {
    justSelected.current = herb.name;
    setHerbInput(herb.name);
    setShowHerbResults(false);
    medRef.current?.focus();
  }

  const severityLabel: Record<CheckPair["severity"], string> = {
    mild: labels.severityMild,
    moderate: labels.severityModerate,
    severe: labels.severitySevere,
    contraindicated: labels.severityContraindicated,
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-lg text-center">
        <div className="mt-8 space-y-3">
          <div className="relative">
            <input
              ref={herbRef}
              type="text"
              value={herbInput}
              onChange={(e) => {
                setHerbInput(e.target.value);
                setCheckError(null);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => herbInput.length >= 2 && setShowHerbResults(true)}
              placeholder={labels.herbPlaceholder}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              autoComplete="off"
            />
            {showHerbResults && herbResults.length > 0 && (
              <div
                ref={resultsRef}
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-background shadow-lg"
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
                    <span className="font-medium text-foreground">
                      {herb.name}
                    </span>
                    <span className="text-xs italic text-muted-foreground">
                      {herb.scientific_name}
                    </span>
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
            onChange={(e) => {
              setMedInput(e.target.value);
              setCheckError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleCheck()}
            placeholder={labels.medPlaceholder}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />

          <Button
            onClick={() => void handleCheck()}
            disabled={checking}
            aria-busy={checking}
            className="w-full rounded-xl py-3 text-sm font-medium"
            size="lg"
          >
            <ShieldCheck className="size-4" />
            {checking ? labels.checking : labels.checkButton}
          </Button>
          {checkError && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            >
              {checkError}
            </p>
          )}

          {checkResult && checkResult.found && (
            <div
              role="status"
              className="rounded-xl border bg-card p-4 text-left shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.checkerFoundTitle}
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {checkResult.herb.name} + {checkResult.pair.drugName}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[checkResult.pair.severity]}`}
              >
                {severityLabel[checkResult.pair.severity]}
              </span>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {checkResult.pair.description}
              </p>
              {checkResult.pair.mechanism && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {labels.checkerMechanism}:{" "}
                  </span>
                  {checkResult.pair.mechanism}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {checkResult.pair.evidenceLevel && (
                  <span>
                    {labels.checkerEvidence}: {checkResult.pair.evidenceLevel}
                    {" · "}
                  </span>
                )}
                {checkResult.pair.source && (
                  <span>
                    {labels.checkerSource}:{" "}
                    {checkResult.pair.sourceUrl ? (
                      <a
                        href={checkResult.pair.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {checkResult.pair.source}
                      </a>
                    ) : (
                      checkResult.pair.source
                    )}
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  render={<Link href={checkResult.pair.pairUrl} />}
                >
                  {labels.checkerViewPair}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/herbs/${checkResult.herb.slug}`} />}
                >
                  {labels.checkerViewHerb}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/herbalist?q=${encodeURIComponent(`Is ${checkResult.herb.name} safe to take with ${checkResult.pair.drugName}?`)}`}
                    />
                  }
                >
                  <MessageCircle className="mr-1 size-3" />
                  {labels.checkerAskHerbalist}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {labels.checkerDisclaimer}
              </p>
            </div>
          )}

          {checkResult && !checkResult.found && (
            <div
              role="status"
              className="rounded-xl border bg-card p-4 text-left shadow-sm"
            >
              <p className="text-base font-semibold text-foreground">
                {labels.checkerNotFoundTitle}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {labels.checkerNotFoundBody
                  .replace("{herb}", herbInput.trim())
                  .replace("{drug}", medInput.trim())}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {labels.checkerAiNote}
              </p>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/herbalist?q=${encodeURIComponent(`Is ${herbInput.trim()} safe to take with ${medInput.trim()}?`)}`}
                    />
                  }
                >
                  <MessageCircle className="mr-1 size-3" />
                  {labels.checkerAskHerbalist}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {labels.suggestionsTitle}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                disabled={checking}
                onClick={() => {
                  setHerbInput(s.herb);
                  setMedInput(s.med);
                  void handleCheck(s.herb, s.med);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {labels[`suggestion${i + 1}` as keyof Labels] || s.query}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => router.push("/symptoms")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="size-3.5" />
            {labels.symptomsLink}
          </button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          <ShieldCheck className="inline size-3 -mt-0.5 mr-1" />
          {labels.trustLine}
        </p>
      </div>
    </div>
  );
}
