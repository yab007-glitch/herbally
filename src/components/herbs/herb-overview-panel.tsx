import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { parseProvenance } from "@/lib/types/provenance";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Monograph } from "@/lib/data/monographs";
import { herbPageCopy, type CopyLocale } from "@/lib/i18n/herb-page-copy";

interface HerbOverviewPanelProps {
  herb: {
    description: string;
    updated_at?: string | null;
    last_reviewed?: string | null;
    reviewed_by?: string | null;
    reviewer_credentials?: string | null;
    provenance?: unknown;
  };
  monograph: Monograph | null;
  lastReviewed?: string;
  reviewedBy?: string;
  locale?: CopyLocale;
}

export function HerbOverviewPanel({
  herb,
  monograph,
  lastReviewed,
  reviewedBy,
  locale = "en",
}: HerbOverviewPanelProps) {
  const t = useTranslations();
  const copy = herbPageCopy(locale);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {t("herbDetail.description")}
        </h2>
        <p className="measure prose-body leading-relaxed text-muted-foreground">
          {herb.description}
        </p>
        {monograph &&
          (() => {
            // The monograph prose is authored in English. On /fr it opens
            // collapsed behind a notice, so the French description leads.
            const body = (
              <>
                <h3 className="font-semibold text-foreground">
                  {t("herbDetail.clinicalSummary")}
                </h3>
                <p className="measure prose-body mt-2 leading-relaxed text-muted-foreground">
                  {monograph.summary}
                </p>
                {monograph.mechanism && (
                  <>
                    <h4 className="mt-4 font-medium text-foreground">
                      {t("herbDetail.mechanismOfAction")}
                    </h4>
                    <p className="measure prose-body mt-1 leading-relaxed text-muted-foreground">
                      {monograph.mechanism}
                    </p>
                  </>
                )}
              </>
            );
            return (
              <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5">
                {copy.monographEnglishNotice ? (
                  <>
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                      {copy.monographEnglishNotice}
                    </p>
                    <details className="rounded-lg border border-border/60">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                        {copy.verbatimExpandLabel}
                      </summary>
                      <div className="px-3 pb-1">{body}</div>
                    </details>
                  </>
                ) : (
                  body
                )}
              </div>
            );
          })()}
      </section>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {lastReviewed && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t("herbDetail.lastReviewedPrefix")} {lastReviewed}
          </span>
        )}
        {reviewedBy && (
          <span>
            {t("herbDetailContent.reviewedBy")} {reviewedBy}
          </span>
        )}
        <ProvenanceBadge provenance={parseProvenance(herb.provenance)} />
      </div>
    </div>
  );
}
