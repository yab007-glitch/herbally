import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Award, ArrowRight, Mail, ShieldCheck } from "lucide-react";

export interface ClinicalAdvisoryBoardCalloutProps {
  locale: "en" | "fr";
  compact?: boolean;
}

const SEATS = [
  {
    id: "Seat A",
    roleEn: "Clinical Pharmacist (PharmD / RPh)",
    roleFr: "Pharmacien(ne) clinicien(ne) (PharmD / BPharm)",
    scopeEn:
      "Herb–drug interactions, CYP450 / P-gp pathways, DOACs, warfarin & immunosuppressants.",
    scopeFr:
      "Interactions plante–médicament, voies CYP450 / P-gp, AOD, warfarine et immunosuppresseurs.",
  },
  {
    id: "Seat B",
    roleEn: "Physician / Clinical Toxicologist (MD / DO / DABAT)",
    roleFr: "Médecin / Toxicologue clinique (MD / DO / DABAT)",
    scopeEn:
      "Clinical safety framing, organ-toxicity alerts, perioperative guidance & toxic quarantine.",
    scopeFr:
      "Cadrage clinique, toxicité d'organes, divulgation préopératoire et quarantaine toxique.",
  },
  {
    id: "Seat C",
    roleEn: "Perinatal, Pediatric & Francophone Advisor (MD / PharmD)",
    roleFr: "Conseiller(ère) périnatalité, pédiatrie & clinique francophone",
    scopeEn:
      "Pregnancy/lactation & pediatric safety boundaries + native-French clinical validation.",
    scopeFr:
      "Sécurité grossesse/allaitement et pédiatrie + validation clinique en français natif.",
  },
] as const;

export function ClinicalAdvisoryBoardCallout({
  locale,
  compact = false,
}: ClinicalAdvisoryBoardCalloutProps) {
  const fr = locale === "fr";

  return (
    <aside
      id="clinical-advisory-board"
      aria-labelledby="advisory-board-callout-heading"
      className="no-print rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-muted/30 p-5 shadow-sm sm:p-6"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Award className="size-3.5" aria-hidden="true" />
              <span>
                {fr
                  ? "Comité consultatif clinique · 0 / 3 sièges pourvus"
                  : "Founding Clinical Advisory Board · 0 / 3 seats filled"}
              </span>
            </p>
            <h2
              id="advisory-board-callout-heading"
              className="text-lg font-semibold text-foreground sm:text-xl"
            >
              {fr
                ? "Rejoignez le comité consultatif clinique fondateur d'HerbAlly"
                : "Join HerbAlly's Founding Clinical Advisory Board"}
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {fr
                ? "HerbAlly est une ressource bilingue gratuite, ouverte et sans publicité sur les outils cliniques. Nous recrutons trois cliniciens licenciés (bénévoles fondateurs, ~2 à 4 h/mois) pour orienter nos priorités de révision, valider les fiches à haut risque (en anglais et en français) et garantir l'indépendance scientifique."
                : "HerbAlly is a free, open-data bilingual botanical safety reference with zero ads on clinical tools. We are recruiting three licensed clinicians (pro bono founding seats, ~2–4 hrs/month) to guide review priorities, validate high-risk records (including native-French clinical review), and uphold independent governance."}
            </p>
          </div>
        </div>

        {!compact && (
          <div className="grid gap-3 sm:grid-cols-3">
            {SEATS.map((seat) => (
              <div
                key={seat.id}
                className="flex flex-col justify-between rounded-xl border border-border/80 bg-background/90 p-3.5 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-primary">
                      {seat.id}
                    </span>
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      {fr ? "Vacant" : "Open"}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">
                    {fr ? seat.roleFr : seat.roleEn}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    {fr ? seat.scopeFr : seat.scopeEn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            {fr
              ? "Reconnaissance publique permanente (nom, titres, affiliation) sur /editorial-policy, /about et /trust"
              : "Named public credit (name, credentials & affiliation) on /editorial-policy, /about & /trust"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {fr
              ? "Vérification du permis et déclaration écrite de conflits d'intérêts requises"
              : "Active licence verification & written COI disclosure required"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Link
            href="/clinical-review?intent=advisory"
            rel="nofollow"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:text-sm"
          >
            <span>
              {fr
                ? "Postuler via LinkedIn SSO"
                : "Apply for a Board Seat (LinkedIn SSO)"}
            </span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href="mailto:info@herbally.app?subject=HerbAlly%20Clinical%20Advisory%20Board%20Application"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:text-sm"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            <span>
              {fr ? "Candidature par courriel" : "Email nomination directly"}
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
