import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Handshake, Heart, Stethoscope } from "lucide-react";

interface ClinicalSupportCalloutProps {
  locale: string;
}

export function ClinicalSupportCallout({
  locale,
}: ClinicalSupportCalloutProps) {
  const fr = locale === "fr";

  return (
    <aside
      aria-label={
        fr ? "Soutenir HerbAlly" : "Support independent HerbAlly tools"
      }
      className="no-print mt-10 rounded-2xl border border-border/70 bg-muted/20 p-5"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {fr
              ? "Outils cliniques indépendants et sans publicité"
              : "Independent & ad-free clinical safety tools"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {fr
              ? "HerbAlly garde ses vérificateurs d'interactions, son répertoire des médicaments et ses outils cliniques gratuits et sans compte. Vous pouvez soutenir l'hébergement et les mises à jour réglementaires."
              : "HerbAlly keeps interaction checkers, medication lookups, and pre-surgery planners free without logins or ads on clinical pages. Help sustain hosting and open regulatory updates."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/clinical-review?intent=signoff"
            rel="nofollow"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            <Stethoscope className="size-3.5" aria-hidden="true" />
            <span>{fr ? "Clinicien ? Valider" : "Clinician? Sign off"}</span>
          </Link>
          <Link
            href="/donate"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Heart className="size-3.5" aria-hidden="true" />
            <span>{fr ? "Soutenir HerbAlly" : "Support HerbAlly"}</span>
          </Link>
          <Link
            href="/sponsors"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Handshake className="size-3.5" aria-hidden="true" />
            <span>
              {fr ? "Partenariat ou commandite" : "Sponsor or partner"}
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
