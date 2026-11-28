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
  sourceUrl?: string | null;
  publicationStatus?: string | null;
  drugScope?: "molecule" | "class";
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
  const [evidenceFilter, setEvidenceFilter] = useState<
    "all" | "well-documented" | "moderate" | "limited" | "unspecified"
  >("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "molecule" | "class">(
    "all"
  );
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "with_source" | "with_url" | "needs_source"
  >("all");
  const [showAll, setShowAll] = useState(false);

  const hasAdvancedFilter =
    evidenceFilter !== "all" || scopeFilter !== "all" || sourceFilter !== "all";
  const hasAnyFilter =
    severityFilter !== "all" || query.trim().length > 0 || hasAdvancedFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) {
        return false;
      }
      if (evidenceFilter !== "all") {
        const level = (item.evidenceLevel ?? "").toLowerCase();
        if (evidenceFilter === "well-documented" && !level.includes("well")) {
          return false;
        }
        if (evidenceFilter === "moderate" && !level.includes("moderate")) {
          return false;
        }
        if (evidenceFilter === "limited" && !level.includes("limited")) {
          return false;
        }
        if (evidenceFilter === "unspecified" && level.length > 0) {
          return false;
        }
      }
      if (scopeFilter !== "all") {
        const itemScope = item.drugScope ?? "molecule";
        if (itemScope !== scopeFilter) return false;
      }
      if (sourceFilter !== "all") {
        const hasTextSource = Boolean(item.source?.trim());
        const hasUrl = Boolean(item.sourceUrl?.trim());
        if (sourceFilter === "with_source" && !hasTextSource) return false;
        if (sourceFilter === "with_url" && !hasUrl) return false;
        if (sourceFilter === "needs_source" && (hasTextSource || hasUrl)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.herbName.toLowerCase().includes(q) ||
        item.drugName.toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, severityFilter, query, evidenceFilter, scopeFilter, sourceFilter]);

  function resetFilters() {
    setSeverityFilter("all");
    setQuery("");
    setEvidenceFilter("all");
    setScopeFilter("all");
    setSourceFilter("all");
  }

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

      {/* Expandable advanced reviewer filters (R2-07) */}
      <details className="mt-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-xs">
        <summary className="cursor-pointer font-medium text-foreground">
          {fr
            ? `Filtres cliniques avancés${hasAdvancedFilter ? " (actifs)" : ""}`
            : `Advanced clinical filters${hasAdvancedFilter ? " (active)" : ""}`}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label
              htmlFor="queue-evidence-filter"
              className="block font-medium text-foreground"
            >
              {fr ? "Niveau de preuve indiqué" : "Recorded evidence tier"}
            </label>
            <select
              id="queue-evidence-filter"
              value={evidenceFilter}
              onChange={(e) =>
                setEvidenceFilter(
                  e.target.value as
                    | "all"
                    | "well-documented"
                    | "moderate"
                    | "limited"
                    | "unspecified"
                )
              }
              className="min-h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground"
            >
              <option value="all">
                {fr ? "Tous les niveaux" : "All evidence tiers"}
              </option>
              <option value="well-documented">
                {fr ? "Bien documenté (cité)" : "Well-documented (cited)"}
              </option>
              <option value="moderate">
                {fr ? "Preuves modérées" : "Moderate evidence"}
              </option>
              <option value="limited">
                {fr ? "Preuves limitées" : "Limited / mechanistic"}
              </option>
              <option value="unspecified">
                {fr ? "Non classé" : "Unclassified"}
              </option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="queue-scope-filter"
              className="block font-medium text-foreground"
            >
              {fr ? "Portée médicamenteuse" : "Medication applicability"}
            </label>
            <select
              id="queue-scope-filter"
              value={scopeFilter}
              onChange={(e) =>
                setScopeFilter(e.target.value as "all" | "molecule" | "class")
              }
              className="min-h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground"
            >
              <option value="all">
                {fr ? "Toutes les portées" : "All drug scopes"}
              </option>
              <option value="molecule">
                {fr ? "Molécule précise" : "Single molecule"}
              </option>
              <option value="class">
                {fr ? "Classe thérapeutique" : "Drug class"}
              </option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="queue-source-filter"
              className="block font-medium text-foreground"
            >
              {fr ? "Disponibilité des sources" : "Source availability"}
            </label>
            <select
              id="queue-source-filter"
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(
                  e.target.value as
                    "all" | "with_source" | "with_url" | "needs_source"
                )
              }
              className="min-h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground"
            >
              <option value="all">
                {fr ? "Toutes les sources" : "All source states"}
              </option>
              <option value="with_source">
                {fr ? "Source primaire citée" : "Primary citation listed"}
              </option>
              <option value="with_url">
                {fr
                  ? "Lien direct (URL) au dossier"
                  : "Direct source URL on file"}
              </option>
              <option value="needs_source">
                {fr
                  ? "Recherche de citation requise"
                  : "Needs primary citation lookup"}
              </option>
            </select>
          </div>
        </div>
      </details>

      {/* Accessible filtered result count announcement (R2-11) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p role="status" aria-live="polite" className="tabular-nums">
          {fr
            ? `Affichage de ${visible.length} fiche${visible.length > 1 ? "s" : ""} sur ${filtered.length} correspondance${filtered.length > 1 ? "s" : ""} (échantillon de ${items.length} paires prioritaires).`
            : `Showing ${visible.length} of ${filtered.length} matching pair${filtered.length === 1 ? "" : "s"} (from ${items.length} loaded priority records).`}
        </p>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-8 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {fr ? "Réinitialiser les filtres" : "Reset filters"}
          </button>
        )}
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
