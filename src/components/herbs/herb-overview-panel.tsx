import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { parseProvenance } from "@/lib/types/provenance";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Monograph } from "@/lib/data/monographs";

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
  reviewedBy: string;
}

export function HerbOverviewPanel({
  herb,
  monograph,
  lastReviewed,
  reviewedBy,
}: HerbOverviewPanelProps) {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {t("herbDetail.description")}
        </h2>
        <p className="leading-relaxed text-muted-foreground text-base">
          {herb.description}
        </p>
        {monograph && (
          <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5">
            <h3 className="font-semibold text-foreground">
              {t("herbDetail.clinicalSummary")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {monograph.summary}
            </p>
            {monograph.mechanism && (
              <>
                <h4 className="mt-4 font-medium text-foreground">
                  {t("herbDetail.mechanismOfAction")}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {monograph.mechanism}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {lastReviewed && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t("herbDetail.lastReviewedPrefix")} {lastReviewed}
          </span>
        )}
        <span>
          {t("herbDetailContent.reviewedBy")}: {reviewedBy}
        </span>
        <ProvenanceBadge provenance={parseProvenance(herb.provenance)} />
      </div>
    </div>
  );
}
