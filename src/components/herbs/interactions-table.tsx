"use client";

import { useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import type { Interaction } from "@/lib/types/interactions";
import { drugSlug, pairPath } from "@/lib/interactions/pair-url";
import { findCollisionsForHerb } from "@/lib/interactions/drug-matching-unified";
import {
  getCollisionWarningBanner,
  getInteractionStatusBadge,
  summarizeInteractionPublicationStatus,
} from "@/lib/interactions/evidence";

export type { Interaction };

const SEVERITY_PRIORITY: Record<string, number> = {
  contraindicated: 0,
  severe: 1,
  moderate: 2,
  mild: 3,
};

export function getInteractionSourceLabel(
  sourceUrl: string,
  locale: "en" | "fr" = "en"
): string {
  const fr = locale === "fr";
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes("pubmed.ncbi.nlm.nih.gov")) {
      return fr ? "Source : PubMed" : "Source: PubMed";
    }
    if (host.includes("pmc.ncbi.nlm.nih.gov")) {
      return fr
        ? "Source : PubMed Central (NIH)"
        : "Source: PubMed Central (NIH)";
    }
    if (host.includes("ncbi.nlm.nih.gov") && path.includes("/books/")) {
      return fr
        ? "Source : NIH Bookshelf (LiverTox / LactMed)"
        : "Source: NIH Bookshelf (LiverTox / LactMed)";
    }
    if (host.includes("nccih.nih.gov")) {
      return fr ? "Source : NCCIH (NIH)" : "Source: NCCIH (NIH)";
    }
    if (host.includes("ods.od.nih.gov")) {
      return fr ? "Source : NIH ODS" : "Source: NIH ODS";
    }
    if (host.includes("medlineplus.gov")) {
      return fr ? "Source : MedlinePlus (NIH)" : "Source: MedlinePlus (NIH)";
    }
    if (host.includes("ema.europa.eu")) {
      return fr ? "Source : EMA HMPC" : "Source: EMA HMPC";
    }
    if (host.includes("canada.ca") || host.includes("hc-sc.gc.ca")) {
      return fr ? "Source : Santé Canada" : "Source: Health Canada";
    }
    if (host.includes("fda.gov") || host.includes("dailymed.nlm.nih.gov")) {
      return fr ? "Source : FDA (États-Unis)" : "Source: US FDA";
    }
    if (host.includes("who.int")) {
      return fr ? "Source : OMS" : "Source: WHO";
    }
    if (host.includes("tga.gov.au")) {
      return fr ? "Source : TGA (Australie)" : "Source: TGA Australia";
    }
    if (host.includes("mskcc.org")) {
      return fr ? "Source : MSK About Herbs" : "Source: MSK About Herbs";
    }
  } catch {
    // Fall through to primary source label when URL parsing fails.
  }
  return fr ? "Source primaire" : "Primary source";
}

const severityColors: Record<string, string> = {
  mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  moderate:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  contraindicated:
    "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200",
};

const INITIAL_COUNT = 5;

