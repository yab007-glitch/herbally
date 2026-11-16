"use client";

import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface SafetyAlertProps {
  severity: "critical" | "warning" | "info";
  title: string;
  children: React.ReactNode;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20",
    textColor: "text-destructive",
    iconColor: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
    textColor: "text-warning",
    iconColor: "text-warning",
  },
  info: {
    icon: Info,
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
    textColor: "text-info",
    iconColor: "text-info",
  },
};

export function SafetyAlert({
  severity,
  title,
  children,
  className,
}: SafetyAlertProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        config.bgColor,
        config.borderColor,
        className
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <Icon className={cn("size-5 shrink-0 mt-0.5", config.iconColor)} />
        <div className="flex-1">
          <h3 className={cn("font-semibold text-sm", config.textColor)}>
            {title}
          </h3>
          <div className={cn("mt-1 text-sm", config.textColor)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// Specialized component for drug interactions
interface InteractionAlertProps {
  interactionCount: number;
  severityCounts?: {
    contraindicated?: number;
    severe?: number;
    moderate?: number;
    mild?: number;
  };
  className?: string;
}

export function InteractionAlert({
  interactionCount,
  severityCounts,
  className,
}: InteractionAlertProps) {
  const t = useTranslations();

  if (interactionCount === 0) {
    return (
      <SafetyAlert
        severity="info"
        title={t("safety.noInteractionsTitle")}
        className={className}
      >
        {t("safety.noInteractionsMsg")}
      </SafetyAlert>
    );
  }

  const hasSevere =
    (severityCounts?.contraindicated || 0) > 0 ||
    (severityCounts?.severe || 0) > 0;
  const hasModerate = (severityCounts?.moderate || 0) > 0;

  const severity = hasSevere ? "critical" : hasModerate ? "warning" : "info";

  return (
    <SafetyAlert
      severity={severity}
      title={
        interactionCount === 1
          ? t("safety.interactionCountTitle", { count: interactionCount })
          : t("safety.interactionCountTitlePlural", { count: interactionCount })
      }
      className={className}
    >
      <div className="space-y-2">
        {severityCounts && (
          <div className="flex flex-wrap gap-2 text-xs">
            {(severityCounts.contraindicated || 0) > 0 && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                {severityCounts.contraindicated}{" "}
                {t("safety.severityContraindicated")}
              </span>
            )}
            {(severityCounts.severe || 0) > 0 && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                {severityCounts.severe} {t("safety.severitySevere")}
              </span>
            )}
            {(severityCounts.moderate || 0) > 0 && (
              <span className="rounded bg-warning/10 px-1.5 py-0.5 font-medium text-warning">
                {severityCounts.moderate} {t("safety.severityModerate")}
              </span>
            )}
            {(severityCounts.mild || 0) > 0 && (
              <span className="rounded bg-info/10 px-1.5 py-0.5 font-medium text-info">
                {severityCounts.mild} {t("safety.severityMild")}
              </span>
            )}
          </div>
        )}
        <p>{t("safety.interactionMessage")}</p>
      </div>
    </SafetyAlert>
  );
}

// Component for pregnancy/nursing warnings
interface PregnancyAlertProps {
  /** `null` means the sources do not establish safety — not "unsafe". */
  pregnancySafe: boolean | null;
  nursingSafe: boolean | null;
  evidenceLevel?: "strong" | "limited" | "insufficient";
  className?: string;
}

export function PregnancyAlert({
  pregnancySafe,
  nursingSafe,
  evidenceLevel = "limited",
  className,
}: PregnancyAlertProps) {
  const t = useTranslations();

  // A null field used to be coerced to `false` by the caller, so the 3,095
  // herbs whose pregnancy status was never established were labelled "not
  // recommended during pregnancy" — a claim the sources do not make, and one
  // that contradicted the "status unknown" badge elsewhere on the same page
  // (live QA, 2026-11-15). Unknown is now its own state.
  const unknownPregnancy = pregnancySafe === null;
  const unknownNursing = nursingSafe === null;
  const unsafePregnancy = pregnancySafe === false;
  const unsafeNursing = nursingSafe === false;

  if (pregnancySafe === true && nursingSafe === true) {
    return (
      <SafetyAlert
        severity="info"
        title={t("safety.pregnancySafetyTitle")}
        className={className}
      >
        {t("safety.pregnancySafeMsg", { level: evidenceLevel })}
      </SafetyAlert>
    );
  }

  if (unsafePregnancy || unsafeNursing) {
    return (
      <SafetyAlert
        severity="critical"
        title={`⚠️ ${t("safety.notSafeTitle")}`}
        className={className}
      >
        <div className="space-y-2">
          {unsafePregnancy && <p>{t("safety.notPregnancyMsg")}</p>}
          {unsafeNursing && <p>{t("safety.notNursingMsg")}</p>}
          {unknownPregnancy && <p>{t("safety.pregnancyUnknownMsg")}</p>}
          {unknownNursing && <p>{t("safety.nursingUnknownMsg")}</p>}
          <p className="font-medium">{t("safety.consultProvider")}</p>
        </div>
      </SafetyAlert>
    );
  }

  // Nothing is flagged unsafe, but at least one status is unestablished.
  return (
    <SafetyAlert
      severity="info"
      title={t("safety.pregnancySafetyTitle")}
      className={className}
    >
      <div className="space-y-2">
        {unknownPregnancy && <p>{t("safety.pregnancyUnknownMsg")}</p>}
        {unknownNursing && <p>{t("safety.nursingUnknownMsg")}</p>}
        <p className="font-medium">{t("safety.consultProvider")}</p>
      </div>
    </SafetyAlert>
  );
}
