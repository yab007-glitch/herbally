"use client";

import { ChevronDown, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  EvidenceGradeBadge,
  type EvidenceLevel,
} from "@/components/herbs/evidence-grade";
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { UNVERIFIED, type Provenance } from "@/lib/types/provenance";

/**
 * Legend for the evidence and provenance chips on the herb catalogue.
 *
 * The cards carry a bare grade ("A"…"D", "trad") and a review badge
 * ("Verified", "AI-Generated"). On their own they are opaque; the catalogue
 * needs one place that says what they mean. Rendered as a <details> so it
 * costs one line of vertical space until someone needs it — and so it works
 * without JavaScript.
 */

const LEVELS: EvidenceLevel[] = ["A", "B", "C", "D", "trad"];

const PROVENANCE_SAMPLES: Array<{
  key: string;
  provenance: Provenance;
  descKey: string;
}> = [
  {
    key: "verified",
    provenance: { ...UNVERIFIED, verification_method: "manual" },
    descKey: "verifiedDesc",
  },
  {
    key: "ai_summarized",
    provenance: { ...UNVERIFIED, verification_method: "ai_summarized" },
    descKey: "aiSummarizedDesc",
  },
  {
    key: "primary_source",
    provenance: {
      ...UNVERIFIED,
      verification_method: "primary_source",
      verified_by: "auto-verification-script",
    },
    descKey: "notHumanReviewedDesc",
  },
  {
    key: "unverified",
    provenance: UNVERIFIED,
    descKey: "unverifiedDesc",
  },
];

export function ChipLegend({
  className,
  defaultOpen = false,
}: {
  className?: string;
  /** Open on first paint: the methodology page is where this text belongs. */
  defaultOpen?: boolean;
}) {
  const t = useTranslations("chipLegend");
  const tEvidence = useTranslations("evidence");

  return (
    <details
      open={defaultOpen}
      className={`group rounded-lg border border-border bg-card ${className ?? ""}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-foreground [&::-webkit-details-marker]:hidden">
        <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
        {t("title")}
        <ChevronDown
          className="ml-auto size-3.5 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="grid gap-5 border-t border-border px-4 py-4 sm:grid-cols-2">
        <div>
          <h3 className="eyebrow">{t("evidence")}</h3>
          <ul className="mt-2 space-y-1.5">
            {LEVELS.map((level) => (
              <li key={level} className="flex flex-wrap items-center gap-2">
                <EvidenceGradeBadge level={level} />
                <span className="text-sm text-muted-foreground">
                  {tEvidence(`${level}.label`)} —{" "}
                  {tEvidence(`${level}.shortDesc`)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow">{t("review")}</h3>
          <ul className="mt-2 space-y-1.5">
            {PROVENANCE_SAMPLES.map((sample) => (
              <li
                key={sample.key}
                className="flex flex-wrap items-center gap-2"
              >
                <ProvenanceBadge provenance={sample.provenance} />
                <span className="text-sm text-muted-foreground">
                  {t(sample.descKey)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
