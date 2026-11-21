import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import { HerbOverviewPanel } from "@/components/herbs/herb-overview-panel";
import { HerbUsesPanel } from "@/components/herbs/herb-uses-panel";
import { HerbSciencePanel } from "@/components/herbs/herb-science-panel";
import { HerbDosagePanel } from "@/components/herbs/herb-dosage-panel";
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
  monograph,
  isManualMonograph,
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
  monograph: Monograph | null;
  isManualMonograph: boolean;
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
  if (isManualMonograph && monograph) {
    return (
      <HerbDetailTabs
        tabs={[
          {
            key: "overview",
            content: (
              <HerbOverviewPanel
                herb={herb}
                monograph={monograph}
                lastReviewed={lastReviewed}
                reviewedBy={reviewedBy}
                locale={locale}
              />
            ),
          },
          { key: "uses", content: <HerbUsesPanel herb={herb} /> },
          {
            key: "science",
            content: (
              <HerbSciencePanel
                herb={herb}
                monograph={monograph}
                locale={locale}
              />
            ),
          },
          {
            key: "dosage",
            content: (
              <HerbDosagePanel herb={herb} regulatorName={regulatorName} />
            ),
          },
          {
            key: "safety",
            content: (
              <HerbSafetyPanel
                herb={herb}
                interactions={interactions}
                severityCounts={severityCounts}
                showInteractions={false}
              />
            ),
          },
        ]}
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
      {interactions.length > 0 && (
        <div id="safety" className="scroll-mt-24">
          <HerbSafetyPanel
            herb={herb}
            interactions={interactions}
            severityCounts={severityCounts}
            showInteractions={false}
          />
        </div>
      )}
    </>
  );
}
