"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocalizedRouter as useRouter } from "@/components/i18n/use-localized-router";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  getInteractionStatusBadge,
  summarizeInteractionPublicationStatus,
} from "@/lib/interactions/evidence";
import { ShieldCheck, Sparkles, MessageCircle } from "lucide-react";

type Labels = {
  herbLabel: string;
  medLabel: string;
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
  checkerAskPrompt: string;
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
  publicationStatus?: string | null;
}

type CheckResult =
  | {
      found: true;
      ambiguous?: false;
      herb: { slug: string; name: string };
      pair: CheckPair;
    }
  | {
      found: true;
      ambiguous: true;
      conflict?: boolean;
      herb: { slug: string; name: string };
      pair: null;
      conflictingPairs: CheckPair[];
    }
  | {
      found: false;
      herb: { slug: string; name: string } | null;
      unavailable?: boolean;
      withheld?: boolean;
      status?: "withheld";
      reason?: string;
      message?: string;
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

export function HomeSearchClient({
  labels,
  locale = "en",
}: {
  labels: Labels;
  locale?: "en" | "fr";
}) {
  const router = useRouter();
  const [herbInput, setHerbInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [herbResults, setHerbResults] = useState<HerbResult[]>([]);
  const [showHerbResults, setShowHerbResults] = useState(false);
  const [activeHerbIndex, setActiveHerbIndex] = useState(-1);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "quarantined" | "unreviewed"
  >("all");
  const herbRef = useRef<HTMLInputElement>(null);
  const medRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchAbort = useRef<AbortController | null>(null);
  const justSelected = useRef<string | null>(null);
  const checkGenRef = useRef(0);
  const checkAbortRef = useRef<AbortController | null>(null);

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
      if (!res.ok) {
        setHerbResults([]);
        setShowHerbResults(false);
        return;
      }
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

  useEffect(
    () => () => {
      searchAbort.current?.abort();
      checkAbortRef.current?.abort();
    },
    []
  );

  function invalidateCheck() {
    checkGenRef.current += 1;
    checkAbortRef.current?.abort();
    checkAbortRef.current = null;
    setChecking(false);
    setCheckResult(null);
    setStatusFilter("all");
    setCheckError(null);
  }

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
    invalidateCheck();
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

    if (!herbName || !medName) {
      const query = herbName
        ? `Tell me about ${herbName}`
        : `Tell me about ${medName}`;
      router.push(`/herbalist?q=${encodeURIComponent(query)}`);
      return;
    }

    const gen = ++checkGenRef.current;
    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;

    setChecking(true);
    try {
      const res = await fetch(
        `/api/interactions/check?herb=${encodeURIComponent(herbName)}&drug=${encodeURIComponent(medName)}`,
        { signal: controller.signal }
      );
      if (gen !== checkGenRef.current) return;
      const data = (await res.json()) as CheckResult & {
        unavailable?: boolean;
      };
      if (gen !== checkGenRef.current) return;
      if (!res.ok || data.unavailable) {
        setCheckError(labels.checkerError);
        setCheckResult(null);
        return;
      }
      setCheckResult(data);
    } catch {
      if (gen !== checkGenRef.current) return;
      setCheckError(labels.checkerError);
      setCheckResult(null);
    } finally {
      if (gen === checkGenRef.current) {
        setChecking(false);
        if (checkAbortRef.current === controller) {
          checkAbortRef.current = null;
        }
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
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
    invalidateCheck();
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
      <div className="w-full text-left">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCheck();
          }}
          className="space-y-3"
        >
          <div className="relative text-left">
            <label htmlFor="home-herb" className="eyebrow mb-1.5 block">
              {labels.herbLabel}
            </label>
            <input
              id="home-herb"
              ref={herbRef}
              type="text"
              value={herbInput}
              onChange={(e) => {
                setHerbInput(e.target.value);
                invalidateCheck();
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => herbInput.length >= 2 && setShowHerbResults(true)}
              placeholder={labels.herbPlaceholder}
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
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
                    type="button"
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

          <div className="relative text-left">
            <label htmlFor="home-med" className="eyebrow mb-1.5 block">
              {labels.medLabel}
            </label>
            <input
              id="home-med"
              ref={medRef}
              type="text"
              value={medInput}
              onChange={(e) => {
                setMedInput(e.target.value);
                invalidateCheck();
              }}
              placeholder={labels.medPlaceholder}
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={checking}
            aria-busy={checking}
            className="h-12 w-full rounded-md text-sm font-medium"
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

          {checkResult &&
            checkResult.found &&
            checkResult.ambiguous &&
            checkResult.conflictingPairs.length > 0 &&
            (() => {
              const activeConflicts = checkResult.conflictingPairs.filter(
                (cp) => cp.publicationStatus !== "retracted_hold"
              );
              const pubSummary = summarizeInteractionPublicationStatus(
                activeConflicts,
                locale
              );
              const publishedCount = activeConflicts.filter(
                (cp) => cp.publicationStatus === "published"
              ).length;
              const quarantinedCount = activeConflicts.filter(
                (cp) => cp.publicationStatus === "quarantined_collision"
              ).length;
              const unreviewedCount = activeConflicts.filter(
                (cp) =>
                  cp.publicationStatus !== "published" &&
                  cp.publicationStatus !== "quarantined_collision"
              ).length;
              const visibleConflicts = activeConflicts.filter((cp) => {
                if (statusFilter === "published")
                  return cp.publicationStatus === "published";
                if (statusFilter === "quarantined")
                  return cp.publicationStatus === "quarantined_collision";
                if (statusFilter === "unreviewed")
                  return (
                    cp.publicationStatus !== "published" &&
                    cp.publicationStatus !== "quarantined_collision"
                  );
                return true;
              });
              return (
                <div
                  role="alert"
                  className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-left shadow-sm dark:border-amber-800 dark:bg-amber-950/30"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {checkResult.herb.name}: Multiple interaction records match
                    this medication — review all entries with a pharmacist.
                  </p>
                  <p className="rounded-md border border-amber-200/80 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                    {pubSummary.banner}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "all"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr"
                        ? `Toutes (${activeConflicts.length})`
                        : `All (${activeConflicts.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("published")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "published"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr"
                        ? `Révisées par clinicien (${publishedCount})`
                        : `Clinician-reviewed (${publishedCount})`}
                    </button>
                    {quarantinedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter("quarantined")}
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-medium transition-colors",
                          statusFilter === "quarantined"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {locale === "fr"
                          ? `Conflits en quarantaine (${quarantinedCount})`
                          : `Quarantined collision (${quarantinedCount})`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStatusFilter("unreviewed")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "unreviewed"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr"
                        ? `Héritées non révisées (${unreviewedCount})`
                        : `Unreviewed legacy (${unreviewedCount})`}
                    </button>
                  </div>
                  {visibleConflicts.length === 0 ? (
                    <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                      {locale === "fr"
                        ? "Aucune fiche ne correspond au filtre sélectionné."
                        : "No matches for the selected status filter."}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {visibleConflicts.map((cp) => {
                        const statusBadge = getInteractionStatusBadge(
                          cp.publicationStatus,
                          locale
                        );
                        return (
                          <div
                            key={cp.id}
                            className="rounded-lg border border-border bg-card p-3"
                          >
                            <p className="text-sm font-semibold text-foreground">
                              {checkResult.herb.name} + {cp.drugName}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[cp.severity]}`}
                              >
                                {severityLabel[cp.severity]}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadge.toneClass}`}
                              >
                                {statusBadge.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {cp.description}
                            </p>
                            {cp.mechanism && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {labels.checkerMechanism}:{" "}
                                </span>
                                {cp.mechanism}
                              </p>
                            )}
                            <div className="mt-2">
                              <Link
                                href={cp.pairUrl}
                                className={buttonVariants({
                                  size: "sm",
                                  variant: "outline",
                                })}
                              >
                                {labels.checkerViewPair}
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {labels.checkerDisclaimer}
                  </p>
                </div>
              );
            })()}

          {checkResult &&
            checkResult.found &&
            !checkResult.ambiguous &&
            checkResult.pair &&
            (() => {
              const pair = checkResult.pair;
              const statusBadge = getInteractionStatusBadge(
                pair.publicationStatus,
                locale
              );
              const pubSummary = summarizeInteractionPublicationStatus(
                [pair],
                locale
              );
              const isPublished = pair.publicationStatus === "published";
              const isQuarantined =
                pair.publicationStatus === "quarantined_collision";
              const isUnreviewed = !isPublished && !isQuarantined;
              const matchesFilter =
                statusFilter === "all" ||
                (statusFilter === "published"
                  ? isPublished
                  : statusFilter === "quarantined"
                    ? isQuarantined
                    : isUnreviewed);

              return (
                <div
                  role="status"
                  className="rounded-xl border bg-card p-4 text-left shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {labels.checkerFoundTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "all"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr" ? "Toutes (1)" : "All (1)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("published")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "published"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr"
                        ? `Révisées par clinicien (${isPublished ? 1 : 0})`
                        : `Clinician-reviewed (${isPublished ? 1 : 0})`}
                    </button>
                    {isQuarantined && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter("quarantined")}
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-medium transition-colors",
                          statusFilter === "quarantined"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {locale === "fr"
                          ? "Conflits en quarantaine (1)"
                          : "Quarantined collision (1)"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStatusFilter("unreviewed")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium transition-colors",
                        statusFilter === "unreviewed"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {locale === "fr"
                        ? `Héritées non révisées (${isUnreviewed ? 1 : 0})`
                        : `Unreviewed legacy (${isUnreviewed ? 1 : 0})`}
                    </button>
                  </div>

                  {!matchesFilter ? (
                    <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      {locale === "fr"
                        ? "Aucune fiche ne correspond au filtre sélectionné."
                        : "No matches for the selected status filter."}
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 text-base font-semibold text-foreground">
                        {checkResult.herb.name} + {pair.drugName}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[pair.severity]}`}
                        >
                          {severityLabel[pair.severity]}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadge.toneClass}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {pubSummary.banner}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {pair.description}
                      </p>
                      {pair.mechanism && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {labels.checkerMechanism}:{" "}
                          </span>
                          {pair.mechanism}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {pair.evidenceLevel && (
                          <span>
                            {labels.checkerEvidence}: {pair.evidenceLevel}
                            {" · "}
                          </span>
                        )}
                        {pair.source && (
                          <span>
                            {labels.checkerSource}:{" "}
                            {pair.sourceUrl ? (
                              <a
                                href={pair.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {pair.source}
                              </a>
                            ) : (
                              pair.source
                            )}
                          </span>
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={pair.pairUrl}
                          className={buttonVariants({ size: "sm" })}
                        >
                          {labels.checkerViewPair}
                        </Link>
                        <Link
                          href={`/herbs/${checkResult.herb.slug}`}
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline",
                          })}
                        >
                          {labels.checkerViewHerb}
                        </Link>
                        <Link
                          href={`/herbalist?q=${encodeURIComponent(
                            labels.checkerAskPrompt
                              .replace("{herb}", checkResult.herb.name)
                              .replace("{drug}", pair.drugName)
                          )}`}
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline",
                          })}
                        >
                          <MessageCircle className="mr-1 size-3" />
                          {labels.checkerAskHerbalist}
                        </Link>
                      </div>
                    </>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {labels.checkerDisclaimer}
                  </p>
                </div>
              );
            })()}

          {checkResult && !checkResult.found && checkResult.withheld && (
            <div
              role="alert"
              className="rounded-xl border border-red-300/80 bg-red-50/60 p-4 text-left shadow-sm dark:border-red-900 dark:bg-red-950/30"
            >
              <p className="text-base font-semibold text-foreground">
                {locale === "fr"
                  ? "Fiche d'interaction retenue (citation retirée)"
                  : "Interaction record withheld (retracted citation)"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {checkResult.message ||
                  (locale === "fr"
                    ? "Une fiche correspondante est retenue en raison d'une citation retirée. Ne supposez pas que l'association est sans risque — consultez un pharmacien."
                    : "A matching interaction record is currently withheld due to a retracted citation and is under clinical review. Consult a pharmacist or prescriber.")}
              </p>
              <div className="mt-3">
                <Link
                  href={`/herbalist?q=${encodeURIComponent(
                    labels.checkerAskPrompt
                      .replace("{herb}", herbInput.trim())
                      .replace("{drug}", medInput.trim())
                  )}`}
                  className={buttonVariants({
                    size: "sm",
                    variant: "outline",
                  })}
                >
                  <MessageCircle className="mr-1 size-3" />
                  {labels.checkerAskHerbalist}
                </Link>
              </div>
            </div>
          )}

          {checkResult && !checkResult.found && !checkResult.withheld && (
            <div
              role="status"
              className="rounded-xl border border-amber-300/70 bg-amber-50/40 p-4 text-left shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20"
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
                <Link
                  href={`/herbalist?q=${encodeURIComponent(
                    labels.checkerAskPrompt
                      .replace("{herb}", herbInput.trim())
                      .replace("{drug}", medInput.trim())
                  )}`}
                  className={buttonVariants({
                    size: "sm",
                    variant: "outline",
                  })}
                >
                  <MessageCircle className="mr-1 size-3" />
                  {labels.checkerAskHerbalist}
                </Link>
              </div>
            </div>
          )}
        </form>

        <div className="mt-8">
          <p className="eyebrow mb-3">{labels.suggestionsTitle}</p>
          <div className="flex flex-wrap justify-start gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                disabled={checking}
                onClick={() => {
                  setHerbInput(s.herb);
                  setMedInput(s.med);
                  void handleCheck(s.herb, s.med);
                }}
                className="min-h-11 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
              >
                {labels[`suggestion${i + 1}` as keyof Labels] || s.query}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/symptoms")}
            className="inline-flex min-h-10 items-center gap-1.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
