import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { useTranslations } from "next-intl";
import type { Monograph } from "@/lib/data/monographs";
import { herbPageCopy, type CopyLocale } from "@/lib/i18n/herb-page-copy";

interface HerbSciencePanelProps {
  herb: {
    active_compounds?: string[] | null;
  };
  monograph: Monograph | null;
  locale?: CopyLocale;
}

export function HerbSciencePanel({
  herb,
  monograph,
  locale = "en",
}: HerbSciencePanelProps) {
  const t = useTranslations();
  const copy = herbPageCopy(locale);

  return (
    <div className="space-y-8">
      {/* Active Compounds */}
      {herb.active_compounds && herb.active_compounds.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-science/10 text-science">
              <FlaskConical className="size-5" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("herbDetail.activeCompounds")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {herb.active_compounds.map((compound: string) => (
              <Badge
                key={compound}
                variant="outline"
                className="rounded-full px-3 py-1 text-sm"
              >
                {compound}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Evidence by Claim */}
      {monograph && monograph.claims.length > 0 && (() => {
        // Claim wording is authored in English. On /fr it opens collapsed
        // behind a notice so the page reads in French first.
        const claims = (
          <div className="space-y-3">
            {monograph.claims.map((claim) => (
              <div
                key={claim.claim}
                className="flex items-start justify-between gap-4 rounded-2xl border p-4"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{claim.claim}</p>
                  {claim.note && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {claim.note}
                    </p>
                  )}
                </div>
                <EvidenceGrade
                  level={claim.evidence as "A" | "B" | "C" | "D" | "trad"}
                  showLabel={false}
                />
              </div>
            ))}
          </div>
        );
        return (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {t("herbDetail.evidenceByClaim")}
            </h2>
            {copy.monographEnglishNotice ? (
              <>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  {copy.monographEnglishNotice}
                </p>
                <details className="rounded-2xl border border-border/60">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                    {copy.verbatimExpandLabel}
                  </summary>
                  <div className="px-3 pb-3">{claims}</div>
                </details>
              </>
            ) : (
              claims
            )}
          </section>
        );
      })()}
    </div>
  );
}
