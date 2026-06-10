import { BookOpen, Stethoscope } from "lucide-react";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { useTranslations } from "next-intl";

interface HerbUsesPanelProps {
  herb: {
    traditional_uses?: string[] | null;
    modern_uses?: string[] | null;
  };
}

export function HerbUsesPanel({ herb }: HerbUsesPanelProps) {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Traditional Uses */}
        {herb.traditional_uses && herb.traditional_uses.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <BookOpen className="size-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("herbDetail.traditionalUses")}
              </h2>
              <EvidenceGrade level="C" showLabel={false} />
            </div>
            <ul className="space-y-3">
              {herb.traditional_uses.map((use: string) => (
                <li
                  key={use}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400" />
                  {use}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Modern Uses */}
        {herb.modern_uses && herb.modern_uses.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
                <Stethoscope className="size-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("herbDetail.modernUses")}
              </h2>
              <EvidenceGrade level="B" showLabel={false} />
            </div>
            <ul className="space-y-3">
              {herb.modern_uses.map((use: string) => (
                <li
                  key={use}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-green-400" />
                  {use}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
