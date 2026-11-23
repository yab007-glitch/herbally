import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import { HerbSafetyPanel } from "@/components/herbs/herb-safety-panel";
import { GovSourcedBanner } from "@/components/herbs/gov-sourced-banner";
import { PubmedMonographSheet } from "@/components/herbs/pubmed-monograph-sheet";
import type { Interaction } from "@/components/herbs/interactions-table";
import type { Monograph } from "@/lib/data/monographs";
import type { HerbWithInteractions } from "@/lib/types";
import type { SheetContent } from "@/components/herbs/pubmed-monograph-sheet";
import type { CopyLocale } from "@/lib/i18n/herb-page-copy";
import { herbPageCopy } from "@/lib/i18n/herb-page-copy";
import { isUsablePubmedSheet } from "@/lib/pubmed/usable";

type PubmedSheetRow = {
  content: string | null;
  citations: unknown[] | null;
  pmids: string[] | null;
  article_count: number;
  model: string | null;
  status: string | null;
} | null;

type SheetCitation = Parameters<
  typeof PubmedMonographSheet
>[0]["citations"][number];

export function HerbBodyContent({
  herb,
  compactProvenance,
  monograph,
  isManualMonograph,
  isClinicallyReviewed = false,
  lastReviewed,
  reviewedBy,
  regulatorName,
  interactions,
  severityCounts,
  locale,
  copy,
  pubmedSheet,
  sheet,
}: {
  herb: HerbWithInteractions;
  compactProvenance?: Record<string, unknown> | null;
  monograph: Monograph | null;
  isManualMonograph: boolean;
  isClinicallyReviewed?: boolean;
  showCalculator?: boolean;
  lastReviewed?: string;
  reviewedBy?: string;
  regulatorName: string | null;
  interactions: Interaction[];
  severityCounts: {
    contraindicated: number;
    severe: number;
    moderate: number;
    mild: number;
  };
  locale: CopyLocale;
  copy: ReturnType<typeof herbPageCopy>;
  pubmedSheet: PubmedSheetRow;
  sheet: { content: SheetContent | null; translated: boolean };
}) {
  const showNonManualSafetyPanel =
    interactions.length > 0 ||
    (herb.contraindications?.length ?? 0) > 0 ||
    (herb.side_effects?.length ?? 0) > 0 ||
    herb.pregnancy_safe === false ||
    herb.nursing_safe === false;

  if (isManualMonograph && monograph) {
    // Pass only the fields the 5 tab panels read instead of serializing 5
    // pre-rendered Server Component JSX trees into RSC Flight (~30 KB -> ~5 KB).
    return (
      <HerbDetailTabs
        data={{
          herb: {
            slug: herb.slug,
            description: herb.description,
            provenance:
              compactProvenance ??
              ((herb.provenance as Record<string, unknown> | null) ?? null),
            traditional_uses: herb.traditional_uses ?? null,
            modern_uses: herb.modern_uses ?? null,
            active_compounds: herb.active_compounds ?? null,
            dosage_forms: herb.dosage_forms ?? null,
            dosage_adult: herb.dosage_adult ?? null,
            preparation_notes: herb.preparation_notes ?? null,
            pregnancy_safe: herb.pregnancy_safe,
            nursing_safe: herb.nursing_safe,
            contraindications: herb.contraindications ?? null,
            side_effects: herb.side_effects ?? null,
          },
          monograph: {
            slug: monograph.slug,
            summary: monograph.summary,
            mechanism: monograph.mechanism,
            claims: monograph.claims,
          },
          isClinicallyReviewed,
          lastReviewed,
          reviewedBy,
          regulatorName,
          interactionCount: interactions.length,
          severityCounts,
          locale,
        }}
      />
    );
  }

  return (
    <>
      {pubmedSheet && isUsablePubmedSheet(pubmedSheet) ? (
        locale === "fr" && !sheet.translated ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {copy.verbatimQuoteNote}
            </p>
            <details className="rounded-xl border border-border">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-medium text-foreground">
                {copy.verbatimExpandLabel}
              </summary>
              <div className="px-4 pb-4">
                <PubmedMonographSheet
                  content={sheet.content as SheetContent}
                  citations={
                    (pubmedSheet.citations as unknown as SheetCitation[]) ?? []
                  }
                  articleCount={pubmedSheet.article_count ?? 0}
                  status={pubmedSheet.status}
                />
              </div>
            </details>
          </div>
        ) : (
          <PubmedMonographSheet
            content={sheet.content as SheetContent}
            citations={
              (pubmedSheet.citations as unknown as SheetCitation[]) ?? []
            }
            articleCount={pubmedSheet.article_count ?? 0}
            status={pubmedSheet.status}
          />
        )
      ) : (
        <GovSourcedBanner />
      )}
      {showNonManualSafetyPanel && (
        <div id="safety" className="scroll-mt-24">
          <HerbSafetyPanel
            herb={{
              slug: herb.slug,
              pregnancy_safe: herb.pregnancy_safe,
              nursing_safe: herb.nursing_safe,
              contraindications: herb.contraindications ?? null,
              side_effects: herb.side_effects ?? null,
            }}
            interactionCount={interactions.length}
            severityCounts={severityCounts}
            showInteractions={false}
          />
        </div>
      )}
    </>
  );
}
