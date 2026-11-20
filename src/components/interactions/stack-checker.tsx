"use client";

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { useTranslations, useLocale } from "next-intl";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  StackAlert,
  StackHerbSummary,
  StackMatchItem,
  StackUnrecordedItem,
} from "@/lib/interactions/stack";
import type { InteractionSeverity } from "@/lib/interactions/pairs";

const STORAGE_KEY = "herbally-my-stack-v1";
const MAX_ITEMS = 10;

interface StackApiResponse {
  checkedAt: string;
  locale: "en" | "fr";
  herbs: StackHerbSummary[];
  drugs: string[];
  summary: {
    totalCombinations: number;
    matchedCount: number;
    unrecordedCount: number;
    highestSeverity: InteractionSeverity | null;
    unresolvedHerbs: string[];
  };
  matches: StackMatchItem[];
  unrecorded: StackUnrecordedItem[];
  stackAlerts: StackAlert[];
}

const SEVERITY_BADGE: Record<InteractionSeverity, string> = {
  contraindicated:
    "border-red-300 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
  severe:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  moderate:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  mild: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200",
};

export function StackChecker() {
  const t = useTranslations("stackChecker");
  const locale = useLocale() === "fr" ? "fr" : "en";

  const [herbs, setHerbs] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);
  const [herbDraft, setHerbDraft] = useState("");
  const [drugDraft, setDrugDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StackApiResponse | null>(null);
  const [showWalletCard, setShowWalletCard] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as {
          herbs?: unknown;
          drugs?: unknown;
        };
        if (Array.isArray(parsed.herbs)) {
          setHerbs(
            parsed.herbs
              .filter((x): x is string => typeof x === "string")
              .slice(0, MAX_ITEMS)
          );
        }
        if (Array.isArray(parsed.drugs)) {
          setDrugs(
            parsed.drugs
              .filter((x): x is string => typeof x === "string")
              .slice(0, MAX_ITEMS)
          );
        }
      } catch {
        // Ignore corrupt local storage
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ herbs, drugs })
      );
    } catch {
      // Ignore storage quota / private-browsing errors
    }
  }, [herbs, drugs]);

  function addTerm(
    draft: string,
    list: string[],
    setList: (next: string[]) => void,
    clearDraft: () => void
  ) {
    const clean = draft.trim();
    if (clean.length < 2 || list.length >= MAX_ITEMS) return;
    if (list.some((x) => x.toLowerCase() === clean.toLowerCase())) {
      clearDraft();
      return;
    }
    setList([...list, clean]);
    clearDraft();
    setError(null);
  }

  function loadSample() {
    if (locale === "fr") {
      setHerbs(["Millepertuis", "Ail", "Ginkgo"]);
      setDrugs(["warfarine", "sertraline"]);
    } else {
      setHerbs(["St. John's Wort", "Garlic", "Ginkgo"]);
      setDrugs(["warfarin", "sertraline"]);
    }
    setHerbDraft("");
    setDrugDraft("");
    setError(null);
  }

  function clearAll() {
    setHerbs([]);
    setDrugs([]);
    setHerbDraft("");
    setDrugDraft("");
    setError(null);
    setResult(null);
  }

  async function runCheck() {
    // Commit pending typed text automatically if the user didn't click "+ Add"
    const pendingHerb = herbDraft.trim();
    const pendingDrug = drugDraft.trim();
    const nextHerbs =
      pendingHerb.length >= 2 &&
      herbs.length < MAX_ITEMS &&
      !herbs.some((x) => x.toLowerCase() === pendingHerb.toLowerCase())
        ? [...herbs, pendingHerb]
        : herbs;
    const nextDrugs =
      pendingDrug.length >= 2 &&
      drugs.length < MAX_ITEMS &&
      !drugs.some((x) => x.toLowerCase() === pendingDrug.toLowerCase())
        ? [...drugs, pendingDrug]
        : drugs;

    if (nextHerbs !== herbs) {
      setHerbs(nextHerbs);
      setHerbDraft("");
    }
    if (nextDrugs !== drugs) {
      setDrugs(nextDrugs);
      setDrugDraft("");
    }

    if (nextHerbs.length === 0 || nextDrugs.length === 0) {
      setError(t("needBothError"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interactions/check-stack", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-locale": locale },
        body: JSON.stringify({ herbs: nextHerbs, drugs: nextDrugs, locale }),
      });
      const data = (await res.json()) as StackApiResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || t("errorGeneric"));
        setLoading(false);
        return;
      }
      setResult(data);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  function severityText(sev: InteractionSeverity): string {
    return t(`severity.${sev}`);
  }

  return (
    <section
      id="stack-checker"
      className="print-sheet scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Layers className="size-4" aria-hidden="true" />
            <span>{t("eyebrow")}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSample}
          >
            <Sparkles className="mr-1.5 size-3.5" />
            {t("loadSample")}
          </Button>
          {(herbs.length > 0 || drugs.length > 0 || result) && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="mr-1.5 size-3.5" />
              {t("clearAll")}
            </Button>
          )}
        </div>
      </div>

      {/* Print-only clinical visit header */}
      <div className="print-only mb-4 border-b border-border pb-3">
        <p className="text-lg font-bold text-foreground">
          {t("printSheetTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("printGeneratedLabel")}{" "}
          {result
            ? new Date(result.checkedAt).toLocaleString(
                locale === "fr" ? "fr-CA" : "en-CA"
              )
            : new Date().toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}
          {" — "}
          herbally.app
        </p>
      </div>

      {/* Inputs */}
      <div className="no-print mt-5 grid gap-5 md:grid-cols-2">
        {/* Herbs column */}
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <label
            htmlFor="stack-herb-input"
            className="text-sm font-medium text-foreground"
          >
            {t("herbsHeading")} ({herbs.length}/{MAX_ITEMS})
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="stack-herb-input"
              value={herbDraft}
              onChange={(e) => setHerbDraft(e.target.value)}
              placeholder={t("herbPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm(herbDraft, herbs, setHerbs, () => setHerbDraft(""));
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                addTerm(herbDraft, herbs, setHerbs, () => setHerbDraft(""))
              }
              disabled={
                herbDraft.trim().length < 2 || herbs.length >= MAX_ITEMS
              }
              aria-label={t("addHerb")}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {herbs.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("noHerbsYet")}
              </span>
            ) : (
              herbs.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {h}
                  <button
                    type="button"
                    onClick={() => setHerbs(herbs.filter((x) => x !== h))}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`${t("remove")} ${h}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Medications column */}
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <label
            htmlFor="stack-drug-input"
            className="text-sm font-medium text-foreground"
          >
            {t("drugsHeading")} ({drugs.length}/{MAX_ITEMS})
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="stack-drug-input"
              value={drugDraft}
              onChange={(e) => setDrugDraft(e.target.value)}
              placeholder={t("drugPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm(drugDraft, drugs, setDrugs, () => setDrugDraft(""));
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                addTerm(drugDraft, drugs, setDrugs, () => setDrugDraft(""))
              }
              disabled={
                drugDraft.trim().length < 2 || drugs.length >= MAX_ITEMS
              }
              aria-label={t("addDrug")}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {drugs.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("noDrugsYet")}
              </span>
            ) : (
              drugs.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => setDrugs(drugs.filter((x) => x !== d))}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`${t("remove")} ${d}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="no-print mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" onClick={runCheck} disabled={loading}>
          {loading ? t("checkingButton") : t("checkButton")}
        </Button>

        {result && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowWalletCard((prev) => !prev);
              }}
            >
              <Printer className="mr-1.5 size-4" />
              {locale === "fr"
                ? showWalletCard
                  ? "Masquer carte portefeuille"
                  : "Carte portefeuille (pharmacien)"
                : showWalletCard
                  ? "Hide wallet card"
                  : "Foldable Wallet Card"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 size-4" />
              {t("printButton")}
            </Button>
          </div>
        )}
      </div>

      {result && showWalletCard && (
        <div className="print-sheet mt-5 rounded-xl border-2 border-dashed border-primary/50 bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {locale === "fr"
                  ? "Carte portefeuille HerbAlly — Suppléments & Médicaments"
                  : "HerbAlly Pocket Wallet Card — Supplements & Medications"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {locale === "fr"
                  ? "Présentez cette carte à votre pharmacien, médecin ou dentiste avant toute nouvelle ordonnance."
                  : "Show this foldable card to your pharmacist, physician, or surgeon at every appointment."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer className="mr-1 size-3.5" />
              {locale === "fr" ? "Imprimer la carte" : "Print card"}
            </Button>
          </div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-foreground">
                {t("herbsHeading")}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {herbs.join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {t("drugsHeading")}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {drugs.join(", ") || "—"}
              </p>
            </div>
          </div>
          {result.matches.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {locale === "fr"
                  ? "Alertes répertoriées : "
                  : "Flagged pairs: "}
              </span>
              {result.matches
                .map((m) => `${m.herbName} + ${m.drugName} (${m.severity})`)
                .join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-5 border-t border-border pt-6">
          {/* Summary header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              {result.summary.highestSeverity ? (
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {result.summary.matchedCount > 0
                    ? t("summaryFound", {
                        matched: result.summary.matchedCount,
                        total: result.summary.totalCombinations,
                      })
                    : t("summaryNone", {
                        total: result.summary.totalCombinations,
                      })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("summaryDisclaimer")}
                </p>
              </div>
            </div>
            {result.summary.highestSeverity && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_BADGE[result.summary.highestSeverity]}`}
              >
                {t("highestSeverityLabel")}:{" "}
                {severityText(result.summary.highestSeverity)}
              </span>
            )}
          </div>

          {/* Checked items summary (useful both on screen & printed sheet) */}
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-semibold text-foreground">
                {t("checkedHerbsTitle")}
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.herbs.map((h) => (
                  <li key={h.input}>
                    {h.found && h.slug ? (
                      <Link
                        href={`/herbs/${h.slug}`}
                        className="text-foreground underline-offset-2 hover:underline"
                      >
                        {h.name} ({h.scientificName})
                      </Link>
                    ) : (
                      <span>
                        {h.input} — {t("herbNotInDb")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-semibold text-foreground">
                {t("checkedDrugsTitle")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {result.drugs.join(", ")}
              </p>
            </div>
          </div>

          {/* Cross-herb overlap alerts */}
          {result.stackAlerts.length > 0 && (
            <div className="space-y-2">
              {result.stackAlerts.map((alert) => (
                <div
                  key={alert.code}
                  className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertOctagon
                      className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-amber-950 dark:text-amber-100">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recorded matches */}
          {result.matches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                {t("matchesHeading")}
              </h3>
              {result.matches.map((m) => (
                <div
                  key={`${m.herbSlug}-${m.drugSlug}-${m.drugInput}`}
                  className="rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      <Link
                        href={`/herbs/${m.herbSlug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {m.herbName}
                      </Link>
                      {" + "}
                      <span>{m.drugName}</span>
                      {m.drugInput.toLowerCase() !==
                        m.drugName.toLowerCase() && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({m.drugInput})
                        </span>
                      )}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[m.severity]}`}
                    >
                      {severityText(m.severity)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {m.description}
                  </p>
                  {m.mechanism && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t("mechanismLabel")}:{" "}
                      </span>
                      {m.mechanism}
                    </p>
                  )}
                  <div className="no-print mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <Link
                      href={m.pairUrl}
                      className="font-medium text-primary hover:underline"
                    >
                      {t("viewFullPair")} →
                    </Link>
                    {m.sourceUrl && (
                      <a
                        href={m.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground underline hover:text-foreground"
                      >
                        {m.source || t("sourceLink")}
                      </a>
                    )}
                  </div>
                  {m.sourceUrl && (
                    <p className="print-only mt-1 text-[11px] text-muted-foreground">
                      Source: {m.source || m.sourceUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unrecorded pairs */}
          {result.unrecorded.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <span>{t("unrecordedHeading")}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("unrecordedNote")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {result.unrecorded.map((u, idx) => (
                  <li
                    key={`${u.herbName}-${u.drugInput}-${idx}`}
                    className="rounded-md border border-border/70 bg-card px-2 py-1"
                  >
                    {u.herbName} + {u.drugInput}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            <Info className="mr-1 inline size-3.5" aria-hidden="true" />
            {t("clinicalFooterNote")}
          </p>
        </div>
      )}
    </section>
  );
}
