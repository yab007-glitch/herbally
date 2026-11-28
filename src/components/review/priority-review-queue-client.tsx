"use client";

import { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  Search,
} from "lucide-react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Input } from "@/components/ui/input";
import { buildSignOffHref } from "@/components/review/clinician-signoff-banner";
import { pairPath } from "@/lib/interactions/pair-url";
import { cn } from "@/lib/utils";

export interface PriorityQueueItem {
  id: string;
  herbSlug: string;
  herbName: string;
  drugName: string;
  severity: "contraindicated" | "severe";
  evidenceLevel: string | null;
  source: string | null;
}

export interface PriorityReviewQueueClientProps {
  locale: "en" | "fr";
  items: PriorityQueueItem[];
  totalPriorityCount: number;
  totalActivePairs: number;
  clinicianSignedPairs: number;
  seatsFilled: number;
  seatsTotal: number;
  generatedAt: string;
}

export function PriorityReviewQueueClient({
  locale,
  items,
  totalPriorityCount,
  totalActivePairs,
  clinicianSignedPairs,
  seatsFilled,
  seatsTotal,
  generatedAt,
}: PriorityReviewQueueClientProps) {
  const fr = locale === "fr";
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "contraindicated" | "severe"
  >("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.herbName.toLowerCase().includes(q) ||
        item.drugName.toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, severityFilter, query]);

  const visible = showAll ? filtered.slice(0, 24) : filtered.slice(0, 8);
  const formattedDate = generatedAt.slice(0, 10);

  return (
    <section
      id="priority-queue"
      aria-labelledby="priority-queue-heading"
      className="mt-12 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <FileCheck2 className="size-3.5" aria-hidden="true" />
            {fr
              ? "File prioritaire de validation clinique"
              : "Priority Clinical Sign-Off Queue"}
          </p>
          <h2
            id="priority-queue-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "Interactions à haut risque en attente de validation"
              : "High-risk interaction pairs awaiting clinician sign-off"}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {fr
              ? `${totalPriorityCount} paires contre-indiquées ou graves (sur ${totalActivePairs} paires actives ; ${clinicianSignedPairs} signées à ce jour ; instantané du ${formattedDate}) attendent une révision par un pharmacien, médecin ou toxicologue.`
              : `${totalPriorityCount} contraindicated or severe pairs (out of ${totalActivePairs} active pairs; ${clinicianSignedPairs} clinician-signed so far; snapshot ${formattedDate}) are prioritized for PharmD / MD / toxicologist sign-off.`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs tabular-nums">
          <p className="font-semibold text-foreground">
            {fr
              ? `Comité consultatif : ${seatsFilled} / ${seatsTotal} sièges`
              : `Advisory Board: ${seatsFilled} / ${seatsTotal} seats`}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {fr
              ? "PharmD/RPh · MD/DO · Toxicologue · Français natif"
              : "PharmD/RPh · MD/DO · Toxicologist · Native-FR"}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label={fr ? "Filtrer par gravité" : "Filter queue by severity"}
          className="flex flex-wrap gap-1.5 text-xs"
        >
          {(
            [
              {
                key: "all",
                en: `All high-risk (${items.length})`,
                fr: `Toutes (${items.length})`,
              },
              {
                key: "contraindicated",
                en: `Contraindicated (${items.filter((i) => i.severity === "contraindicated").length})`,
                fr: `Contre-indiquées (${items.filter((i) => i.severity === "contraindicated").length})`,
              },
              {
                key: "severe",
                en: `Severe (${items.filter((i) => i.severity === "severe").length})`,
                fr: `Graves (${items.filter((i) => i.severity === "severe").length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSeverityFilter(tab.key)}
              aria-pressed={severityFilter === tab.key}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1 font-medium tabular-nums transition-colors",
                severityFilter === tab.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {fr ? tab.fr : tab.en}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="priority-queue-search" className="sr-only">
            {fr
              ? "Filtrer la file par plante ou médicament"
              : "Filter queue by herb or medication"}
          </label>
          <Input
            id="priority-queue-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              fr ? "Plante ou médicament..." : "Filter herb or medication..."
            }
            className="min-h-10 pl-9 text-xs"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center text-xs text-muted-foreground">
          {fr
            ? "Aucune paire prioritaire ne correspond à ce filtre."
            : "No priority interaction pairs match your current filter."}
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {visible.map((item) => {
            const isContra = item.severity === "contraindicated";
            const signOffUrl = buildSignOffHref({
              targetType: "interaction",
              herbSlug: item.herbSlug,
              drugName: item.drugName,
            });
            return (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-border/80 bg-background p-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {item.herbName} + {item.drugName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        isContra
                          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                      )}
                    >
                      {isContra ? (
                        <AlertOctagon className="size-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="size-3" aria-hidden="true" />
                      )}
                      {isContra
                        ? fr
                          ? "Contre-indiquée"
                          : "Contraindicated"
                        : fr
                          ? "Grave"
                          : "Severe"}
                    </span>
                  </div>
                  {item.source && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {fr ? "Source primaire : " : "Primary source: "}
                      {item.source}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <Link
                    href={pairPath(item.herbSlug, item.drugName)}
                    className="min-h-8 inline-flex items-center text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    {fr ? "Lire la fiche" : "Inspect record"}
                  </Link>
                  <Link
                    href={signOffUrl}
                    rel="nofollow"
                    className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    {fr ? "Valider cette paire" : "Sign off this pair"}
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > 8 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex min-h-9 items-center rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {showAll
              ? fr
                ? "Afficher moins"
                : "Show fewer"
              : fr
                ? `Afficher plus de paires (${Math.min(24, filtered.length)} sur ${filtered.length})`
                : `Show more priority pairs (${Math.min(24, filtered.length)} of ${filtered.length})`}
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>
          {fr
            ? "Révision par lots, validation francophone ou comité consultatif ? Écrivez à "
            : "Batch review, native-French clinical validation, or Advisory Board? Email "}
          <a
            href="mailto:info@herbally.app"
            className="font-semibold text-primary underline underline-offset-2"
          >
            info@herbally.app
          </a>
          .
        </span>
        <a
          href="/open-data/review-queue.json"
          className="font-medium text-primary underline underline-offset-4"
        >
          {fr
            ? `Télécharger les ${totalPriorityCount} paires prioritaires (JSON) →`
            : `Download all ${totalPriorityCount} priority pairs (JSON) →`}
        </a>
      </div>
    </section>
  );
}
