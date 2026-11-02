import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type Provenance,
  isVerified,
  getReviewState,
} from "@/lib/types/provenance";

/**
 * ProvenanceBadge — renders a pill indicating how a herb/monograph was
 * verified. For unverified entries, renders an amber "AI-Generated" badge
 * so users understand the content has not been reviewed against primary
 * sources. Previously returned null for unverified, which silently
 * presented AI-generated medical content as authoritative.
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations("provenance");
  const method = provenance.verification_method;
  const review = getReviewState(provenance);

  // An explicit review state is the site's strongest claim, so it is checked
  // before anything derived from verification_method. `human_reviewed` only
  // exists when a named person and a date were recorded.
  if (review?.kind === "human_reviewed") {
    return (
      <Badge
        variant="secondary"
        className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
        title={t("humanReviewedTooltip", {
          reviewer: review.reviewer,
          date: review.date,
        })}
      >
        <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
        {t("humanReviewed")}
      </Badge>
    );
  }

  if (review?.kind === "needs_re_review") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
        title={t("needsReReviewTooltip")}
      >
        <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
        {t("needsReReview")}
      </Badge>
    );
  }

  if (method === "unverified") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
        title={t("unverifiedTooltip")}
      >
        <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
        {t("unverified")}
      </Badge>
    );
  }

  if (isVerified(provenance)) {
    const who = provenance.verified_by;
    const when = provenance.last_verified_at
      ? new Date(provenance.last_verified_at).toLocaleDateString()
      : null;
    const tooltip = [
      who ? `${t("reviewedBy")} ${who}` : null,
      when ? `${t("on")} ${when}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <Badge
        variant="secondary"
        className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
        title={tooltip || t("verifiedTooltip")}
      >
        <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
        {t("verified")}
      </Badge>
    );
  }

  // Manual / primary-source records that fail isVerified() (no reviewer,
  // or an automated reviewer name) must never render "Verified". Label them
  // plainly instead of falling back to a "Source-backed" pill that could
  // still read as an endorsement.
  if (method === "manual" || method === "primary_source") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
        title={t("notHumanReviewedTooltip")}
      >
        <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
        {t("notHumanReviewed")}
      </Badge>
    );
  }

  if (method === "ai_summarized") {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        title={t("aiSummarizedTooltip")}
      >
        <Sparkles className="mr-1 size-3" aria-hidden="true" />
        {t("aiSummarized")}
      </Badge>
    );
  }

  // primary_source without a reviewer: render a muted pill so the data
  // shape is preserved but the user understands it's not yet a manual review.
  return (
    <Badge
      variant="outline"
      className="border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
      title={t("primarySourceTooltip")}
    >
      <AlertCircle className="mr-1 size-3" aria-hidden="true" />
      {t("primarySource")}
    </Badge>
  );
}
