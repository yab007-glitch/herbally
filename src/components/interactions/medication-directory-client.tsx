"use client";

import { useMemo, useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Search, ArrowRight, ShieldAlert } from "lucide-react";
import type { InteractionSeverity } from "@/lib/interactions/pairs";
import type { MedicationSummary } from "@/lib/interactions/medications";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER: InteractionSeverity[] = [
  "contraindicated",
  "severe",
  "moderate",
  "mild",
];

const SEVERITY_BADGE: Record<InteractionSeverity, string> = {
  contraindicated:
    "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
  severe:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-300",
  moderate:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/70 dark:bg-orange-950/40 dark:text-orange-300",
  mild: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/70 dark:bg-yellow-950/40 dark:text-yellow-300",
};

function severityLabel(severity: InteractionSeverity, fr: boolean): string {
  if (fr) {
    switch (severity) {
      case "contraindicated":
        return "Contre-indiqué";
      case "severe":
        return "Grave";
      case "moderate":
        return "Modéré";
      default:
        return "Léger";
    }
  }
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

interface Props {
  medications: MedicationSummary[];
  locale: string;
}

export function MedicationDirectoryClient({ medications, locale }: Props) {
  const fr = locale === "fr";
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<
    InteractionSeverity | "all"
  >("all");
  const [sortBy, setSortBy] = useState<"count" | "az">("count");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = medications.filter((med) => {
      if (severityFilter !== "all" && med.highestSeverity !== severityFilter) {
        return false;
      }
      if (!q) return true;
      if (med.drugName.toLowerCase().includes(q)) return true;
      if (med.enDrugName.toLowerCase().includes(q)) return true;
      return med.sampleHerbs.some((h) => h.name.toLowerCase().includes(q));
    });
    if (sortBy === "az") {
      return [...list].sort((a, b) => a.drugName.localeCompare(b.drugName));
    }
    return list;
  }, [medications, query, severityFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              fr
                ? "Filtrer par médicament ou plante (ex. warfarine, metformine)..."
                : "Filter by medication or herb (e.g. warfarin, metformin)..."
            }
            aria-label={fr ? "Filtrer les médicaments" : "Filter medications"}
            className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSortBy(sortBy === "count" ? "az" : "count")}
            className="rounded-lg border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {sortBy === "count"
              ? fr
                ? "Tri : Plus d'interactions"
                : "Sort: Most herbs"
              : fr
                ? "Tri : A–Z"
                : "Sort: A–Z"}
          </button>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={fr ? "Filtrer par gravité" : "Filter by severity"}
      >
        <button
          type="button"
          onClick={() => setSeverityFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            severityFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          {fr ? `Tous (${medications.length})` : `All (${medications.length})`}
        </button>
        {SEVERITY_ORDER.map((sev) => {
          const count = medications.filter(
            (m) => m.highestSeverity === sev
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                severityFilter === sev
                  ? "border-primary bg-primary text-primary-foreground"
                  : cn("hover:opacity-80", SEVERITY_BADGE[sev])
              )}
            >
              {severityLabel(sev, fr)} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {fr
            ? "Aucun médicament ne correspond à ce filtre."
            : "No medications match this filter."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((med) => (
            <li key={med.drugSlug}>
              <Link
                href={`/medications/${med.drugSlug}`}
                className="group flex h-full flex-col justify-between rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground group-hover:text-primary">
                      {med.drugName}
                    </h2>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        SEVERITY_BADGE[med.highestSeverity]
                      )}
                    >
                      <ShieldAlert className="size-3" aria-hidden="true" />
                      {severityLabel(med.highestSeverity, fr)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {fr
                      ? `${med.totalInteractions} plante${med.totalInteractions > 1 ? "s" : ""} avec interaction documentée`
                      : `${med.totalInteractions} interacting herb${med.totalInteractions === 1 ? "" : "s"}`}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {med.sampleHerbs.slice(0, 4).map((h) => (
                      <span
                        key={h.slug}
                        className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {h.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-2.5 text-xs font-medium text-primary">
                  <span>
                    {fr
                      ? "Voir les plantes concernées"
                      : "View interacting herbs"}
                  </span>
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