export function InteractionsTable({
  interactions,
  herbSlug,
}: {
  interactions: Interaction[];
  /**
   * When provided, each drug name links to its canonical pair page
   * (/interactions/[herb]/[drug]) — the internal-link mesh that lets
   * Google discover pair URLs and passes equity from high-traffic
   * monographs to them.
   */
  herbSlug?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() === "fr" ? "fr" : "en";
  const [expanded, setExpanded] = useState(false);

  if (interactions.length === 0) return null;

  const sortedInteractions = [...interactions].sort((a, b) => {
    const pa = SEVERITY_PRIORITY[a.severity] ?? 9;
    const pb = SEVERITY_PRIORITY[b.severity] ?? 9;
    if (pa !== pb) return pa - pb;
    return (a.display_drug_name || a.drug_name).localeCompare(
      b.display_drug_name || b.drug_name
    );
  });

  // Group by severity for summary
  const severityCounts = {
    severe: sortedInteractions.filter((i) => i.severity === "severe").length,
    moderate: sortedInteractions.filter((i) => i.severity === "moderate")
      .length,
    mild: sortedInteractions.filter((i) => i.severity === "mild").length,
    contraindicated: sortedInteractions.filter(
      (i) => i.severity === "contraindicated"
    ).length,
  };

  // Never hide Contraindicated or Severe interactions behind the 5-row collapse.
  const criticalCount = severityCounts.contraindicated + severityCounts.severe;
  const initialVisible = Math.max(INITIAL_COUNT, criticalCount);
  const displayInteractions = expanded
    ? sortedInteractions
    : sortedInteractions.slice(0, initialVisible);
  const hasMore = sortedInteractions.length > initialVisible;

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t("interactions.title")} ({interactions.length})
      </h2>
      {/* Every pair here came from a source that could not be cited: the legacy
          rows named Natural Medicines (commercial), WHO (all rights reserved) or
          "Clinical Studies" with no link. The attributions are gone from the data,
          so the page has to say plainly that no primary citation backs these. */}
      {/* Only warn about missing citations when some rows actually lack one. */}
      {herbSlug &&
        (() => {
          const collisions = findCollisionsForHerb(herbSlug);
          if (collisions.length === 0) return null;
          return (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {getCollisionWarningBanner(
                locale === "fr" ? "fr" : "en",
                collisions.map((c) => c.path)
              )}
            </p>
          );
        })()}
      {(() => {
        const activeInteractions = interactions.filter(
          (i) => i.publication_status !== "retracted_hold"
        );
        const pubSummary = summarizeInteractionPublicationStatus(
          activeInteractions,
          locale === "fr" ? "fr" : "en"
        );
        if (activeInteractions.length === 0) return null;
        return (
          <p className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {pubSummary.banner}
          </p>
        );
      })()}
      {interactions.some((i) => !i.source_url) && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("interactions.uncitedNote")}
        </p>
      )}

      {/* Severity Summary */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {severityCounts.contraindicated > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {severityCounts.contraindicated}{" "}
            {t("interactions.severity.contraindicated")}
          </span>
        )}
        {severityCounts.severe > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {severityCounts.severe} {t("interactions.severity.severe")}
          </span>
        )}
        {severityCounts.moderate > 0 && (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
            {severityCounts.moderate} {t("interactions.severity.moderate")}
          </span>
        )}
        {severityCounts.mild > 0 && (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {severityCounts.mild} {t("interactions.severity.mild")}
          </span>
        )}
        {interactions.some((i) => i.publication_status !== "published") && (
          <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {locale === "fr"
              ? "Signaux potentiels (fiches héritées non révisées)"
              : "Potential signals (unreviewed legacy records)"}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-foreground">
                {t("interactions.headers.drug")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground">
                {t("interactions.headers.severity")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground">
                {t("interactions.headers.description")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayInteractions
              .filter((i) => i.publication_status !== "retracted_hold")
              .map((interaction) => {
                const statusBadge = getInteractionStatusBadge(
                  interaction.publication_status,
                  locale === "fr" ? "fr" : "en"
                );
                return (
                  <tr key={interaction.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {herbSlug ? (
                        <div className="space-y-1">
                          <Link
                            href={pairPath(herbSlug, interaction.drug_name)}
                            className="hover:text-primary hover:underline transition-colors"
                          >
                            {interaction.display_drug_name ||
                              interaction.drug_name}
                          </Link>
                          <div>
                            <Link
                              href={`/medications/${drugSlug(interaction.drug_name)}`}
                              className="text-xs font-normal text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                            >
                              {t("interactions.allHerbsForDrug")}
                            </Link>
                          </div>
                        </div>
                      ) : (
                        interaction.display_drug_name || interaction.drug_name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {interaction.publication_status === "published" ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[interaction.severity] || ""}`}
                          >
                            {t(`interactions.severity.${interaction.severity}`)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-400/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                            {locale === "fr"
                              ? `Signal ${t(`interactions.severity.${interaction.severity}`)} potentiel (non révisé)`
                              : `Potential ${t(`interactions.severity.${interaction.severity}`)} (Unreviewed)`}
                          </span>
                        )}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge.toneClass}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {interaction.description}
                      {interaction.source_url && (
                        <a
                          href={interaction.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs text-primary hover:underline"
                        >
                          {getInteractionSourceLabel(
                            interaction.source_url,
                            locale
                          )}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-4" />
                {t("interactions.showLess")}
              </>
            ) : (
              <>
                <ChevronDown className="size-4" />
                {t("interactions.showMore", {
                  count: sortedInteractions.length - initialVisible,
                })}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Coverage-limit disclaimer + reverse medication index link */}
      <p className="mt-4 text-xs text-muted-foreground">
        {t("interactions.coverageNotice")}{" "}
        <Link
          href="/medications"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {t("interactions.browseMedications")}
        </Link>
      </p>
    </section>
  );
}
