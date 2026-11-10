import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Pill, Calculator } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface HerbDosagePanelProps {
  /** Name of the regulator behind this entry, when one exists. */
  regulatorName?: string | null;
  herb: {
    slug: string;
    dosage_forms?: string[] | null;
    dosage_adult?: string | null;
    preparation_notes?: string | null;
  };
}

export function HerbDosagePanel({ herb, regulatorName }: HerbDosagePanelProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="flex size-9 items-center justify-center rounded-xl bg-info/10 text-info">
              <Pill className="size-5" />
            </div>
            {t("herbDetail.dosageInfo")}
          </CardTitle>
          <CardDescription>{t("herbDetail.recommendedDosing")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            {herb.dosage_forms && herb.dosage_forms.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.forms")}
                </dt>
                <dd className="mt-1 text-sm capitalize text-muted-foreground">
                  {herb.dosage_forms.join(", ")}
                </dd>
              </div>
            )}
            {!herb.dosage_adult &&
              !(herb.dosage_forms && herb.dosage_forms.length > 0) &&
              regulatorName && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-foreground">
                    {t("herbDetail.adultDosage")}
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {t("herbDetail.noStatedDose", { source: regulatorName })}
                  </dd>
                </div>
              )}
            {herb.dosage_adult && (
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.adultDosage")}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {herb.dosage_adult}
                </dd>
              </div>
            )}
            {herb.preparation_notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-foreground">
                  {t("herbDetail.preparationNotes")}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {herb.preparation_notes}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("herbDetail.adultOnlyNote")}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button
          size="lg"
          render={<Link href={`/calculator?herb=${herb.slug}`} />}
          className="rounded-full"
        >
          <Calculator className="mr-2 size-4" />
          {t("herbDetail.calculateDose")}
        </Button>
      </div>
    </div>
  );
}
