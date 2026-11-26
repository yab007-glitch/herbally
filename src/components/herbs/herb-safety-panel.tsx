"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { AlertTriangle, CircleHelp, ShieldCheck, ShieldX } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  InteractionsTable,
  type Interaction,
} from "@/components/herbs/interactions-table";
import { InteractionExplainer } from "@/components/herbs/interaction-explainer";
import {
  PregnancyAlert,
  InteractionAlert,
} from "@/components/herbs/safety-alert";
import { useTranslations } from "next-intl";
import { cleanQuotedText } from "@/lib/herbs/clean-quote";
import { stripFieldLabels } from "@/lib/herbs/clean-faq";
import { isDangerousHerb } from "@/lib/data/dangerous-herbs";
import {
  resolvePregnancyNursingStatus,
  verdictToBoolean,
} from "@/lib/herbs/canonical-safety";

interface HerbSafetyPanelProps {
  herb: {
    slug: string;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    pregnancy_safe_oral?: boolean | null;
    pregnancy_safe_topical?: boolean | null;
    nursing_safe_oral?: boolean | null;
    nursing_safe_topical?: boolean | null;
    provenance?: Record<string, unknown> | null;
    contraindications?: string[] | null;
    side_effects?: string[] | null;
  };
  provenance?: Record<string, unknown> | null;
  interactions?: Interaction[];
  interactionCount?: number;
  severityCounts: {
    contraindicated: number;
    severe: number;
    moderate: number;
    mild: number;
  };
  /**
   * The interaction table also renders inline, above the tabs, so it is
   * visible without opening this panel. Set false here to avoid printing the
   * same table twice on one page.
   */
  showInteractions?: boolean;
}

export function HerbSafetyPanel({
  herb,
  provenance,
  interactions = [],
  interactionCount,
  severityCounts,
  showInteractions = true,
}: HerbSafetyPanelProps) {
  const t = useTranslations();
  const dangerous = isDangerousHerb(herb.slug);
  const safetyStatus = resolvePregnancyNursingStatus(
    herb,
    provenance !== undefined ? provenance : herb.provenance
  );
  const effectivePregnancySafe = verdictToBoolean(safetyStatus.pregnancy);
  const effectiveNursingSafe = verdictToBoolean(safetyStatus.nursing);
  const totalInteractions = interactionCount ?? interactions.length;

  return (
    <div className="space-y-6">
      {/* Pregnancy Alert */}
      {(effectivePregnancySafe !== true || effectiveNursingSafe !== true) && (
        <PregnancyAlert
          pregnancySafe={effectivePregnancySafe}
          nursingSafe={effectiveNursingSafe}
          evidenceLevel="limited"
        />
      )}

      {/* Interaction Alert Summary */}
      <InteractionAlert
        interactionCount={totalInteractions}
        severityCounts={severityCounts}
        isDangerous={dangerous}
      />

      {/* Safety Card */}
      <Card className="overflow-hidden rounded-2xl border-warning/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-warning">
            <div className="flex size-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <AlertTriangle className="size-5" />
            </div>
            {t("herbDetail.safetyInfo")}
          </CardTitle>
          <CardDescription>
            {t("herbDetail.safetyConsiderations")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {effectivePregnancySafe === true ? (
                <ShieldCheck className="size-5 text-success" />
              ) : effectivePregnancySafe === false ? (
                <ShieldX className="size-5 text-destructive" />
              ) : (
                <CircleHelp className="size-5 text-muted-foreground" />
              )}
              <span className="text-sm">
                {effectivePregnancySafe === true
                  ? t("herbDetail.safePregnancy")
                  : effectivePregnancySafe === false
                    ? t("herbDetail.notSafePregnancy")
                    : t("safetyGlance.unknown")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {effectiveNursingSafe === true ? (
                <ShieldCheck className="size-5 text-success" />
              ) : effectiveNursingSafe === false ? (
                <ShieldX className="size-5 text-destructive" />
              ) : (
                <CircleHelp className="size-5 text-muted-foreground" />
              )}
              <span className="text-sm">
                {effectiveNursingSafe === true
                  ? t("herbDetail.safeNursing")
                  : effectiveNursingSafe === false
                    ? t("herbDetail.notSafeNursing")
                    : t("safetyGlance.unknown")}
              </span>
            </div>
          </div>
          {herb.contraindications && herb.contraindications.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                {t("herbDetail.contraindicationsLabel")}
              </h3>
              <ul className="space-y-2">
                {herb.contraindications.map((c: string) => (
                  <li
                    key={c}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                    {cleanQuotedText(stripFieldLabels(c))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {herb.side_effects && herb.side_effects.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                {t("herbDetail.possibleSideEffects")}
              </h3>
              <ul className="space-y-2">
                {herb.side_effects.map((s: string) => (
                  <li
                    key={s}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                    {cleanQuotedText(stripFieldLabels(s))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactions Table */}
      {showInteractions ? (
        <>
          <InteractionExplainer />
          <InteractionsTable interactions={interactions} herbSlug={herb.slug} />
        </>
      ) : totalInteractions > 0 ? (
        <a
          href="#interactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {t("herbDetail.knownInteractions", { count: totalInteractions })} ↑
        </a>
      ) : null}

      {/* CTA — replace generic chat/pharmacist prompt with emergency poison-control priority on toxic botanicals */}
      {dangerous ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-xs font-medium text-destructive"
        >
          Poison Control (US): 1-800-222-1222 · Poison Control (Canada):
          1-844-764-7669 · Emergency: 911
        </div>
      ) : (
        <div className="flex justify-center">
          <Link
            href={`/herbalist?herb=${herb.slug}`}
            rel="nofollow"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-full"
            )}
          >
            <AlertTriangle className="mr-2 size-4" />
            {t("herbDetail.checkInteractions")}
          </Link>
        </div>
      )}
    </div>
  );
}
