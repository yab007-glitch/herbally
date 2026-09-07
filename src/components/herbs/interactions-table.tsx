"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { Interaction } from "@/lib/types/interactions";
import { pairPath } from "@/lib/interactions/pair-url";

export type { Interaction };

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
  const [expanded, setExpanded] = useState(false);

  if (interactions.length === 0) return null;

  const displayInteractions = expanded
    ? interactions
    : interactions.slice(0, INITIAL_COUNT);
  const hasMore = interactions.length > INITIAL_COUNT;

  // Group by severity for summary
  const severityCounts = {
    severe: interactions.filter((i) => i.severity === "severe").length,
    moderate: interactions.filter((i) => i.severity === "moderate").length,
    mild: interactions.filter((i) => i.severity === "mild").length,
    contraindicated: interactions.filter(
      (i) => i.severity === "contraindicated"
    ).length,
  };

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-foreground">
        {t("interactions.title")} ({interactions.length})
      </h2>

      {/* Severity Summary */}
      <div className="mb-4 flex flex-wrap gap-2">
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
            {displayInteractions.map((interaction) => (
              <tr key={interaction.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">
                  {herbSlug ? (
                    <Link
                      href={pairPath(herbSlug, interaction.drug_name)}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {interaction.drug_name}
                    </Link>
                  ) : (
                    interaction.drug_name
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[interaction.severity] || ""}`}
                  >
                    {t(`interactions.severity.${interaction.severity}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {interaction.description}
                </td>
              </tr>
            ))}
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
                  count: interactions.length - INITIAL_COUNT,
                })}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Coverage-limit disclaimer — the curated subset is not exhaustive */}
      <p className="mt-4 text-xs text-muted-foreground">
        {t("interactions.coverageNotice")}
      </p>
    </section>
  );
}
