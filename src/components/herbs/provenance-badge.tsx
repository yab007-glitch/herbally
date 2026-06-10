import { useTranslations } from "next-intl";
import { CheckCircle2, Sparkles, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type Provenance,
  isVerified,
} from "@/lib/types/provenance";

/**
 * ProvenanceBadge — renders a small pill indicating how a herb/monograph
 * was verified. Renders nothing for unverified entries (soft default —
 * we don't shame the long tail of 2,700+ herbs that haven't been
 * individually reviewed yet).
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations("provenance");
  const method = provenance.verification_method;

  if (method === "unverified") return null;

  if (isVerified(provenance)) {
    const who = provenance.verified_by;
    const when = provenance.last_verified_at
      ? new Date(provenance.last_verified_at).toLocaleDateString()
      : null;
    const tooltip = [who ? `${t("reviewedBy")} ${who}` : null, when ? `${t("on")} ${when}` : null]
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
