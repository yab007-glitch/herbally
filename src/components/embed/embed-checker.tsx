"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Leaf, ShieldCheck } from "lucide-react";

interface HerbResult {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";

/**
 * Compact herb↔drug checker for third-party iframes.
 * Free to embed; the mandatory "Powered by HerbAlly" attribution link is
 * the backlink that makes this a growth loop. Results open OUTSIDE the
 * iframe (top navigation with _blank fallback) so partners never trap users.
 */
export function EmbedChecker() {
  const t = useTranslations("embed");
  const locale = useLocale();
  const localePrefix = locale === "fr" ? "/fr" : "";
  const [herbInput, setHerbInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [herbResults, setHerbResults] = useState<HerbResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);
  const herbRef = useRef<HTMLInputElement>(null);

  const searchHerbs = useCallback(async (term: string) => {
    if (term.length < 2) {
      setHerbResults([]);
      setShowResults(false);
      return;
    }
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
        setShowResults(false);
        return;
      }
      const data = await res.json();
      setHerbResults(Array.isArray(data) ? data.slice(0, 5) : []);
      setShowResults(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
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
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openResult(url: string) {
    // Break out of the iframe; fall back to a new tab when sandboxed.
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // Cross-origin access denied — fall through to _blank.
    }
    window.open(url, "_blank", "noopener");
  }

  function handleCheck() {
    setShowResults(false);
    const herbName = herbInput.trim();
    const medName = medInput.trim();
    if (!herbName && !medName) {
      setError(t("emptyError"));
      return;
    }
    if (
      herbName &&
      medName &&
      herbName.localeCompare(medName, undefined, { sensitivity: "base" }) === 0
    ) {
      setError(t("sameError"));
      return;
    }
    setError(null);
    const query =
      locale === "fr"
        ? herbName && medName
          ? `Est-ce que ${herbName} est sécuritaire avec ${medName} ?`
          : `Parle-moi de ${herbName || medName}`
        : herbName && medName
          ? `Is ${herbName} safe to take with ${medName}?`
          : `Tell me about ${herbName || medName}`;
    openResult(
      `${APP_URL}${localePrefix}/herbalist?q=${encodeURIComponent(query)}`
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Leaf className="size-4" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
      </div>

      <div className="relative">
        <input
          ref={herbRef}
          type="text"
          value={herbInput}
          onChange={(e) => {
            setHerbInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          onFocus={() => herbInput.length >= 2 && setShowResults(true)}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults && herbResults.length > 0}
          aria-controls="embed-herb-results"
          placeholder={t("herbPlaceholder")}
          aria-label={t("herbPlaceholder")}
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        {showResults && herbResults.length > 0 && (
          <div
            ref={resultsRef}
            id="embed-herb-results"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-background shadow-lg"
          >
            {herbResults.map((herb) => (
              <button
                key={herb.id}
                type="button"
                role="option"
                aria-selected={herbInput === herb.name}
                onClick={() => {
                  setHerbInput(herb.name);
                  setShowResults(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium text-foreground">{herb.name}</span>
                <span className="text-xs italic text-muted-foreground">
                  {herb.scientific_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-2 flex items-center gap-1 text-xs text-muted-foreground">
        <span className="block h-px flex-1 bg-border" />
        <span className="px-1">+</span>
        <span className="block h-px flex-1 bg-border" />
      </div>

      <input
        type="text"
        value={medInput}
        onChange={(e) => {
          setMedInput(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && handleCheck()}
        placeholder={t("medPlaceholder")}
        aria-label={t("medPlaceholder")}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
      />

      <button
        type="button"
        onClick={handleCheck}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <ShieldCheck className="size-4" aria-hidden />
        {t("checkButton")}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        <a
          href={`${APP_URL}${localePrefix || "/"}`}
          target="_blank"
          rel="noopener"
          className="hover:text-foreground hover:underline"
        >
          {t("poweredBy")}
        </a>
      </p>
    </div>
  );
}
