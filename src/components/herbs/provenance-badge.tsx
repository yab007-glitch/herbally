import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Layers,
  FlaskConical,
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

  // Minerals, animal products, vitamins and isolates sit in the same library but are
  // not plants: there is no binomial to check and no herbarium record to find.
  if (provenance.verification_status === "non_plant") {
    return (
      <Badge
        variant="outline"
        className="border-stone-300 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-300"
        title={t("nonPlantTooltip")}
      >
        <FlaskConical className="mr-1 size-3" aria-hidden="true" />
        {t("nonPlant")}
      </Badge>
    );
  }

  // A multi-herb product is not a plant: there is no binomial to check, so the
  // "AI-Generated" label (which reads as a warning about unverified prose) is the
  // wrong signal. Say what it is instead.
  if (provenance.verification_status === "formula") {
    return (
      <Badge
        variant="outline"
        className="border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
        title={t("formulaTooltip")}
      >
        <Layers className="mr-1 size-3" aria-hidden="true" />
        {t("formula")}
      </Badge>
    );
  }

  // Cross-checked against two or more independent sources. Deliberately checked
  // before verification_method: "how the prose was produced" is a different
  // question from "do two registries agree on this plant", and 3,251 of the
  // library's entries clear the second bar.
  if (
    provenance.verification_status === "verified" &&
    provenance.verified_source_count >= 2
  ) {
    const count = provenance.verified_source_count;
    // 409 entries are confirmed only by taxonomic registries (GBIF, ITIS, NCBI):
    // the plant's name is agreed on, but no regulator ever wrote a monograph for
    // it. Claiming "and its regulator record" there would be a lie, so the badge
    // and tooltip switch wording.
    const regulator =
      /health canada|european medicines|\bema\b|\btga\b|\bmhra\b|\bfda\b|\bwho\b/i.test(
        provenance.verified_sources.join(" ")
      );
    return (
      <Badge
        variant="secondary"
        className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
        title={t(
          regulator ? "sourceVerifiedTooltip" : "identityVerifiedTooltip",
          {
            count,
            sources: provenance.verified_sources.join(", "),
          }
        )}
      >
        <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
        {t(regulator ? "sourceVerified" : "identityVerified", { count })}
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
