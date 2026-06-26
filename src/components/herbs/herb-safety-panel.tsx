import Link from "next/link";
import { AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface HerbSafetyPanelProps {
  herb: {
    slug: string;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    contraindications?: string[] | null;
    side_effects?: string[] | null;
  };
  interactions: Interaction[];
  severityCounts: {
    contraindicated: number;
    severe: number;
    moderate: number;
    mild: number;
  };
}

export function HerbSafetyPanel({
  herb,
  interactions,
  severityCounts,
}: HerbSafetyPanelProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Pregnancy Alert */}
      {(!herb.pregnancy_safe || !herb.nursing_safe) && (
        <PregnancyAlert
          pregnancySafe={herb.pregnancy_safe ?? false}
          nursingSafe={herb.nursing_safe ?? false}
          evidenceLevel="limited"
        />
      )}

      {/* Interaction Alert Summary */}
      <InteractionAlert
        interactionCount={interactions.length}
        severityCounts={severityCounts}
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
              {herb.pregnancy_safe ? (
                <ShieldCheck className="size-5 text-success" />
              ) : (
                <ShieldX className="size-5 text-destructive" />
              )}
              <span className="text-sm">
                {herb.pregnancy_safe
                  ? t("herbDetail.safePregnancy")
                  : t("herbDetail.notSafePregnancy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {herb.nursing_safe ? (
                <ShieldCheck className="size-5 text-success" />
              ) : (
                <ShieldX className="size-5 text-destructive" />
              )}
              <span className="text-sm">
                {herb.nursing_safe
                  ? t("herbDetail.safeNursing")
                  : t("herbDetail.notSafeNursing")}
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
                    {c}
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
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactions Table */}
      <InteractionExplainer />
      <InteractionsTable interactions={interactions} />

      {/* CTA */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="lg"
          render={<Link href={`/herbalist?herb=${herb.slug}`} />}
          className="rounded-full"
        >
          <AlertTriangle className="mr-2 size-4" />
          {t("herbDetail.checkInteractions")}
        </Button>
      </div>
    </div>
  );
}
