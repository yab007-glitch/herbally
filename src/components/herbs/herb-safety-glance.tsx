"use client";

import { ArrowRight, CircleHelp, ShieldCheck, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * "Safety at a glance" — the answer a worried visitor needs before anything
 * else on the page: can I take this with what I'm already taking, and is it
 * safe if I'm pregnant or nursing?
 *
 * It deliberately sits directly under the herb title and above the dose CTA:
 * offering a dose calculator before showing interactions implies dosing is
 * the next safe step, which is the wrong question for a health reference.
 *
 * Verdicts are pre-gated by the caller. An unverified (AI-written) row never
 * renders "safe"/"not safe"; it renders "Unknown — not enough data", because
 * a fabricated boolean must never read as advice.
 */

export type GlanceSeverity = "contraindicated" | "severe" | "moderate" | "mild";

export interface GlanceInteraction {
  drug_name: string;
  severity: string;
}

interface SafetyGlanceProps {
  pregnancySafe: boolean | null;
  nursingSafe: boolean | null;
  /**
   * Route-specific flags. When oral and topical disagree, the single verdict
   * is misleading — "unsafe orally, fine on the skin" is the clinically useful
   * sentence, so it is printed underneath instead of a bare "unsafe".
   */
  pregnancySafeOral?: boolean | null;
  pregnancySafeTopical?: boolean | null;
  nursingSafeOral?: boolean | null;
  nursingSafeTopical?: boolean | null;
  contraindications?: string[] | null;
  interactions: GlanceInteraction[];
  /** Anchor of the full interaction list (a tab or an inline section). */
  href?: string;
  className?: string;
}

const SEVERITY_ORDER: GlanceSeverity[] = [
  "contraindicated",
  "severe",
  "moderate",
  "mild",
];

const severityTone: Record<GlanceSeverity, string> = {
  contraindicated:
    "border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20",
  severe: "border-destructive/30 bg-destructive/5 text-destructive",
  moderate:
    "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  mild: "border-border bg-muted text-foreground",
};

/** "Orally: unsafe · Topically: safe", only when the routes actually differ. */
function RouteSplit({
  oral,
  topical,
  orallyLabel,
  topicallyLabel,
  safeLabel,
  unsafeLabel,
}: {
  oral: boolean | null;
  topical: boolean | null;
  orallyLabel: string;
  topicallyLabel: string;
  safeLabel: string;
  unsafeLabel: string;
}) {
  if (oral === null || topical === null || oral === topical) return null;
  return (
    <span className="mt-0.5 block text-[11px] text-muted-foreground">
      {orallyLabel}: {oral ? safeLabel : unsafeLabel}
      {" \u00b7 "}
      {topicallyLabel}: {topical ? safeLabel : unsafeLabel}
    </span>
  );
}

function Verdict({ value, label }: { value: boolean | null; label: string }) {
  const Icon =
    value === true ? ShieldCheck : value === false ? ShieldX : CircleHelp;
  const tone =
    value === true
      ? "text-primary"
      : value === false
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <span className={cn("flex items-start gap-1.5 text-sm", tone)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">{label}</span>
    </span>
  );
}

export function SafetyGlance({
  pregnancySafe,
  nursingSafe,
  pregnancySafeOral = null,
  pregnancySafeTopical = null,
  nursingSafeOral = null,
  nursingSafeTopical = null,
  contraindications,
  interactions,
  href = "#safety",
  className,
}: SafetyGlanceProps) {
  const t = useTranslations("safetyGlance");
  const tSeverity = useTranslations("interactions.severity");

  const counts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: interactions.filter((i) => i.severity === severity).length,
  })).filter((c) => c.count > 0);

  const worst = counts[0];
  const worstDrug = worst
    ? interactions.find((i) => i.severity === worst.severity)?.drug_name
    : undefined;

  const items = contraindications?.filter(Boolean) ?? [];

  return (
    <section
      aria-labelledby="safety-glance-heading"
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-accent/40 text-left",
        className
      )}
    >
      <h2
        id="safety-glance-heading"
        className="eyebrow border-b border-border/70 px-4 py-2.5"
      >
        {t("title")}
      </h2>

      <dl className="grid divide-y divide-border/70 sm:grid-cols-[1fr_1fr_1.4fr] sm:divide-x sm:divide-y-0">
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">
            {t("pregnancy")}
          </dt>
          <dd className="mt-1">
            <Verdict
              value={pregnancySafe}
              label={
                pregnancySafe === true
                  ? t("safe")
                  : pregnancySafe === false
                    ? t("unsafe")
                    : t("unknown")
              }
            />
            <RouteSplit
              oral={pregnancySafeOral}
              topical={pregnancySafeTopical}
              orallyLabel={t("orally")}
              topicallyLabel={t("topically")}
              safeLabel={t("safe")}
              unsafeLabel={t("unsafe")}
            />
          </dd>
        </div>

        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">
            {t("nursing")}
          </dt>
          <dd className="mt-1">
            <Verdict
              value={nursingSafe}
              label={
                nursingSafe === true
                  ? t("safe")
                  : nursingSafe === false
                    ? t("unsafe")
                    : t("unknown")
              }
            />
            <RouteSplit
              oral={nursingSafeOral}
              topical={nursingSafeTopical}
              orallyLabel={t("orally")}
              topicallyLabel={t("topically")}
              safeLabel={t("safe")}
              unsafeLabel={t("unsafe")}
            />
          </dd>
        </div>

        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">
            {t("interactions")}
          </dt>
          <dd className="mt-1 space-y-1.5">
            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("interactionCountNone")}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  {t("interactionCount", { count: interactions.length })}
                </p>
                <ul className="flex flex-wrap gap-1">
                  {counts.map(({ severity, count }) => (
                    <li
                      key={severity}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        severityTone[severity]
                      )}
                    >
                      {t(`severityCount.${severity}`, { count })}
                    </li>
                  ))}
                </ul>
                {worstDrug && worst && (
                  <p className="text-xs text-muted-foreground">
                    {t("mostSerious", {
                      drug: worstDrug,
                      severity: tSeverity(worst.severity),
                    })}
                  </p>
                )}
              </>
            )}
            {interactions.length > 0 && (
              /* A plain anchor, not next/link: this is in-page navigation and
                 the tabbed layout reacts to the browser's hashchange event,
                 which a client-side router push does not fire. */
              <a
                href={href}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("seeList")}
                <ArrowRight className="size-3" aria-hidden="true" />
              </a>
            )}
          </dd>
        </div>
      </dl>

      {items.length > 0 && (
        <div className="border-t border-border/70 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("avoidIf")}
          </p>
          <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-1.5 text-sm text-foreground"
              >
                <span
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-border/70 bg-background/40 px-4 py-2 text-[11px] text-muted-foreground">
        {t("footnote")}
      </p>
    </section>
  );
}
