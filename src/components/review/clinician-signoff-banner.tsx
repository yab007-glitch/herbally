import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditTargetType } from "@/lib/governance/clinical-edits";

export interface ClinicianSignOffBannerProps {
  locale: "en" | "fr";
  targetType?: EditTargetType;
  herbSlug?: string;
  drugName?: string;
  recordTitle?: string;
  unreviewedCount?: number;
  compact?: boolean;
  className?: string;
}

export function buildSignOffHref({
  targetType = "general",
  herbSlug,
  drugName,
}: {
  targetType?: EditTargetType;
  herbSlug?: string;
  drugName?: string;
}): string {
  const params = new URLSearchParams();
  params.set("intent", "signoff");
  if (targetType !== "general") {
    params.set("targetType", targetType);
  }
  if (herbSlug?.trim()) {
    params.set("slug", herbSlug.trim());
  }
  if (drugName?.trim()) {
    params.set("drug", drugName.trim());
  }
  return `/clinical-review?${params.toString()}`;
}

/**
 * Contextual peer-review invitation encouraging visiting pharmacists, physicians,
 * nurse practitioners, and toxicologists to clinically review and sign off the
 * exact monograph or interaction page they are inspecting via LinkedIn SSO.
 *
 * Must NEVER be rendered on quarantined toxic botanical pages or /embed/* frames.
 */
export function ClinicianSignOffBanner({
  locale,
  targetType = "general",
  herbSlug,
  drugName,
  recordTitle,
  unreviewedCount,
  compact = false,
  className,
}: ClinicianSignOffBannerProps) {
  const fr = locale === "fr";
  const signOffHref = buildSignOffHref({ targetType, herbSlug, drugName });

  const heading = recordTitle
    ? fr
      ? `Pharmacien(ne), médecin ou toxicologue ? Validez cliniquement « ${recordTitle} »`
      : `Pharmacist, physician, or toxicologist? Help sign off "${recordTitle}"`
    : fr
      ? "Vous êtes clinicien(ne) licencié(e) ? Aidez à signer les fiches HerbAlly"
      : "Are you a licensed clinician? Help sign off HerbAlly monographs";

  const body =
    typeof unreviewedCount === "number" && unreviewedCount > 0 && recordTitle
      ? fr
        ? `${unreviewedCount} ${unreviewedCount === 1 ? "interaction associée" : "interactions associées"} à ${recordTitle} attendent une révision par un clinicien licencié (PharmD, RPh, MD, DO, IPS ou toxicologue). Vérifiez les sources primaires et soumettez votre validation via SSO LinkedIn en ~2 minutes.`
        : `${unreviewedCount} documented ${unreviewedCount === 1 ? "interaction" : "interactions"} for ${recordTitle} await independent licensed clinician sign-off (PharmD, RPh, MD/DO, NP, or toxicologist). Verify the primary citations and submit your clinical sign-off via LinkedIn SSO in ~2 minutes.`
      : recordTitle
        ? fr
          ? `Cette fiche est actuellement compilée à partir de sources réglementaires sans signature clinique externe. Si vous détenez un permis d'exercice (PharmD, MD/DO, IPS ou toxicologue), relisez les citations et soumettez votre validation via SSO LinkedIn en ~2 minutes.`
          : `This record is currently compiled from regulatory monographs without external clinician sign-off. If you hold an active clinical licence (PharmD, RPh, MD/DO, NP, or toxicologist), review the citations and submit your sign-off via LinkedIn SSO in ~2 minutes.`
        : fr
          ? "HerbAlly garde ses outils gratuits et transparents. Les pharmaciens, médecins et toxicologues peuvent signer les fiches prioritaires via SSO LinkedIn et obtenir un crédit public optionnel (nom et titres) ou postuler aux 3 sièges ouverts du comité consultatif."
          : "HerbAlly keeps botanical safety references open and transparent. Licensed pharmacists, physicians, and toxicologists can sign off priority records via LinkedIn SSO with optional public credential attribution — or inquire about our 3 open Clinical Advisory Board seats.";

  return (
    <aside
      aria-label={
        fr
          ? "Invitation à la validation clinique pour les professionnels de santé"
          : "Licensed clinician sign-off invitation"
      }
      data-clinician-signoff-cta="true"
      className={cn(
        "no-print rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] dark:border-emerald-400/25 dark:bg-emerald-950/20",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            <Stethoscope className="size-3.5" aria-hidden="true" />
            <span>
              {fr
                ? "Révision par les pairs · Cliniciens licenciés"
                : "Licensed Clinician Peer Review"}
            </span>
          </div>

          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {heading}
          </h2>

          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {body}
          </p>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1">
              <CheckCircle2
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                {fr
                  ? "SSO LinkedIn (~2 min, aucun compte HerbAlly requis)"
                  : "LinkedIn SSO (~2 min, no HerbAlly account needed)"}
              </span>
            </li>
            <li className="inline-flex items-center gap-1">
              <CheckCircle2
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                {fr
                  ? "Crédit public optionnel (nom + PharmD / MD)"
                  : "Optional public credit (name + PharmD / MD)"}
              </span>
            </li>
            <li className="inline-flex items-center gap-1">
              <CheckCircle2
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                {fr
                  ? "Vérification humaine avant publication"
                  : "Manual credential verification before publish"}
              </span>
            </li>
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <Link
            href={signOffHref}
            rel="nofollow"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {recordTitle
                ? fr
                  ? "Signer cette fiche (SSO LinkedIn)"
                  : "Sign off this record (LinkedIn SSO)"
                : fr
                  ? "Valider une fiche (SSO LinkedIn)"
                  : "Sign off a record (LinkedIn SSO)"}
            </span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
          <Link
            href="/clinical-review?intent=signoff#priority-queue"
            rel="nofollow"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {fr ? "Voir la file prioritaire" : "Browse priority review queue"}
          </Link>
        </div>
      </div>
    </aside>
  );
}
